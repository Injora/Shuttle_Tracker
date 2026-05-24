import { useState, useEffect, useRef, useCallback } from 'react';

const ACTIVE_FLUSH_MS = 3_000;
const BACKGROUND_FLUSH_MS = 10_000;

/**
 * useGPSBroadcast — battery-efficient GPS broadcasting for drivers.
 *
 * @param {import('socket.io-client').Socket | null} socket
 * @param {boolean} isActive — whether broadcasting should be running
 * @returns {{ currentPosition: GeolocationCoordinates | null, error: string | null, isTracking: boolean }}
 */
export default function useGPSBroadcast(socket, isActive) {
  const [currentPosition, setCurrentPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  // Mutable refs that persist across renders
  const bufferRef = useRef([]);
  const watchIdRef = useRef(null);
  const flushIntervalRef = useRef(null);
  const wakeLockRef = useRef(null);

  // ── Flush latest coordinate to server ────────────────────────────
  const flush = useCallback(() => {
    if (!socket || bufferRef.current.length === 0) return;

    // Send only the LATEST coordinate to minimise bandwidth
    const latest = bufferRef.current[bufferRef.current.length - 1];
    bufferRef.current = [];

    socket.emit('driver:location-update', {
      latitude: latest.latitude,
      longitude: latest.longitude,
      heading: latest.heading,
      speed: latest.speed,
      timestamp: latest.timestamp,
    });
  }, [socket]);

  // ── Restart flush interval with a given period ───────────────────
  const startFlushInterval = useCallback(
    (ms) => {
      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = setInterval(flush, ms);
    },
    [flush],
  );

  // ── Wake Lock helpers ────────────────────────────────────────────
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => {
        console.log('[GPS] Wake lock released');
      });
    } catch (err) {
      // Wake Lock can fail silently on some devices
      console.warn('[GPS] Wake Lock unavailable:', err.message);
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // ── Main effect: start / stop tracking ───────────────────────────
  useEffect(() => {
    if (!isActive || !socket) {
      // Tear down everything
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
      releaseWakeLock();
      bufferRef.current = [];
      setIsTracking(false);
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    // Acquire wake lock
    acquireWakeLock();

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading, speed } = pos.coords;
        const coord = {
          latitude,
          longitude,
          heading: heading ?? 0,
          speed: speed ?? 0,
          timestamp: Date.now(),
        };
        bufferRef.current.push(coord);
        setCurrentPosition(coord);
        setError(null);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied. Please enable GPS.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('GPS position unavailable.');
            break;
          case err.TIMEOUT:
            setError('GPS request timed out.');
            break;
          default:
            setError('An unknown GPS error occurred.');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2_000,
        timeout: 10_000,
      },
    );

    setIsTracking(true);

    // Start flush interval at the active rate
    startFlushInterval(ACTIVE_FLUSH_MS);

    // ── Visibility change: throttle when tab/app is backgrounded ──
    const handleVisibility = () => {
      if (document.hidden) {
        startFlushInterval(BACKGROUND_FLUSH_MS);
      } else {
        startFlushInterval(ACTIVE_FLUSH_MS);
        // Re-acquire wake lock when foregrounded (may have been auto-released)
        acquireWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
      releaseWakeLock();
      bufferRef.current = [];
      setIsTracking(false);
    };
  }, [isActive, socket, acquireWakeLock, releaseWakeLock, startFlushInterval]);

  return { currentPosition, error, isTracking };
}
