import React, { useEffect, useState } from "react";
import BusCard from "../components/BusCard";
import toast, { Toaster } from "react-hot-toast";
import TrackShuttle from "./TrackShuttle";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, User, Bus, Phone, MapPin, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import useGPSBroadcast from "../hooks/useGPSBroadcast";

const BACKEND_URL = import.meta.env.VITE_API_URL;

export default function Driver() {
  const { user, token, logout } = useAuth();
  const { socket } = useSocket();

  const [activeShift, setActiveShift] = useState(null);
  const [fetchingShift, setFetchingShift] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());
  const [queueStatus, setQueueStatus] = useState({ ys1Count: 0, ys2Count: 0, totalCount: 0 });

  // Fetch queue status and listen to real-time updates
  useEffect(() => {
    if (!token) return;

    const fetchQueueStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/dispatch/queue-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setQueueStatus(data);
        }
      } catch (err) {
        console.error("Failed to fetch queue status:", err);
      }
    };

    fetchQueueStatus();

    if (!socket) return;

    const onQueueUpdate = (data) => {
      setQueueStatus(data);
    };

    const onStateChange = (data) => {
      // Update the active shift state when it changes on the backend
      setActiveShift((prev) => {
        if (!prev || prev.id !== data.shiftId) return prev;
        return { ...prev, state: data.toState };
      });
      toast.success(data.message || `Status updated to: ${data.toState.replace("_", " ")}`);
    };

    const onDispatchTriggered = (data) => {
      toast.success(
        `DISPATCH TRIGGERED! Route to Hostel. (${data.studentCount} students waiting)`,
        { duration: 10000, icon: "🚀" }
      );
    };

    socket.on("queue:update", onQueueUpdate);
    socket.on("bus:state-change", onStateChange);
    socket.on("dispatch:triggered", onDispatchTriggered);
    
    return () => {
      socket.off("queue:update", onQueueUpdate);
      socket.off("bus:state-change", onStateChange);
      socket.off("dispatch:triggered", onDispatchTriggered);
    };
  }, [token, socket]);

  // Fetch active shift on mount
  useEffect(() => {
    const fetchActiveShift = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${BACKEND_URL}/api/shifts/active`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setActiveShift(data);
          
          // If shift is active, let socket know we are start-broadcasting
          if (data && socket) {
            socket.emit("driver:start-shift", {
              shiftId: data.id,
              busNumber: data.bus?.busNumber || "—"
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch active shift:", err);
      } finally {
        setFetchingShift(false);
      }
    };

    fetchActiveShift();
  }, [token, socket]);

  // Keep date-time clock fresh
  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Set up live GPS broadcasting when activeShift exists!
  const { currentPosition, error: gpsError, isTracking } = useGPSBroadcast(
    socket,
    !!activeShift
  );

  // Handle starting a new shift
  const handleStartShift = async ({ busId }) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/shifts/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ busId }),
      });

      const data = await res.json();
      if (res.ok) {
        setActiveShift(data);
        
        // Emit driver start-shift to Socket.IO
        if (socket) {
          socket.emit("driver:start-shift", {
            shiftId: data.id,
            busNumber: data.bus?.busNumber || "—"
          });
        }
        
        toast.success("Shift started! GPS Broadcasting is now active.");
      } else {
        toast.error(data.error || "Failed to start shift");
      }
    } catch (err) {
      toast.error("Network error starting shift");
    }
  };

  // Handle ending the active shift
  const handleEndShift = async () => {
    if (!window.confirm("Are you sure you want to end your shift?")) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/shifts/end`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        // Emit end shift to Socket.IO
        if (socket) {
          socket.emit("driver:end-shift");
        }
        
        setActiveShift(null);
        toast.success("Shift ended successfully. GPS offline.");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to end shift");
      }
    } catch (err) {
      toast.error("Network error ending shift");
    }
  };

  // Handle state transition manually
  const handleTransitionState = async (newState) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/shifts/transition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ toState: newState }),
      });

      const data = await res.json();
      if (res.ok) {
        setActiveShift((prev) => prev ? { ...prev, state: newState } : null);
        toast.success(`Transitioned to: ${newState.replace("_", " ")}`);
      } else {
        toast.error(data.error || "Failed to transition state");
      }
    } catch (err) {
      toast.error("Network error transitioning state");
    }
  };

  if (fetchingShift) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={36} className="animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-semibold">Loading Driver Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-8 px-4 flex flex-col justify-start">
      <Toaster position="top-right" reverseOrder={false} />

      {/* Welcome & Live Time Banner */}
      <div className="max-w-5xl mx-auto w-full mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient">
            Driver Hub
          </h1>
          <p className="text-sm text-muted-foreground font-semibold mt-1">
            Welcome back, <span className="text-foreground">{user?.name || "Driver"}</span>
          </p>
        </div>
        <div className="glass-panel py-2.5 px-5 rounded-2xl border border-white/10 shadow-lg text-right hidden sm:block">
          <p className="text-xs text-muted-foreground font-bold tracking-wider uppercase">Current Server Time</p>
          <p className="text-lg font-mono font-black text-foreground mt-0.5">
            {dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Main Console Grid */}
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col justify-start gap-8">
        <BusCard
          driverName={user?.name}
          busNo={activeShift?.bus?.busNumber}
          mobileNo={user?.mobileNumber}
          licenseNo={user?.licenseNumber}
          activeShift={activeShift}
          onStartShift={handleStartShift}
          onEndShift={handleEndShift}
          onTransitionState={handleTransitionState}
          isTracking={isTracking}
          gpsError={gpsError}
          queueStatus={queueStatus}
        />

        {/* Live map rendering for Driver reference */}
        {activeShift && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 w-full"
          >
            <div className="glass-panel p-4 rounded-3xl border border-white/10 shadow-2xl overflow-hidden h-[450px]">
              <TrackShuttle driverLocation={currentPosition} />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
