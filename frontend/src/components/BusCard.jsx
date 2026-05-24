import React, { useState } from "react";
import {
  Bus,
  User,
  Phone,
  Play,
  Square,
  Navigation,
  Activity,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Compass,
  Users
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STATES = {
  IDLE: "Idle",
  EN_ROUTE_YS2: "En_Route_YS2",
  WAITING_YS2: "Waiting_YS2",
  EN_ROUTE_YS1: "En_Route_YS1",
  WAITING_YS1: "Waiting_YS1",
  RETURNING_COLLEGE: "Returning_College",
};

const TRANSITIONS = {
  [STATES.IDLE]: STATES.EN_ROUTE_YS2,
  [STATES.EN_ROUTE_YS2]: STATES.WAITING_YS2,
  [STATES.WAITING_YS2]: STATES.EN_ROUTE_YS1,
  [STATES.EN_ROUTE_YS1]: STATES.WAITING_YS1,
  [STATES.WAITING_YS1]: STATES.RETURNING_COLLEGE,
  [STATES.RETURNING_COLLEGE]: STATES.IDLE,
};

const STATE_COLORS = {
  [STATES.IDLE]: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  [STATES.EN_ROUTE_YS2]: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  [STATES.WAITING_YS2]: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  [STATES.EN_ROUTE_YS1]: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  [STATES.WAITING_YS1]: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  [STATES.RETURNING_COLLEGE]: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

const STATE_LABELS = {
  [STATES.IDLE]: "Idle at College",
  [STATES.EN_ROUTE_YS2]: "En Route to YS2",
  [STATES.WAITING_YS2]: "Waiting at YS2",
  [STATES.EN_ROUTE_YS1]: "En Route to YS1",
  [STATES.WAITING_YS1]: "Waiting at YS1",
  [STATES.RETURNING_COLLEGE]: "Returning to College",
};

export default function BusCard({
  driverName,
  busNo,
  mobileNo,
  licenseNo,
  activeShift,
  onStartShift,
  onEndShift,
  onTransitionState,
  isTracking,
  gpsError,
  queueStatus
}) {
  const [selectedBusId, setSelectedBusId] = useState("");
  const [buses, setBuses] = useState([]);
  const [loadingBuses, setLoadingBuses] = useState(false);
  const [showDriverInfo, setShowDriverInfo] = useState(false);

  // Load buses list when opening selector
  const fetchBuses = async () => {
    setLoadingBuses(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/buses`);
      if (res.ok) {
        const data = await res.json();
        setBuses(data);
      }
    } catch (err) {
      console.error("Failed to load buses:", err);
    } finally {
      setLoadingBuses(false);
    }
  };

  const handleStartShiftClick = () => {
    if (!selectedBusId) {
      alert("Please select a bus first");
      return;
    }
    onStartShift({ busId: selectedBusId });
  };

  const currentStatusLabel = activeShift
    ? STATE_LABELS[activeShift.state] || activeShift.state
    : "INACTIVE";

  const statusColorClass = activeShift
    ? STATE_COLORS[activeShift.state] || "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
    : "bg-red-500/10 text-red-500 border-red-500/20";

  return (
    <div className="flex flex-col md:flex-row items-stretch justify-center gap-6 transition-all w-full max-w-5xl mx-auto p-4">
      {/* Shift Controls Card */}
      <motion.div layout className="relative w-full max-w-md flex-1">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] blur opacity-25" />
        <div className="relative glass-panel rounded-[2rem] p-6 sm:p-8 overflow-hidden border border-white/20 dark:border-white/10 shadow-2xl h-full flex flex-col justify-between">
          <div>
            {/* Status & Direction Header */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border bg-blue-500/10 text-blue-400 border-blue-500/20">
                <Navigation className="w-3 h-3" />
                <span>Shift Controls</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${statusColorClass}`}>
                <span className={`w-2 h-2 rounded-full ${activeShift ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
                {currentStatusLabel.toUpperCase()}
              </div>
            </div>

            {/* Icon Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 mb-3 transform rotate-3">
                <Bus className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Driver Console
              </h2>
              <p className="text-xs text-gray-500 mt-1">Select a bus and manage your active shift</p>
            </div>

            {/* Geolocation Watcher Status */}
            {activeShift && (
              <div className={`mb-4 p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
                gpsError 
                  ? "bg-red-500/10 text-red-400 border-red-500/25" 
                  : isTracking 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" 
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/25"
              }`}>
                <span className="flex items-center gap-1.5">
                  <Compass size={14} className={isTracking && !gpsError ? "animate-spin" : ""} />
                  GPS Status
                </span>
                <span>{gpsError ? "GPS Error" : isTracking ? "Broadcasting Location..." : "Connecting GPS..."}</span>
              </div>
            )}

            {/* Input & Info Area */}
            <div className="space-y-3 mb-6">
              {!activeShift ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">
                    Select Bus for Shift
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedBusId}
                      onChange={(e) => setSelectedBusId(e.target.value)}
                      onClick={() => buses.length === 0 && fetchBuses()}
                      className="flex-1 px-4 py-3 bg-gray-50/50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                    >
                      <option value="" className="dark:bg-black">-- Select Bus --</option>
                      {buses.map((b) => (
                        <option key={b.id} value={b.id} className="dark:bg-black">
                          Bus {b.busNumber} (Cap: {b.capacity})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={fetchBuses}
                      disabled={loadingBuses}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                    >
                      <RefreshCw size={16} className={loadingBuses ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <InfoCard
                    icon={ShieldCheck}
                    label="Assigned Bus"
                    value={`Bus ${activeShift.bus?.busNumber || busNo || "—"}`}
                    color="text-amber-500"
                  />
                  {queueStatus && (
                    <InfoCard
                      icon={Users}
                      label="Queue Demand"
                      value={`${queueStatus.totalCount} / 10 waiting`}
                      color="text-blue-400"
                    />
                  )}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2.5">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block">
                      Manual State Controls
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(STATES).map(([key, value]) => {
                        const isCurrent = activeShift.state === value;
                        const isValidNext = TRANSITIONS[activeShift.state] === value;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => onTransitionState(value)}
                            disabled={!isValidNext && !isCurrent}
                            className={`py-2 rounded-lg text-xs font-bold border transition-all duration-300 ${
                              isCurrent
                                ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20 cursor-default"
                                : isValidNext
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 cursor-pointer animate-pulse-subtle"
                                  : "bg-white/5 text-muted-foreground/35 border-white/5 opacity-40 cursor-not-allowed"
                            }`}
                          >
                            {STATE_LABELS[value]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Toggle Driver Info Button */}
              <button
                type="button"
                onClick={() => setShowDriverInfo(!showDriverInfo)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/30 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-gray-800 text-blue-400">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Driver Profile
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold">
                  {showDriverInfo ? "Hide" : "View"}
                  {showDriverInfo ? (
                    <ChevronLeft className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Action Shift Controls */}
          <div className="pt-4 border-t border-white/10">
            {!activeShift ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartShiftClick}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold py-3.5 px-6 rounded-xl shadow-xl shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Play className="fill-current w-4 h-4" />
                Start Driver Shift
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onEndShift}
                className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 font-extrabold py-3.5 px-6 rounded-xl transition-all cursor-pointer"
              >
                <Square className="fill-current w-4 h-4" />
                End Driver Shift
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Driver Info Card (Expandable) */}
      <AnimatePresence mode="popLayout">
        {showDriverInfo && (
          <motion.div
            layout
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            className="relative w-full max-w-xs flex-1 hidden md:block"
          >
            <div className="relative glass-panel rounded-[2rem] p-8 border border-white/10 shadow-2xl h-full flex flex-col justify-center">
              <div className="text-center">
                <div className="inline-block p-1 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 mb-4">
                  <div className="p-1 rounded-full bg-white dark:bg-gray-900">
                    <User className="w-16 h-16 text-gray-400 p-2" />
                  </div>
                </div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  {driverName || "Official Driver"}
                </h3>
                <p className="text-xs text-muted-foreground font-semibold">Verified Fleet Crew</p>
              </div>

              <div className="mt-6 space-y-3">
                <InfoCard
                  icon={Phone}
                  label="Contact"
                  value={mobileNo || "—"}
                  color="text-emerald-400"
                />
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs font-semibold text-gray-500 uppercase">
                    License
                  </span>
                  <span className="font-extrabold text-xs text-blue-400">
                    {licenseNo || "Verified"}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const InfoCard = ({ icon: Icon, label, value, color }) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 group">
    <div className="flex items-center gap-2.5">
      <div className={`p-1.5 rounded-lg bg-gray-800 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </span>
    </div>
    <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{value}</span>
  </div>
);
