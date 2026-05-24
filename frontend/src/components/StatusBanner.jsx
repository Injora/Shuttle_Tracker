import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * State → visual config mapping
 */
const STATE_CONFIG = {
  Idle: {
    message: (bus) => `🚌 Bus ${bus} is idle at campus`,
    bg: 'from-gray-500/20 to-gray-600/20',
    border: 'border-gray-400/30',
    dot: 'bg-gray-400',
  },
  En_Route_YS2: {
    message: (bus) => `🟢 Bus ${bus} is en route to YS2`,
    bg: 'from-emerald-500/20 to-green-600/20',
    border: 'border-emerald-400/30',
    dot: 'bg-emerald-400',
  },
  Waiting_YS2: {
    message: (bus) => `🟡 Bus waiting at YS2 — board now!`,
    bg: 'from-amber-500/20 to-yellow-600/20',
    border: 'border-amber-400/30',
    dot: 'bg-amber-400',
  },
  En_Route_YS1: {
    message: (bus) => `🔵 Bus ${bus} heading to YS1`,
    bg: 'from-blue-500/20 to-indigo-600/20',
    border: 'border-blue-400/30',
    dot: 'bg-blue-400',
  },
  Waiting_YS1: {
    message: (bus) => `🟡 Bus waiting at YS1 — board now!`,
    bg: 'from-amber-500/20 to-yellow-600/20',
    border: 'border-amber-400/30',
    dot: 'bg-amber-400',
  },
  Returning_College: {
    message: (bus) => `🏠 Bus ${bus} returning to campus`,
    bg: 'from-blue-500/20 to-cyan-600/20',
    border: 'border-blue-400/30',
    dot: 'bg-blue-400',
  },
};

function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const StatusBanner = ({ state, busNumber = '—', countdown }) => {
  const config = useMemo(() => STATE_CONFIG[state] ?? null, [state]);
  const isVisible = !!config;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key={state}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className={`
            fixed top-20 left-0 right-0 z-40
            flex items-center justify-center
            px-4 py-3
            backdrop-blur-xl
            bg-gradient-to-r ${config.bg}
            border-b ${config.border}
            shadow-lg shadow-black/5
          `}
        >
          <div className="flex items-center gap-3 max-w-3xl w-full justify-center">
            {/* Pulsing dot indicator */}
            <span className="relative flex h-3 w-3 shrink-0">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`}
              />
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${config.dot}`}
              />
            </span>

            {/* Message */}
            <p className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
              {config.message(busNumber)}
              {countdown != null && countdown > 0 && (
                <span className="ml-1 font-mono text-muted-foreground">
                  {' '}— departing in {formatCountdown(countdown)}
                </span>
              )}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StatusBanner;
