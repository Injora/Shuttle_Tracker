/**
 * @module services/dispatchManager
 * @description On-demand threshold dispatching engine.
 *   Students create bus requests; once the queue reaches DISPATCH_THRESHOLD
 *   (or a timeout fires), the system atomically assigns all waiting
 *   requests to an idle shift and transitions the bus state.
 *
 *   IMPORTANT: All queue mutations run inside Prisma $transaction to prevent
 *   race conditions when multiple students click "Request" simultaneously.
 *   The circular dependency on ../socket has been removed — io and helper
 *   functions are always passed as parameters from the caller.
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
 * The ENTIRE operation runs inside a Prisma $transaction to prevent race
 * conditions:
 *   1. Atomic duplicate check (prevents double-click / concurrent requests)
 *   2. Create the BusRequest
 *   3. Count all waiting requests
 *   4. If threshold met → run dispatch atomically inside the same transaction
 *
 * @param {string} studentId - The ObjectId of the requesting student.
 * @param {string} hostel    - The hostel stop (`"YS1"` or `"YS2"`).
 * @param {import("socket.io").Server} io - Socket.IO server instance.
 * @param {Function} [onDispatchStateSync] - Optional callback to sync in-memory
 *   driver state after dispatch (avoids circular import of socket module).
 * @returns {Promise<Object>} `{ request, dispatched }`.
 * @throws {Error} `DUPLICATE_REQUEST` if the student already has an active request.
 */
async function addRequest(studentId, hostel, io, onDispatchStateSync) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Atomic duplicate check — inside the transaction so no TOCTOU race
    const existing = await tx.busRequest.findFirst({
      where: {
        studentId,
        status: { in: ["waiting", "assigned"] },
      },
    });

    if (existing) {
      const err = new Error("You already have an active request");
      err.code = "DUPLICATE_REQUEST";
      err.existingRequest = existing;
      throw err;
    }

    // 2. Create the request
    const request = await tx.busRequest.create({
      data: {
        studentId,
        hostel,
        status: "waiting",
      },
    });

    // 3. Count all currently waiting requests (within the same snapshot)
    const totalCount = await tx.busRequest.count({
      where: { status: "waiting" },
    });

    // 4. If threshold reached → dispatch inside the same transaction
    let dispatchResult = null;
    if (totalCount >= DISPATCH_THRESHOLD) {
      console.log(
        `[dispatchManager] Threshold reached (${totalCount}/${DISPATCH_THRESHOLD}) — triggering dispatch.`
      );
      dispatchResult = await _internalDispatch(tx, "threshold_10");
    }

    return { request, totalCount, dispatchResult };
  });

  // ── Post-transaction side effects (Socket.IO broadcasts) ──────────────
  // These happen AFTER the transaction commits, so they reflect committed state.

  // Broadcast updated queue status
  const queueStatus = await getQueueStatus();
  if (io) {
    io.emit("queue:update", queueStatus);
  }

  // If a dispatch happened, perform the state transition and broadcast
  if (result.dispatchResult) {
    const { dispatchEvent, idleShift, requestCount } = result.dispatchResult;

    try {
      await stateMachine.transition(
        idleShift.id,
        stateMachine.STATES.EN_ROUTE_YS2,
        io
      );
      // Sync in-memory driver state (if callback provided)
      if (typeof onDispatchStateSync === "function") {
        onDispatchStateSync(idleShift.id, stateMachine.STATES.EN_ROUTE_YS2);
      }
    } catch (transitionErr) {
      // Log but don't crash — the dispatch records are already persisted
      console.error(
        "[dispatchManager] Failed to transition shift after dispatch:",
        transitionErr
      );
    }

    // Broadcast dispatch event
    if (io) {
      io.emit("dispatch:triggered", {
        dispatchId: dispatchEvent.id,
        shiftId: idleShift.id,
        trigger: "threshold_10",
        studentCount: requestCount,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(
      `[dispatchManager] Dispatch triggered (threshold_10): ` +
        `shift=${idleShift.id}, students=${requestCount}.`
    );
  }

  return { request: result.request, dispatched: !!result.dispatchResult };
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
 * This is the PUBLIC entry point called from the timeout checker and
 * any external trigger. It wraps `_internalDispatch` in its own
 * `$transaction`, then performs side effects (state transition + broadcast).
 *
 * @param {string} trigger - Dispatch trigger label (e.g. `"threshold_10"`, `"timeout_20min"`).
 * @param {import("socket.io").Server} io - Socket.IO server instance.
 * @param {Function} [onDispatchStateSync] - Optional callback to sync in-memory state.
 * @returns {Promise<Object|null>} The created DispatchEvent, or `null` if
 *   no idle shift was available.
 */
async function triggerDispatch(trigger, io, onDispatchStateSync) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      return _internalDispatch(tx, trigger);
    });

    // Nothing to do if the transaction short-circuited
    if (!result) {
      return null;
    }

    const { dispatchEvent, idleShift, requestCount } = result;

    try {
      await stateMachine.transition(
        idleShift.id,
        stateMachine.STATES.EN_ROUTE_YS2,
        io
      );
      // Sync in-memory driver state
      if (typeof onDispatchStateSync === "function") {
        onDispatchStateSync(idleShift.id, stateMachine.STATES.EN_ROUTE_YS2);
      }
    } catch (transitionErr) {
      // Log but don't crash — the dispatch records are already persisted
      console.error(
        "[dispatchManager] Failed to transition shift after dispatch:",
        transitionErr
      );
    }

    // Broadcast dispatch event
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

// ── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Core dispatch logic meant to run INSIDE an existing Prisma transaction.
 *
 * 1. Find an active shift in `Idle` state.
 * 2. Collect all waiting BusRequests.
 * 3. Create a DispatchEvent record.
 * 4. Mark every waiting request as `assigned`.
 *
 * Does NOT perform state transitions or Socket.IO broadcasts — those are
 * side effects that the caller handles AFTER the transaction commits.
 *
 * @param {import("@prisma/client").Prisma.TransactionClient} tx - Transaction client.
 * @param {string} trigger - Dispatch trigger label.
 * @returns {Promise<{ dispatchEvent: Object, idleShift: Object, requestCount: number } | null>}
 * @private
 */
async function _internalDispatch(tx, trigger) {
  // 1. Find an idle shift
  const idleShift = await tx.shift.findFirst({
    where: { state: stateMachine.STATES.IDLE, endedAt: { isSet: false } },
  });

  if (!idleShift) {
    console.warn(
      "[dispatchManager] _internalDispatch: no idle shift available — skipping."
    );
    return null;
  }

  // 2. Collect all waiting requests
  const waitingRequests = await tx.busRequest.findMany({
    where: { status: "waiting" },
  });

  if (waitingRequests.length === 0) {
    console.warn(
      "[dispatchManager] _internalDispatch: no waiting requests — skipping."
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
