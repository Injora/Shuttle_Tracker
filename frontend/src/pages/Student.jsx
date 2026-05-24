import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import RequestBusPanel from "../components/RequestBusPanel";
import CountdownTimer from "../components/CountdownTimer";
import TrackShuttle from "./TrackShuttle";
import { motion, AnimatePresence } from "framer-motion";
import { Map, Clock, AlertCircle } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

export default function Student() {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const [activeShifts, setActiveShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch active fleet on mount
  useEffect(() => {
    if (!token) return;

    const fetchActiveShifts = async () => {
      try {
        const res = await fetch(`${API_URL}/api/shifts/active-fleet`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setActiveShifts(data);
        }
      } catch (err) {
        console.error("Failed to fetch active fleet:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveShifts();
  }, [token]);

  // 2. Listen to real-time socket events for bus status updates
  useEffect(() => {
    if (!socket) return;

    // Join student tracking room
    socket.emit("student:subscribe-tracking");

    const onBusAllLocations = (locations) => {
      setActiveShifts((prev) => {
        // Map locations snapshot and preserve other shift fields
        return locations.map((loc) => {
          const existing = prev.find((s) => s.id === loc.shiftId);
          return {
            ...existing,
            id: loc.shiftId,
            state: loc.state,
            latitude: loc.latitude,
            longitude: loc.longitude,
            heading: loc.heading,
            speed: loc.speed,
            bus: existing?.bus || { busNumber: loc.busNumber },
            remainingSeconds: existing?.remainingSeconds,
            countdownStop: existing?.countdownStop,
          };
        });
      });
    };

    const onBusLocation = (data) => {
      setActiveShifts((prev) => {
        const exists = prev.some((s) => s.id === data.shiftId);
        if (exists) {
          return prev.map((s) =>
            s.id === data.shiftId
              ? {
                  ...s,
                  latitude: data.latitude,
                  longitude: data.longitude,
                  heading: data.heading,
                  speed: data.speed,
                  state: data.state,
                }
              : s
          );
        } else {
          return [
            ...prev,
            {
              id: data.shiftId,
              state: data.state,
              latitude: data.latitude,
              longitude: data.longitude,
              heading: data.heading,
              speed: data.speed,
              bus: { busNumber: data.busNumber },
            },
          ];
        }
      });
    };

    const onBusStateChange = (data) => {
      setActiveShifts((prev) => {
        return prev.map((s) =>
          s.id === data.shiftId
            ? { ...s, state: data.toState, remainingSeconds: null, countdownStop: null }
            : s
        );
      });
    };

    const onBusCountdown = (data) => {
      setActiveShifts((prev) => {
        return prev.map((s) =>
          s.id === data.shiftId
            ? { ...s, remainingSeconds: data.remainingSeconds, countdownStop: data.stopName }
            : s
        );
      });
    };

    const onBusOffline = (data) => {
      setActiveShifts((prev) => prev.filter((s) => s.id !== data.shiftId));
    };

    socket.on("bus:all-locations", onBusAllLocations);
    socket.on("bus:location", onBusLocation);
    socket.on("bus:state-change", onBusStateChange);
    socket.on("bus:countdown", onBusCountdown);
    socket.on("bus:offline", onBusOffline);

    return () => {
      socket.off("bus:all-locations", onBusAllLocations);
      socket.off("bus:location", onBusLocation);
      socket.off("bus:state-change", onBusStateChange);
      socket.off("bus:countdown", onBusCountdown);
      socket.off("bus:offline", onBusOffline);
    };
  }, [socket]);

  // 3. Find any active waiting shift to show its countdown
  const waitingShift = activeShifts.find(
    (s) => (s.state === "Waiting_YS2" || s.state === "Waiting_YS1") && s.remainingSeconds != null
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 py-4 min-h-[90vh]"
    >
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient">
            Student Dashboard
          </h1>
          <p className="text-sm text-muted-foreground font-semibold">
            Track shuttles and request rides in real-time
          </p>
        </div>
      </div>

      {/* Countdown Timer Alert Area */}
      <AnimatePresence>
        {waitingShift && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -20 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -20 }}
            className="flex justify-center"
          >
            <div className="w-full max-w-sm">
              <CountdownTimer
                remainingSeconds={waitingShift.remainingSeconds}
                stopName={waitingShift.countdownStop || (waitingShift.state === "Waiting_YS2" ? "YS2" : "YS1")}
                totalSeconds={300}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid: Left is on-demand controls, right is map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* On Demand panel */}
        <div className="lg:col-span-1 space-y-6">
          <RequestBusPanel />
          
          {/* Active Shuttles status card list */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <h3 className="text-md font-extrabold text-foreground flex items-center gap-2">
              <Clock size={18} className="text-blue-400" />
              Active Shuttles ({activeShifts.length})
            </h3>
            {activeShifts.length === 0 ? (
              <div className="p-4 bg-white/5 rounded-2xl flex items-center gap-3">
                <AlertCircle size={16} className="text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-semibold">
                  No active shuttles currently on shift. Use on-demand request above to call a bus.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {activeShifts.map((s) => (
                  <div key={s.id} className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black">Shuttle {s.bus?.busNumber || "—"}</p>
                      <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                        State: {s.state.replace("_", " ")}
                      </p>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live shuttle map */}
        <div className="lg:col-span-2 h-[550px]">
          <div className="glass-panel p-4 rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden h-full">
            <div className="w-full h-full rounded-2xl overflow-hidden relative">
              <TrackShuttle />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
