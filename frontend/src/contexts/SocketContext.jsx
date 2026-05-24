import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Only connect when we have an auth token
    if (!token) {
      // If there was a previous connection, tear it down
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { token },
    });

    socketRef.current = socket;

    const onConnect = () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
    };

    const onDisconnect = (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);

      // Auto-reconnect unless the server explicitly closed the connection
      if (reason === 'io server disconnect') {
        // Server forced disconnect — do not reconnect automatically
        return;
      }
      // For all other reasons, socket.io will auto-reconnect
    };

    const onConnectError = (err) => {
      console.error('[Socket] Connection error:', err.message);
      setIsConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token]);

  const value = useMemo(
    () => ({ socket: socketRef.current, isConnected }),
    [isConnected, token], // re-derive when token changes (new socket instance)
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error('useSocket must be used within a <SocketProvider>');
  }
  return ctx;
}

export default SocketContext;
