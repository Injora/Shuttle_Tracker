import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Student from "./pages/Student";
import Driver from "./pages/Driver";
import TrackShuttle from "./pages/TrackShuttle";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Footer from "./components/Footer";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import { Loader2 } from "lucide-react";

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, userType, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={36} className="animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-semibold">Verifying session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userType)) {
    return <Navigate to={userType === "driver" ? "/driver" : "/"} replace />;
  }

  return children;
};

function AppContent() {
  const { userType, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 size={40} className="animate-spin text-indigo-600" />
        <p className="text-sm text-muted-foreground font-semibold">Initializing Shuttle Tracker...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
        {/* Navbar */}
        <Navbar />

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pt-24 sm:pt-28">
          <Routes>
            <Route path="/" element={<Home />} />
            
            <Route
              path="/student"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <div className="max-w-7xl mx-auto">
                    <Student />
                  </div>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/driver"
              element={
                <ProtectedRoute allowedRoles={["driver"]}>
                  <Driver />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/track-shuttle"
              element={
                userType === "driver" ? (
                  <Navigate to="/driver" replace />
                ) : (
                  <div className="max-w-7xl mx-auto h-[550px]">
                    <div className="glass-panel p-4 rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden h-full">
                      <TrackShuttle />
                    </div>
                  </div>
                )
              }
            />
            
            <Route
              path="/login"
              element={
                userType ? (
                  <Navigate to={userType === "driver" ? "/driver" : "/"} replace />
                ) : (
                  <Login />
                )
              }
            />
            
            <Route
              path="/signup"
              element={
                userType ? (
                  <Navigate to={userType === "driver" ? "/driver" : "/"} replace />
                ) : (
                  <Signup />
                )
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
}
