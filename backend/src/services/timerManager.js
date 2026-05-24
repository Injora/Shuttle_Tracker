/**
 * @module services/timerManager
 * @description Manages countdown timers (per-stop wait timers) and a
 *   periodic timeout checker that triggers an automatic dispatch when
 *   student requests have been waiting too long.
 */

"use strict";

const prisma = require("../lib/prisma");

// ── Constants ───────────────────────────────────────────────────────────────
/** Default countdown duration in milliseconds (5 minutes). */
const DEFAULT_COUNTDOWN_MS = 300_000;

/** How often the timeout checker polls the DB (ms). */
const TIMEOUT_CHECK_INTERVAL_MS = 60_000;

/** Threshold age (in ms) for the oldest waiting request before auto-dispatch. */
const TIMEOUT_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes

// ── Internal state ──────────────────────────────────────────────────────────

/**
 * Active countdown timers keyed by shiftId.
 * Each value is `{ intervalId, expiresAt, stopName }`.
 *
 * @type {Map<string, { intervalId: NodeJS.Timeout, expiresAt: number, stopName: string }>}
 */
const activeTimers = new Map();

/** Interval ID for the periodic timeout checker (or `null`). */
let timeoutCheckerIntervalId = null;

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Start a countdown timer for a shift at a particular stop.
 *
 * Every second the timer broadcasts a `bus:countdown` event with the
 * remaining seconds.  When it reaches zero, `onExpiry` is invoked and the
 * timer is cleaned up automatically.
 *
 * @param {string} shiftId     - Shift document ID.
 * @param {string} stopName    - Human-readable stop name (e.g. `"YS2"`).
 * @param {number} durationMs  - Total countdown duration in milliseconds.
 * @param {import("socket.io").Server} io - Socket.IO server instance.
 * @param {Function} onExpiry  - Callback invoked once the countdown reaches zero.
 * @returns {void}
 */
function startCountdown(shiftId, stopName, durationMs, io, onExpiry) {
  // Cancel any existing timer for this shift first
  cancelCountdown(shiftId);

  const expiresAt = Date.now() + durationMs;

  const intervalId = setInterval(() => {
    const remainingMs = expiresAt - Date.now();
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

    // Broadcast tick
    if (io) {
      io.emit("bus:countdown", {
        shiftId,
        stopName,
        remainingSeconds,
      });
    }

    // Timer expired
    if (remainingMs <= 0) {
      cancelCountdown(shiftId);

      try {
        if (typeof onExpiry === "function") {
          onExpiry();
        }
      } catch (err) {
        console.error(
          `[timerManager] onExpiry callback error for shift ${shiftId}:`,
          err
        );
      }
    }
  }, 1000);

  activeTimers.set(shiftId, { intervalId, expiresAt, stopName });
}

/**
 * Cancel a running countdown timer for a shift.
 *
 * @param {string} shiftId - Shift document ID.
 * @returns {void}
 */
function cancelCountdown(shiftId) {
  const timer = activeTimers.get(shiftId);
  if (timer) {
    clearInterval(timer.intervalId);
    activeTimers.delete(shiftId);
  }
}

/**
 * Get the remaining seconds on a countdown timer.
 *
 * @param {string} shiftId - Shift document ID.
 * @returns {number|null} Remaining seconds, or `null` if no active timer.
 */
function getRemaining(shiftId) {
  const timer = activeTimers.get(shiftId);
  if (!timer) {
    return null;
  }
  const remainingMs = timer.expiresAt - Date.now();
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/**
 * Start the periodic timeout checker.
 *
 * Every 60 seconds the checker queries the oldest **waiting** BusRequest.
 * If that request is ≥ 20 minutes old AND at least one waiting request
 * exists, `dispatchCallback` is invoked so the system can auto-dispatch a
 * bus.
 *
 * @param {import("socket.io").Server} io - Socket.IO server instance (reserved for future use).
 * @param {Function} dispatchCallback - Called when the timeout condition is met.
 * @returns {void}
 */
function startTimeoutChecker(io, dispatchCallback) {
  // Prevent duplicate checkers
  stopTimeoutChecker();

  timeoutCheckerIntervalId = setInterval(async () => {
    try {
      // Find the oldest waiting request
      const oldestRequest = await prisma.busRequest.findFirst({
        where: { status: "waiting" },
        orderBy: { requestedAt: "asc" },
      });

      if (!oldestRequest) {
        return; // Nothing in the queue
      }

      const ageMs = Date.now() - new Date(oldestRequest.requestedAt).getTime();

      if (ageMs >= TIMEOUT_THRESHOLD_MS) {
        // Double-check there is still at least 1 waiting request
        const waitingCount = await prisma.busRequest.count({
          where: { status: "waiting" },
        });

        if (waitingCount >= 1) {
          console.log(
            `[timerManager] Oldest request ${oldestRequest.id} has been waiting ` +
              `${Math.round(ageMs / 60_000)} min — triggering auto-dispatch ` +
              `(${waitingCount} waiting).`
          );

          try {
            if (typeof dispatchCallback === "function") {
              await dispatchCallback();
            }
          } catch (err) {
            console.error(
              "[timerManager] dispatchCallback error:",
              err
            );
          }
        }
      }
    } catch (err) {
      console.error("[timerManager] Timeout checker query error:", err);
    }
  }, TIMEOUT_CHECK_INTERVAL_MS);
}

/**
 * Stop the periodic timeout checker.
 *
 * @returns {void}
 */
function stopTimeoutChecker() {
  if (timeoutCheckerIntervalId !== null) {
    clearInterval(timeoutCheckerIntervalId);
    timeoutCheckerIntervalId = null;
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  DEFAULT_COUNTDOWN_MS,
  startCountdown,
  cancelCountdown,
  getRemaining,
  startTimeoutChecker,
  stopTimeoutChecker,
};
