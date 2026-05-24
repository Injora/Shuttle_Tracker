const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const { getIO } = require("../socket");
const dispatchManager = require("../services/dispatchManager");
const router = express.Router();

// GET /api/dispatch/queue-status - Get current student waiting counts
router.get("/queue-status", authenticate, async (req, res) => {
  try {
    const queueStatus = await dispatchManager.getQueueStatus();
    res.json(queueStatus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dispatch/my-request - Check if student has an active request
router.get("/my-request", authenticate, requireRole("student"), async (req, res) => {
  try {
    const activeRequest = await dispatchManager.getStudentRequest(req.userId);
    res.json(activeRequest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dispatch/request - Request a bus (Student only)
router.post("/request", authenticate, requireRole("student"), async (req, res) => {
  const { hostel } = req.body;
  if (!hostel || !["YS1", "YS2"].includes(hostel)) {
    return res.status(400).json({ error: "Invalid hostel selection. Must be YS1 or YS2." });
  }

  try {
    // Check if student already has an active request
    const existing = await dispatchManager.getStudentRequest(req.userId);
    if (existing) {
      return res.status(400).json({
        error: "You already have an active request",
        request: existing,
      });
    }

    const io = getIO();
    const request = await dispatchManager.addRequest(req.userId, hostel, io);
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/dispatch/request - Cancel student request (Student only)
router.delete("/request", authenticate, requireRole("student"), async (req, res) => {
  try {
    const io = getIO();
    const request = await dispatchManager.cancelRequest(req.userId, io);
    if (!request) {
      return res.status(404).json({ error: "No active request found to cancel" });
    }
    res.json({ message: "Request cancelled successfully", request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
