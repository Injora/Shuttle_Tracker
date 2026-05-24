/**
 * @module services/dispatchManager
 * @description On-demand threshold dispatching engine.
 *   Students create bus requests; once the queue reaches DISPATCH_THRESHOLD
 *   (or a timeout fires), the system atomically assigns all waiting
 *   requests to an idle shift and transitions the bus state.
 */

"use strict";

const prisma = require("../lib/prisma");
const stateMachine = require("./stateMachine");

// ── Constants ───────────────────────────────────────────────────────────────
/** Number of waiting requests that triggers an automatic dispatch. */
const DISPATCH_THRESHOLD = 10;

/** Timeout (in minutes) used for labelling timeout-triggered dispatches. */
const TIMEOUT_MINUTES = 20;

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new bus request for a student and check whether the dispatch
 * threshold has been reached.
 *
 * @param {string} studentId - The ObjectId of the requesting student.
 * @param {string} hostel    - The hostel stop (`"YS1"` or `"YS2"`).
 * @param {import("socket.io").Server} io - Socket.IO server instance.
 * @returns {Promise<Object>} The newly-created BusRequest document.
 * @throws {Error} On database failure.
 */
async function addRequest(studentId, hostel, io) {
  try {
    // Create the request
    const request = await prisma.busRequest.create({
      data: {
        studentId,
        hostel,
        status: "waiting",
      },
    });

    // Count all currently waiting requests
    const totalCount = await prisma.busRequest.count({
      where: { status: "waiting" },
    });

    // Check threshold
    if (totalCount >= DISPATCH_THRESHOLD) {
      console.log(
        `[dispatchManager] Threshold reached (${totalCount}/${DISPATCH_THRESHOLD}) — triggering dispatch.`
      );
      await triggerDispatch("threshold_10", io);
    }

    // Broadcast updated queue status
    const queueStatus = await getQueueStatus();
    if (io) {
      io.emit("queue:update", queueStatus);
    }

    return request;
  } catch (err) {
    console.error("[dispatchManager] addRequest error:", err);
    throw err;
  }
}

/**
 * Cancel a student's active (waiting) bus request.
 *
 * @param {string} studentId - The ObjectId of the student.
 * @param {import("socket.io").Server} io - Socket.IO server instance.
 * @returns {Promise<Object|null>} The updated BusRequest, or `null` if none was found.
 */
async function cancelRequest(studentId, io) {
  try {
    // Find the student's waiting request
    const existing = await prisma.busRequest.findFirst({
      where: {
        studentId,
        status: "waiting",
      },
    });

    if (!existing) {
      console.warn(
        `[dispatchManager] No waiting request found for student ${studentId}.`
      );
      return null;
    }

    const updated = await prisma.busRequest.update({
      where: { id: existing.id },
      data: { status: "cancelled" },
    });

    // Broadcast updated queue status
    const queueStatus = await getQueueStatus();
    if (io) {
      io.emit("queue:update", queueStatus);
    }

    return updated;
  } catch (err) {
    console.error("[dispatchManager] cancelRequest error:", err);
    throw err;
  }
}

/**
 * Return current queue counts for each hostel and total.
 *
 * @returns {Promise<{ ys1Count: number, ys2Count: number, totalCount: number }>}
 */
async function getQueueStatus() {
  try {
    const [ys1Count, ys2Count] = await Promise.all([
      prisma.busRequest.count({
        where: { status: "waiting", hostel: "YS1" },
      }),
      prisma.busRequest.count({
        where: { status: "waiting", hostel: "YS2" },
      }),
    ]);

    return {
      ys1Count,
      ys2Count,
      totalCount: ys1Count + ys2Count,
    };
  } catch (err) {
    console.error("[dispatchManager] getQueueStatus error:", err);
    throw err;
  }
}

/**
 * Get a student's active request (status = `"waiting"` or `"assigned"`).
 *
 * @param {string} studentId - The ObjectId of the student.
 * @returns {Promise<Object|null>} The active BusRequest, or `null`.
 */
async function getStudentRequest(studentId) {
  try {
    const request = await prisma.busRequest.findFirst({
      where: {
        studentId,
        status: { in: ["waiting", "assigned"] },
      },
      orderBy: { requestedAt: "desc" },
    });

    return request || null;
  } catch (err) {
    console.error("[dispatchManager] getStudentRequest error:", err);
    throw err;
  }
}

/**
 * Atomically dispatch a bus to fulfil all waiting requests.
 *
 * Runs inside a Prisma `$transaction` to guarantee atomicity:
 * 1. Find an active shift in `Idle` state.
 * 2. Collect all waiting BusRequests.
 * 3. Create a DispatchEvent record.
 * 4. Mark every waiting request as `assigned`.
 * 5. Transition the shift state to `En_Route_YS2`.
 * 6. Broadcast a `dispatch:triggered` Socket.IO event.
 *
 * @param {string} trigger - Dispatch trigger label (e.g. `"threshold_10"`, `"timeout_20min"`).
 * @param {import("socket.io").Server} io - Socket.IO server instance.
 * @returns {Promise<Object|null>} The created DispatchEvent, or `null` if
 *   no idle shift was available.
 */
async function triggerDispatch(trigger, io) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find an idle shift
      const idleShift = await tx.shift.findFirst({
        where: { state: stateMachine.STATES.IDLE, endedAt: null },
      });

      if (!idleShift) {
        console.warn(
          "[dispatchManager] triggerDispatch: no idle shift available — skipping."
        );
        return null;
      }

      // 2. Collect all waiting requests
      const waitingRequests = await tx.busRequest.findMany({
        where: { status: "waiting" },
      });

      if (waitingRequests.length === 0) {
        console.warn(
          "[dispatchManager] triggerDispatch: no waiting requests — skipping."
        );
        return null;
      }

      const requestIds = waitingRequests.map((r) => r.id);

      // 3. Create DispatchEvent
      const dispatchEvent = await tx.dispatchEvent.create({
        data: {
          shiftId: idleShift.id,
          trigger,
          studentCount: waitingRequests.length,
        },
      });

      // 4. Update all waiting requests → assigned
      const now = new Date();
      await tx.busRequest.updateMany({
        where: { id: { in: requestIds } },
        data: {
          status: "assigned",
          assignedAt: now,
          dispatchId: dispatchEvent.id,
        },
      });

      return { dispatchEvent, idleShift, requestCount: waitingRequests.length };
    });

    // Nothing to do if the transaction short-circuited
    if (!result) {
      return null;
    }

    const { dispatchEvent, idleShift, requestCount } = result;

    // 5. Transition shift state (outside $transaction because stateMachine
    //    manages its own Prisma call and the Socket.IO broadcast)
    try {
      await stateMachine.transition(
        idleShift.id,
        stateMachine.STATES.EN_ROUTE_YS2,
        io
      );
    } catch (transitionErr) {
      // Log but don't crash — the dispatch records are already persisted
      console.error(
        "[dispatchManager] Failed to transition shift after dispatch:",
        transitionErr
      );
    }

    // 6. Broadcast dispatch event
    if (io) {
      io.emit("dispatch:triggered", {
        dispatchId: dispatchEvent.id,
        shiftId: idleShift.id,
        trigger,
        studentCount: requestCount,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(
      `[dispatchManager] Dispatch triggered (${trigger}): ` +
        `shift=${idleShift.id}, students=${requestCount}.`
    );

    return dispatchEvent;
  } catch (err) {
    console.error("[dispatchManager] triggerDispatch error:", err);
    throw err;
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  DISPATCH_THRESHOLD,
  TIMEOUT_MINUTES,
  addRequest,
  cancelRequest,
  getQueueStatus,
  getStudentRequest,
  triggerDispatch,
};
