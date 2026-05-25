import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bus, X, Users, AlertCircle, CheckCircle } from "lucide-react";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL;

export default function RequestBusPanel() {
  const { socket, isConnected } = useSocket();
  const { token } = useAuth();
  
  const [hostel, setHostel] = useState("YS2");
  const [myRequest, setMyRequest] = useState(null);
  const [queueStatus, setQueueStatus] = useState({ ys1Count: 0, ys2Count: 0, totalCount: 0 });
  const [isRequesting, setIsRequesting] = useState(false);
  const [dispatchCelebration, setDispatchCelebration] = useState(false);

  // 1. Fetch active request and initial queue status on mount
  useEffect(() => {
    if (!token) return;

    const initData = async () => {
      try {
        // Fetch student's request status
        const reqRes = await fetch(`${API_URL}/api/dispatch/my-request`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (reqRes.ok) {
          const reqData = await reqRes.json();
          setMyRequest(reqData);
        }

        // Fetch queue status
        const queueRes = await fetch(`${API_URL}/api/dispatch/queue-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (queueRes.ok) {
          const queueData = await queueRes.json();
          setQueueStatus(queueData);
        }
      } catch (err) {
        console.error("[RequestBusPanel] Error initializing data:", err);
      }
    };

    initData();
  }, [token]);

  // 2. Set up socket listeners
  useEffect(() => {
    if (!socket) return;

    // Listen to queue status updates
    const onQueueUpdate = (data) => {
      setQueueStatus(data);
    };

    // Listen to dispatch event triggers
    const onDispatchTriggered = (data) => {
      toast.success("🚨 Shuttle dispatched! A bus is en route!", {
        duration: 8000,
        icon: "🚌",
      });
      setDispatchCelebration(true);
      setMyRequest(null); // Clear active request state as it is now assigned/completed
      
      // End celebration after 6 seconds
      setTimeout(() => {
        setDispatchCelebration(false);
      }, 6000);
    };

    socket.on("queue:update", onQueueUpdate);
    socket.on("dispatch:triggered", onDispatchTriggered);

    return () => {
      socket.off("queue:update", onQueueUpdate);
      socket.off("dispatch:triggered", onDispatchTriggered);
    };
  }, [socket]);

  // 3. Handle Request
  const handleRequestBus = async () => {
    if (!token) return;
    setIsRequesting(true);

    try {
      const res = await fetch(`${API_URL}/api/dispatch/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hostel }),
      });

      const data = await res.json();
      if (res.ok) {
        setMyRequest(data);
        toast.success(`Successfully requested shuttle to ${hostel}!`);
      } else {
        // Handle duplicate request — re-sync UI state with server
        if (data.error === "You already have an active request" && data.request) {
          setMyRequest(data.request);
          toast("You already have an active request.", { icon: "ℹ️" });
        } else if (res.status === 429) {
          toast.error("Too many requests. Please wait a moment.");
        } else {
          toast.error(data.error || "Failed to request shuttle");
        }
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsRequesting(false);
    }
  };


  // 4. Handle Cancel
  const handleCancelRequest = async () => {
    if (!token) return;
    setIsRequesting(true);

    try {
      const res = await fetch(`${API_URL}/api/dispatch/request`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok) {
        setMyRequest(null);
        toast.success("Your request has been cancelled.");
      } else {
        toast.error(data.error || "Failed to cancel request");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsRequesting(false);
    }
  };

  const progress = Math.min(100, (queueStatus.totalCount / 10) * 100);

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden max-w-md mx-auto">
      {/* Background visual glowing blur */}
      <div className="absolute -top-12 -left-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl">
              <Bus size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">On-Demand Dispatch</h3>
              <p className="text-xs text-muted-foreground font-medium">Request a shuttle during off-hours</p>
            </div>
          </div>
          <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${isConnected ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            {isConnected ? "Live" : "Offline"}
          </div>
        </div>

        {/* Dispatch Celebration Alert */}
        <AnimatePresence>
          {dispatchCelebration && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: -10 }}
              className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-start gap-3"
            >
              <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={18} />
              <div>
                <h4 className="text-sm font-bold text-emerald-400">Shuttle Dispatched!</h4>
                <p className="text-xs text-emerald-300/80 font-medium mt-1">
                  10+ students requested. A bus has transitioned states and is coming to pick you up!
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Queue Status Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
              <Users size={16} />
              Queue Status
            </span>
            <span className="font-bold text-foreground">
              {queueStatus.totalCount} / 10 requests
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-3 w-full bg-white/5 border border-white/5 rounded-full overflow-hidden p-0.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={`h-full rounded-full bg-gradient-to-r ${
                progress >= 100
                  ? "from-emerald-500 to-green-400"
                  : "from-blue-600 to-indigo-500"
              }`}
            />
          </div>

          {/* Queue Breakdowns */}
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-1 mt-1">
            <span>YS1 Stop: {queueStatus.ys1Count} waiting</span>
            <span>YS2 Stop: {queueStatus.ys2Count} waiting</span>
          </div>
        </div>

        {/* Dynamic Panel Content based on request status */}
        <AnimatePresence mode="wait">
          {myRequest ? (
            <motion.div
              key="active-request"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Waiting status card */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
                <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="text-sm font-bold text-blue-400">Request Pending</h4>
                  <p className="text-xs text-blue-300/80 font-semibold mt-1">
                    Requested for stopping at <span className="text-white font-bold">{myRequest.hostel}</span>. 
                    Your request was recorded. As soon as the queue hits 10 students (or 20 mins pass), a bus will be dispatched.
                  </p>
                </div>
              </div>

              {/* Cancel Request Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCancelRequest}
                disabled={isRequesting}
                className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/35 border border-red-500/20 hover:border-red-500/40 text-red-400 font-bold rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <X size={16} />
                Cancel Request
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="no-request"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Hostel Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                  Select Pickup Location
                </label>
                <div className="grid grid-cols-2 gap-3 p-1 bg-white/5 border border-white/5 rounded-2xl">
                  {["YS2", "YS1"].map((stop) => (
                    <button
                      key={stop}
                      type="button"
                      onClick={() => setHostel(stop)}
                      className={`py-2.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
                        hostel === stop
                          ? "bg-white text-black shadow-lg"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      }`}
                    >
                      {stop === "YS2" ? "YS2 Stop (1km)" : "YS1 Stop (Further)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Request Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRequestBus}
                disabled={isRequesting}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white font-extrabold rounded-2xl shadow-xl shadow-blue-500/25 transition-all duration-300 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Bus size={18} />
                {isRequesting ? "Submitting..." : `Request Bus to ${hostel}`}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
