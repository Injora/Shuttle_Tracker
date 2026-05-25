const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { getIO, driverLocations, triggerManualTransition } = require("../socket");
const timerManager = require("../services/timerManager");
const stateMachine = require("../services/stateMachine");
const router = express.Router();

// GET /api/shifts/active-fleet - Get all active shifts for tracking (Students and Drivers)
router.get("/active-fleet", authenticate, async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({
      where: { endedAt: { isSet: false } },
      include: {
        bus: true,
        driver: {
          select: {
            id: true,
            email: true,
            name: true,
            picture: true,
            mobileNumber: true,
          },
        },
      },
    });

    // Merge in-memory GPS coordinates and live state
    const fleet = shifts.map((shift) => {
      const liveData = driverLocations.get(shift.id);
      const remainingSeconds = timerManager.getRemaining(shift.id);

      return {
        id: shift.id,
        busId: shift.busId,
        driverId: shift.driverId,
        state: liveData?.state || shift.state,
        startedAt: shift.startedAt,
        latitude: liveData?.latitude ?? shift.latitude,
        longitude: liveData?.longitude ?? shift.longitude,
        heading: liveData?.heading ?? shift.heading,
        speed: liveData?.speed ?? shift.speed,
        bus: shift.bus,
        driver: shift.driver,
        remainingSeconds,
      };
    });

    res.json(fleet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shifts/active - Get authenticated driver's active shift
router.get("/active", authenticate, requireRole("driver"), async (req, res) => {
  try {
    const shift = await prisma.shift.findFirst({
      where: { driverId: req.userId, endedAt: { isSet: false } },
      include: { bus: true },
    });

    if (!shift) {
      return res.status(200).json(null);
    }

    const remainingSeconds = timerManager.getRemaining(shift.id);
    res.json({
      ...shift,
      remainingSeconds,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/start - Start a new shift (Driver only)
router.post("/start", authenticate, requireRole("driver"), async (req, res) => {
  const { busId } = req.body;
  if (!busId) {
    return res.status(400).json({ error: "busId is required" });
  }

  try {
    // 1. Verify bus exists and is active
    const bus = await prisma.bus.findUnique({ where: { id: busId } });
    if (!bus || !bus.isActive) {
      return res.status(404).json({ error: "Active bus not found" });
    }

    // 2. Verify driver doesn't have an active shift already
    const existingDriverShift = await prisma.shift.findFirst({
      where: { driverId: req.userId, endedAt: { isSet: false } },
    });
    if (existingDriverShift) {
      return res.status(400).json({ error: "You already have an active shift" });
    }

    // 3. Verify bus isn't in use by another active shift
    const existingBusShift = await prisma.shift.findFirst({
      where: { busId, endedAt: { isSet: false } },
    });
    if (existingBusShift) {
      return res.status(400).json({ error: "This bus is already in use by another driver" });
    }

    // 4. Create Shift
    const shift = await prisma.shift.create({
      data: {
        busId,
        driverId: req.userId,
        state: "Idle",
      },
      include: { bus: true },
    });

    console.log(`[Shift] Driver ${req.userEmail} started shift ${shift.id} on bus ${bus.busNumber}`);
    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/end - End active shift (Driver only)
router.post("/end", authenticate, requireRole("driver"), async (req, res) => {
  try {
    const shift = await prisma.shift.findFirst({
      where: { driverId: req.userId, endedAt: { isSet: false } },
    });

    if (!shift) {
      return res.status(404).json({ error: "No active shift found" });
    }

    // Cancel countdown
    timerManager.cancelCountdown(shift.id);

    // Update in database
    const endedShift = await prisma.shift.update({
      where: { id: shift.id },
      data: { endedAt: new Date() },
    });

    // Notify via Socket.IO
    const io = getIO();
    io.to("role:student").emit("bus:offline", { shiftId: shift.id });

    // Remove from in-memory coordinates
    driverLocations.delete(shift.id);

    console.log(`[Shift] Driver ${req.userEmail} ended shift ${shift.id}`);
    res.json({ message: "Shift ended successfully", shift: endedShift });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/transition - Request manual state transition (Driver only)
router.post("/transition", authenticate, requireRole("driver"), async (req, res) => {
  const { toState } = req.body;
  if (!toState) {
    return res.status(400).json({ error: "toState is required" });
  }

  try {
    const shift = await prisma.shift.findFirst({
      where: { driverId: req.userId, endedAt: { isSet: false } },
    });

    if (!shift) {
      return res.status(404).json({ error: "No active shift found" });
    }

    if (!Object.values(stateMachine.STATES).includes(toState)) {
      return res.status(400).json({ error: `Invalid state: ${toState}` });
    }

    // Execute transition (handles Socket.IO emission, db write, and timer setup)
    await triggerManualTransition(shift.id, toState);

    res.json({ message: `Successfully transitioned to ${toState}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/shifts/:id/countdown - Get remaining seconds for a shift
router.get("/:id/countdown", authenticate, async (req, res) => {
  const remainingSeconds = timerManager.getRemaining(req.params.id);
  res.json({ shiftId: req.params.id, remainingSeconds });
});

module.exports = router;
