import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  UserPlus,
  Mail,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  Phone,
  CreditCard
} from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../contexts/AuthContext";
import toast, { Toaster } from "react-hot-toast";

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [role, setRole] = useState(location.state?.role || "student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (location.state?.role) {
      setRole(location.state.role);
    }
  }, [location.state]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/signup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            password,
            role,
            mobileNumber: mobileNumber || undefined,
            licenseNumber: licenseNumber || undefined,
          }),
        },
      );
      const data = await response.json();
      if (response.ok) {
        toast.success("Account created successfully!");
        login(data.token, data.user);
        if (data.user.role === "driver") {
          navigate("/driver");
        } else {
          navigate("/");
        }
      } else {
        toast.error(data.error || "Signup failed");
      }
    } catch (err) {
      toast.error("Network error during registration");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/google`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credential: credentialResponse.credential,
            role,
          }),
        },
      );
      const data = await response.json();
      if (response.ok) {
        toast.success("Account created via Google!");
        login(data.token, data.user);
        if (data.user.role === "driver") {
          navigate("/driver");
        } else {
          navigate("/");
        }
      } else {
        toast.error(data.error || "Google registration failed");
      }
    } catch (err) {
      toast.error("Network error with Google registration");
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] w-full flex items-center justify-center p-4 relative overflow-hidden">
      <Toaster position="top-right" />

      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md animate-duration-300"
      >
        <div className="glass-panel p-8 rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl relative z-10">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/30">
              <UserPlus className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
              Create Account
            </h2>
            <p className="text-xs text-muted-foreground mt-1.5">
              Join the campus shuttle community
            </p>
          </div>

          {/* Role selector tab */}
          <div className="grid grid-cols-2 gap-3 p-1 bg-white/5 border border-white/5 rounded-2xl mb-5">
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`py-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                role === "student"
                  ? "bg-white text-black shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Student Account
            </button>
            <button
              type="button"
              onClick={() => setRole("driver")}
              className={`py-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                role === "driver"
                  ? "bg-white text-black shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Driver Account
            </button>
          </div>

          <form onSubmit={handleSignup} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Full Name</label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white/50 dark:bg-gray-800/50 border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm rounded-xl"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white/50 dark:bg-gray-800/50 border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm rounded-xl"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white/50 dark:bg-gray-800/50 border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm rounded-xl"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Extra Driver Details fields */}
            {role === "driver" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-3.5 border-t border-white/5 pt-3 mt-3"
              >
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Mobile Number</label>
                  <div className="relative group">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white/50 dark:bg-gray-800/50 border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm rounded-xl"
                      placeholder="e.g. +91 9876543210"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Driver License Number</label>
                  <div className="relative group">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white/50 dark:bg-gray-800/50 border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm rounded-xl"
                      placeholder="e.g. DL-1234567890"
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 mt-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Creating Account..." : "Sign Up"}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-6">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or register with Google
                </span>
              </div>
            </div>

            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error("Google Signup Failed")}
                useOneTap
                theme="filled_blue"
                shape="pill"
                size="large"
                text="signup_with"
                width="100%"
              />
            </div>
          </div>

          <p className="text-center mt-6 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary font-semibold hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
