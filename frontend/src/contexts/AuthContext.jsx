import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('jwt_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Validate persisted token on mount
  useEffect(() => {
    const validateSession = async () => {
      const storedToken = localStorage.getItem('jwt_token');

      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setUserType(data.user.role);
          setToken(storedToken);
        } else {
          // Token expired or invalid — clear everything
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('user_type');
          localStorage.removeItem('driver_user');
          setUser(null);
          setUserType(null);
          setToken(null);
        }
      } catch (err) {
        console.error('[AuthContext] Session validation failed:', err);
        // Network error — keep local state for offline resilience
        const storedType = localStorage.getItem('user_type');
        if (storedType) {
          setUserType(storedType);
        }
        const storedDriver = localStorage.getItem('driver_user');
        if (storedDriver) {
          try {
            setUser(JSON.parse(storedDriver));
          } catch { /* ignore parse errors */ }
        }
      } finally {
        setIsLoading(false);
      }
    };

    validateSession();
  }, []);

  const login = useCallback((newToken, userData) => {
    localStorage.setItem('jwt_token', newToken);
    localStorage.setItem('user_type', userData.role);

    if (userData.role === 'driver') {
      localStorage.setItem('driver_user', JSON.stringify(userData));
    }

    setToken(newToken);
    setUser(userData);
    setUserType(userData.role);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_type');
    localStorage.removeItem('driver_user');

    setToken(null);
    setUser(null);
    setUserType(null);
  }, []);

  const value = useMemo(
    () => ({ user, userType, token, login, logout, isLoading }),
    [user, userType, token, login, logout, isLoading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}

export default AuthContext;
