const express = require("express");
const rateLimit = require("express-rate-limit");
const { authenticate, requireRole } = require("../middleware/auth");
const { getIO } = require("../socket");
const dispatchManager = require("../services/dispatchManager");
const { updateShiftState } = require("../socket");
const router = express.Router();

// ── Rate Limiter ────────────────────────────────────────────────────────────
// Prevent a single student from spamming the request endpoint.
const requestLimiter = rateLimit({
  windowMs: 60_000, // 1 minute window
  max: 5,           // max 5 attempts per student per minute
  keyGenerator: (req) => req.userId,
  message: { error: "Too many requests. Please wait before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

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
// Rate-limited to prevent spam. Duplicate detection is atomic inside the transaction.
router.post("/request", authenticate, requireRole("student"), requestLimiter, async (req, res) => {
  const { hostel } = req.body;
  if (!hostel || !["YS1", "YS2"].includes(hostel)) {
    return res.status(400).json({ error: "Invalid hostel selection. Must be YS1 or YS2." });
  }

  try {
    const io = getIO();
    const result = await dispatchManager.addRequest(
      req.userId,
      hostel,
      io,
      // onDispatchStateSync callback — syncs the in-memory driver location state
      (shiftId, newState) => {
        updateShiftState(shiftId, newState);
      }
    );
    res.status(201).json(result.request);
  } catch (err) {
    // Handle the DUPLICATE_REQUEST error from the atomic transaction check
    if (err.code === "DUPLICATE_REQUEST") {
      return res.status(400).json({
        error: "You already have an active request",
        request: err.existingRequest,
      });
    }
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
