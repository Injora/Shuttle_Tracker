// ──────────────────────────────────────────────────────────
// Socket.IO server for real-time shuttle tracking
// Handles: driver location broadcasts, student subscriptions,
//          dispatch events, countdown timers, state changes
// ──────────────────────────────────────────────────────────

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const prisma = require("./lib/prisma");
const stateMachine = require("./services/stateMachine");
const geofence = require("./services/geofence");
const timerManager = require("./services/timerManager");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

/** @type {Server} */
let io = null;

/**
 * In-memory store for active driver locations.
 * Keyed by shiftId for identity-based tracking (not socket ID).
 * { shiftId: { latitude, longitude, heading, speed, busNumber, state, lastUpdate, dirty, disconnected } }
 */
const driverLocations = new Map();

/**
 * Map of driverId → socketId for targeted messaging.
 */
const driverSockets = new Map();

// Helper transition functions declared upfront
async function triggerWaitingYS2(shiftId) {
  try {
    timerManager.cancelCountdown(shiftId);
    await stateMachine.transition(shiftId, stateMachine.STATES.WAITING_YS2, io);
    updateShiftState(shiftId, stateMachine.STATES.WAITING_YS2);
    
    // Start 5-minute countdown (300000ms)
    timerManager.startCountdown(shiftId, "YS2", timerManager.DEFAULT_COUNTDOWN_MS, io, async () => {
      try {
        console.log(`[Timer] YS2 countdown expired. Auto-transitioning to En_Route_YS1.`);
        timerManager.cancelCountdown(shiftId);
        await stateMachine.transition(shiftId, stateMachine.STATES.EN_ROUTE_YS1, io);
        updateShiftState(shiftId, stateMachine.STATES.EN_ROUTE_YS1);
      } catch (err) {
        console.error("[Timer] Failed YS1 transition on YS2 expiry:", err.message);
      }
    });
  } catch (err) {
    console.error("[Geofence/Manual] Transition to Waiting_YS2 failed:", err.message);
  }
}

async function triggerWaitingYS1(shiftId) {
  try {
    timerManager.cancelCountdown(shiftId);
    await stateMachine.transition(shiftId, stateMachine.STATES.WAITING_YS1, io);
    updateShiftState(shiftId, stateMachine.STATES.WAITING_YS1);
    
    // Start 5-minute countdown (300000ms)
    timerManager.startCountdown(shiftId, "YS1", timerManager.DEFAULT_COUNTDOWN_MS, io, async () => {
      try {
        console.log(`[Timer] YS1 countdown expired. Auto-transitioning to Returning_College.`);
        timerManager.cancelCountdown(shiftId);
        await stateMachine.transition(shiftId, stateMachine.STATES.RETURNING_COLLEGE, io);
        updateShiftState(shiftId, stateMachine.STATES.RETURNING_COLLEGE);
      } catch (err) {
        console.error("[Timer] Failed College transition on YS1 expiry:", err.message);
      }
    });
  } catch (err) {
    console.error("[Geofence/Manual] Transition to Waiting_YS1 failed:", err.message);
  }
}

async function triggerIdle(shiftId) {
  try {
    timerManager.cancelCountdown(shiftId);
    await stateMachine.transition(shiftId, stateMachine.STATES.IDLE, io);
    updateShiftState(shiftId, stateMachine.STATES.IDLE);
  } catch (err) {
    console.error("[Geofence/Manual] Transition to Idle failed:", err.message);
  }
}

async function triggerManualTransition(shiftId, toState) {
  timerManager.cancelCountdown(shiftId);
  if (toState === stateMachine.STATES.WAITING_YS2) {
    await triggerWaitingYS2(shiftId);
  } else if (toState === stateMachine.STATES.WAITING_YS1) {
    await triggerWaitingYS1(shiftId);
  } else if (toState === stateMachine.STATES.IDLE) {
    await triggerIdle(shiftId);
  } else {
    // Normal state transition without custom timers
    await stateMachine.transition(shiftId, toState, io);
    updateShiftState(shiftId, toState);
  }
}

// ── Connection health enrichment ──────────────────────────────────────────
/**
 * Enrich a location entry with connection health metadata.
 * Used so the client can display stale/lost indicators and interpolate.
 *
 * @param {Object} loc - Location data from driverLocations Map.
 * @returns {Object} Enriched location data with connectionHealth and lastSeenAgo.
 */
function enrichLocationData(loc) {
  const staleSec = (Date.now() - loc.lastUpdate) / 1000;
  return {
    ...loc,
    connectionHealth: staleSec < 10 ? "live" : staleSec < 30 ? "stale" : "lost",
    lastSeenAgo: Math.round(staleSec),
  };
}

/**
 * Initialize the Socket.IO server with authentication and event handlers.
 * @param {import('http').Server} server
 * @returns {Server}
 */
function setupSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",").map((o) =>
            o.trim().replace(/\/$/, ""),
          )
        : ["http://localhost:5173", "https://shuttle-tracker-eta.vercel.app"],
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // ── Authentication middleware ────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.userEmail = decoded.email;
      next();
    } catch (err) {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `[Socket] ${socket.userRole} connected: ${socket.userEmail} (${socket.id})`,
    );

    // Join role-based rooms
    socket.join(`role:${socket.userRole}`);
    socket.join(`user:${socket.userId}`);

    // ── Driver Events ───────────────────────────────────────

    /**
     * Driver starts broadcasting location.
     * Expects: { shiftId, busNumber }
     */
    socket.on("driver:start-shift", (data) => {
      const { shiftId, busNumber } = data;
      if (socket.userRole !== "driver") return;

      socket.shiftId = shiftId;
      socket.busNumber = busNumber;
      driverSockets.set(socket.userId, socket.id);

      // Join shift-specific room for targeted broadcasts
      socket.join(`shift:${shiftId}`);

      console.log(
        `[Socket] Driver ${socket.userEmail} started shift ${shiftId} on bus ${busNumber}`,
      );
    });

    /**
     * Driver sends location update.
     * Expects: { latitude, longitude, heading, speed }
     * This is called every ~3 seconds from the client GPS watch.
     */
    socket.on("driver:location-update", async (data) => {
      if (socket.userRole !== "driver" || !socket.shiftId) return;

      const { latitude, longitude, heading, speed } = data;
      const shiftId = socket.shiftId;
      const busNumber = socket.busNumber;

      // Fetch or default current state
      const currentLoc = driverLocations.get(shiftId);
      let currentState = currentLoc?.state;
      if (!currentState) {
        try {
          const dbShift = await prisma.shift.findUnique({ where: { id: shiftId } });
          currentState = dbShift?.state || "Idle";
        } catch (dbErr) {
          console.error(`[Socket] Failed to fetch shift state from DB for recovery:`, dbErr.message);
          currentState = "Idle";
        }
      }

      // Update in-memory location store
      const locationData = {
        shiftId,
        busNumber,
        latitude,
        longitude,
        heading: heading || 0,
        speed: speed || 0,
        state: currentState,
        lastUpdate: Date.now(),
        driverEmail: socket.userEmail,
        dirty: true, // Mark for batched DB persistence
        disconnected: false,
      };

      driverLocations.set(shiftId, locationData);

      // Broadcast to all students (with connection health enrichment)
      io.to("role:student").emit("bus:location", enrichLocationData(locationData));

      // ── Geofence Engine / Auto-Transitions ──────────────────
      try {
        if (currentState === stateMachine.STATES.EN_ROUTE_YS2) {
          if (geofence.isInZone(latitude, longitude, "YS2")) {
            console.log(`[Geofence] Shift ${shiftId} entered YS2. Auto-transitioning.`);
            await triggerWaitingYS2(shiftId);
          }
        } else if (currentState === stateMachine.STATES.EN_ROUTE_YS1) {
          if (geofence.isInZone(latitude, longitude, "YS1")) {
            console.log(`[Geofence] Shift ${shiftId} entered YS1. Auto-transitioning.`);
            await triggerWaitingYS1(shiftId);
          }
        } else if (currentState === stateMachine.STATES.RETURNING_COLLEGE) {
          if (geofence.isInZone(latitude, longitude, "COLLEGE")) {
            console.log(`[Geofence] Shift ${shiftId} entered COLLEGE. Auto-transitioning to Idle.`);
            await triggerIdle(shiftId);
          }
        }
      } catch (geofenceErr) {
        console.error("[Geofence Engine] Error processing live coordinates:", geofenceErr.message);
      }
    });

    /**
     * Driver ends their shift.
     */
    socket.on("driver:end-shift", () => {
      if (socket.userRole !== "driver" || !socket.shiftId) return;

      const shiftId = socket.shiftId;
      console.log(
        `[Socket] Driver ${socket.userEmail} ended shift ${shiftId}`,
      );

      timerManager.cancelCountdown(shiftId);
      driverLocations.delete(shiftId);
      driverSockets.delete(socket.userId);
      socket.leave(`shift:${shiftId}`);

      // Notify students this bus is no longer active
      io.to("role:student").emit("bus:offline", { shiftId });

      socket.shiftId = null;
      socket.busNumber = null;
    });

    // ── Student Events ──────────────────────────────────────

    /**
     * Student subscribes to live tracking updates.
     * They're already in role:student room, so they get all bus:location events.
     */
    socket.on("student:subscribe-tracking", () => {
      // Send current snapshot of all active bus locations (with health enrichment)
      const activeLocations = Array.from(driverLocations.values())
        .filter((loc) => !loc.disconnected || Date.now() - loc.lastUpdate < 60000)
        .map(enrichLocationData);
      socket.emit("bus:all-locations", activeLocations);
    });

    // ── Disconnect ──────────────────────────────────────────

    socket.on("disconnect", (reason) => {
      console.log(
        `[Socket] ${socket.userRole} disconnected: ${socket.userEmail} (${reason})`,
      );

      // If a driver disconnects but doesn't explicitly end shift,
      // mark their location as stale but don't delete yet (they might reconnect)
      if (socket.userRole === "driver" && socket.shiftId) {
        const loc = driverLocations.get(socket.shiftId);
        if (loc) {
          loc.lastUpdate = Date.now();
          loc.disconnected = true;
          // Notify students of driver connection drop
          io.to("role:student").emit("bus:connection-lost", {
            shiftId: socket.shiftId,
            busNumber: socket.busNumber,
          });
        }
        driverSockets.delete(socket.userId);
      }
    });
  });

  // ── Periodic Broadcasts ─────────────────────────────────
  // Broadcast full location snapshot every 5 seconds as a fallback
  // (individual updates are sent on each driver:location-update)
  setInterval(() => {
    const activeLocations = Array.from(driverLocations.values())
      .filter((loc) => !loc.disconnected || Date.now() - loc.lastUpdate < 30000)
      .map(enrichLocationData);

    // Clean up stale disconnected entries (>60 seconds)
    for (const [shiftId, loc] of driverLocations.entries()) {
      if (loc.disconnected && Date.now() - loc.lastUpdate > 60000) {
        timerManager.cancelCountdown(shiftId);
        driverLocations.delete(shiftId);
        io.to("role:student").emit("bus:offline", { shiftId });
      }
    }

    if (activeLocations.length > 0) {
      io.to("role:student").emit("bus:all-locations", activeLocations);
    }
  }, 5000);

  // ── Batched GPS Persistence ─────────────────────────────
  // Write dirty GPS coordinates to MongoDB every 15 seconds.
  // This avoids hammering the DB on every 3-second location update
  // while ensuring positions survive server restarts.
  setInterval(async () => {
    for (const [shiftId, loc] of driverLocations.entries()) {
      if (loc.dirty && !loc.disconnected) {
        try {
          await prisma.shift.update({
            where: { id: shiftId },
            data: {
              latitude: loc.latitude,
              longitude: loc.longitude,
              heading: loc.heading,
              speed: loc.speed,
              lastGpsAt: new Date(loc.lastUpdate),
            },
          });
          loc.dirty = false;
        } catch (err) {
          console.error(`[GPS Persist] Failed for shift ${shiftId}:`, err.message);
        }
      }
    }
  }, 15_000);

  return io;
}

/**
 * Get the Socket.IO server instance.
 * @returns {Server}
 */
function getIO() {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call setupSocket() first.");
  }
  return io;
}

/**
 * Update the in-memory state for a shift (called by stateMachine on transitions).
 * @param {string} shiftId
 * @param {string} newState
 */
function updateShiftState(shiftId, newState) {
  const loc = driverLocations.get(shiftId);
  if (loc) {
    loc.state = newState;
  }
}

module.exports = {
  setupSocket,
  getIO,
  driverLocations,
  driverSockets,
  updateShiftState,
  triggerWaitingYS2,
  triggerWaitingYS1,
  triggerIdle,
  triggerManualTransition,
};
