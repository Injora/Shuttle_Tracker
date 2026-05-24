const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const router = express.Router();

// GET /api/buses - Get all active buses
router.get("/", async (req, res) => {
  try {
    const buses = await prisma.bus.findMany({
      where: { isActive: true },
      orderBy: { busNumber: "asc" },
    });
    res.json(buses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/buses/:id - Get a single bus
router.get("/:id", async (req, res) => {
  try {
    const bus = await prisma.bus.findUnique({
      where: { id: req.params.id },
    });
    if (!bus) {
      return res.status(404).json({ error: "Bus not found" });
    }
    res.json(bus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buses - Add a new bus (Admin only)
router.post("/", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { busNumber, capacity } = req.body;
    if (!busNumber) {
      return res.status(400).json({ error: "busNumber is required" });
    }

    // Check if bus number already exists
    const existingBus = await prisma.bus.findUnique({ where: { busNumber } });
    if (existingBus) {
      // If the bus exists but is inactive, reactivate it
      if (!existingBus.isActive) {
        const reactivated = await prisma.bus.update({
          where: { id: existingBus.id },
          data: { isActive: true, capacity: capacity || existingBus.capacity },
        });
        return res.status(200).json(reactivated);
      }
      return res.status(400).json({ error: "Bus number already exists" });
    }

    const newBus = await prisma.bus.create({
      data: {
        busNumber,
        capacity: capacity ? parseInt(capacity, 10) : 40,
        isActive: true,
      },
    });
    res.status(201).json(newBus);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/buses/:id - Update bus (Admin only)
router.put("/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { busNumber, capacity, isActive } = req.body;
    const updated = await prisma.bus.update({
      where: { id: req.params.id },
      data: {
        busNumber,
        capacity: capacity ? parseInt(capacity, 10) : undefined,
        isActive,
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/buses/:id - Soft delete bus (Admin only)
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const deleted = await prisma.bus.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ message: "Bus deleted successfully", bus: deleted });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
