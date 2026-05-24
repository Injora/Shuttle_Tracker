import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer } from "lucide-react";

/**
 * CountdownTimer — Circular progress countdown visualizer.
 *
 * @param {{ remainingSeconds: number|null, stopName: string, totalSeconds: number }} props
 */
export default function CountdownTimer({ remainingSeconds, stopName, totalSeconds = 300 }) {
  const seconds = remainingSeconds ?? 0;
  const percentage = Math.min(100, Math.max(0, (seconds / totalSeconds) * 100));

  // Determine colors based on remaining seconds
  const getColorClass = () => {
    if (seconds === 0) return "text-red-500 stroke-red-500";
    if (seconds < 60) return "text-red-400 stroke-red-400";
    if (seconds <= 120) return "text-amber-400 stroke-amber-400";
    return "text-emerald-400 stroke-emerald-400";
  };

  const colorClass = getColorClass();

  // Format MM:SS
  const formatTime = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // SVG parameters
  const radius = 70;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="glass-panel p-6 rounded-3xl flex flex-col items-center justify-center max-w-[260px] mx-auto border border-white/10 shadow-2xl relative overflow-hidden">
      {/* Background visual accent */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-secondary/10 rounded-full blur-2xl pointer-events-none" />

      {/* Stop Name Header */}
      <div className="flex items-center gap-2 mb-4">
        <Timer size={16} className="text-muted-foreground" />
        <span className="text-sm font-semibold text-muted-foreground tracking-wider uppercase">
          {stopName} Stop
        </span>
      </div>

      {/* Circular Progress Ring */}
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          {/* Track Ring */}
          <circle
            className="stroke-white/5"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius + stroke}
            cy={radius + stroke}
          />
          {/* Progress Ring */}
          <motion.circle
            className={`transition-all duration-1000 ${colorClass}`}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + " " + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius + stroke}
            cy={radius + stroke}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />
        </svg>

        {/* Central Digital Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {seconds === 0 ? (
              <motion.div
                key="departing"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: 1,
                  transition: { repeat: Infinity, duration: 1.2 },
                }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="text-center"
              >
                <span className="text-sm font-black text-red-500 tracking-wider uppercase animate-pulse">
                  Departing!
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="timer"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-center"
              >
                <span className={`text-3xl font-mono font-bold tracking-tight ${seconds < 60 ? "animate-pulse font-extrabold" : ""}`}>
                  {formatTime(seconds)}
                </span>
                {seconds < 60 && (
                  <span className="block text-[10px] text-red-400 font-bold uppercase tracking-widest mt-1">
                    Hurry!
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Stop info footer */}
      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground/80 font-medium">
          {seconds > 0 ? "Shuttle is boarding now" : "Shuttle has left"}
        </p>
      </div>
    </div>
  );
}
