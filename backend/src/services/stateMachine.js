/**
 * @module services/stateMachine
 * @description Finite-state machine for a shuttle bus shift lifecycle.
 *   Validates transitions, persists new state to MongoDB via Prisma,
 *   and broadcasts changes over Socket.IO.
 */

"use strict";

const prisma = require("../lib/prisma");

// ── State constants ─────────────────────────────────────────────────────────
/**
 * All valid bus shift states.
 * @readonly
 * @enum {string}
 */
const STATES = {
  IDLE: "Idle",
  EN_ROUTE_YS2: "En_Route_YS2",
  WAITING_YS2: "Waiting_YS2",
  EN_ROUTE_YS1: "En_Route_YS1",
  WAITING_YS1: "Waiting_YS1",
  RETURNING_COLLEGE: "Returning_College",
};

// ── Transition map ──────────────────────────────────────────────────────────
/**
 * Allowed state transitions.
 * Key = current state, Value = the only valid next state.
 *
 * @readonly
 * @type {Object<string, string>}
 */
const TRANSITIONS = {
  [STATES.IDLE]: STATES.EN_ROUTE_YS2,
  [STATES.EN_ROUTE_YS2]: STATES.WAITING_YS2,
  [STATES.WAITING_YS2]: STATES.EN_ROUTE_YS1,
  [STATES.EN_ROUTE_YS1]: STATES.WAITING_YS1,
  [STATES.WAITING_YS1]: STATES.RETURNING_COLLEGE,
  [STATES.RETURNING_COLLEGE]: STATES.IDLE,
};

// ── Human-readable status messages ──────────────────────────────────────────
/** @type {Object<string, string>} */
const STATUS_MESSAGES = {
  [STATES.IDLE]: "Bus is idle at the college",
  [STATES.EN_ROUTE_YS2]: "Bus is en route to YS2",
  [STATES.WAITING_YS2]: "Bus waiting at YS2 — board now!",
  [STATES.EN_ROUTE_YS1]: "Bus is en route to YS1",
  [STATES.WAITING_YS1]: "Bus waiting at YS1 — board now!",
  [STATES.RETURNING_COLLEGE]: "Bus is returning to the college",
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Check whether a state transition is valid.
 *
 * @param {string} fromState - The current state of the shift.
 * @param {string} toState   - The desired next state.
 * @returns {boolean} `true` if the transition is allowed.
 */
function canTransition(fromState, toState) {
  return TRANSITIONS[fromState] === toState;
}

/**
 * Execute a state transition for a shift.
 *
 * 1. Fetches the current shift from the DB to read its state.
 * 2. Validates the requested transition.
 * 3. Persists the new state via Prisma.
 * 4. Broadcasts a `bus:state-change` event through Socket.IO.
 *
 * @param {string} shiftId - The Prisma ObjectId of the Shift document.
 * @param {string} toState - The desired next state.
 * @param {import("socket.io").Server} io - The Socket.IO server instance.
 * @returns {Promise<Object>} The updated Shift document.
 * @throws {Error} If the shift is not found or the transition is invalid.
 */
async function transition(shiftId, toState, io) {
  // 1. Load current shift
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) {
    throw new Error(`Shift not found: ${shiftId}`);
  }

  // 2. Validate
  const fromState = shift.state;
  if (!canTransition(fromState, toState)) {
    throw new Error(
      `Invalid state transition: "${fromState}" → "${toState}". ` +
        `Allowed next state from "${fromState}" is "${TRANSITIONS[fromState] || "none"}".`
    );
  }

  // 3. Persist
  const updatedShift = await prisma.shift.update({
    where: { id: shiftId },
    data: { state: toState },
  });

  // 4. Broadcast
  if (io) {
    io.emit("bus:state-change", {
      shiftId: updatedShift.id,
      busId: updatedShift.busId,
      driverId: updatedShift.driverId,
      fromState,
      toState,
      message: getStatusMessage(toState),
      timestamp: new Date().toISOString(),
    });
  }

  return updatedShift;
}

/**
 * Get a human-readable status message for a given state.
 *
 * @param {string} state - One of the {@link STATES} values.
 * @returns {string} A user-friendly description of the state.
 */
function getStatusMessage(state) {
  return STATUS_MESSAGES[state] || `Unknown state: ${state}`;
}

// ── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  STATES,
  TRANSITIONS,
  canTransition,
  transition,
  getStatusMessage,
};
