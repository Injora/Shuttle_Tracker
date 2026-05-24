import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  User,
  LogIn,
  Map,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar() {
  const { user, userType, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", path: "/", icon: <LayoutDashboard size={18} /> },
  ];

  if (userType === "student") {
    navLinks.push({ name: "Student Panel", path: "/student", icon: <User size={18} /> });
    navLinks.push({ name: "Track Shuttle", path: "/track-shuttle", icon: <Map size={18} /> });
  } else if (userType === "driver") {
    navLinks.push({ name: "Driver Hub", path: "/driver", icon: <LayoutDashboard size={18} /> });
  } else {
    // Guest links
    navLinks.push({ name: "Track", path: "/track-shuttle", icon: <Map size={18} /> });
    navLinks.push({ name: "Login", path: "/login", icon: <LogIn size={18} /> });
  }

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-100 dark:border-white/10 shadow-lg"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center">
              <Link
                to="/"
                className="flex items-center gap-3 text-gray-900 dark:text-white group"
              >
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
                  ST
                </div>
                <span className="font-black text-lg tracking-tight group-hover:opacity-80 transition-opacity">
                  Shuttle Tracker
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1.5">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                      isActive
                        ? "text-blue-500 dark:text-blue-400"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNavIndicator"
                        className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/10 rounded-xl border border-blue-500/15"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    {link.icon}
                    <span>{link.name}</span>
                  </Link>
                );
              })}

              <div className="h-6 w-px bg-gray-200 dark:bg-white/10 mx-2" />

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* User Dropdown / Logout */}
              {user ? (
                <div className="flex items-center gap-3 ml-3">
                  <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5">
                    <User size={14} className="text-muted-foreground" />
                    <span className="text-xs font-bold text-foreground max-w-[100px] truncate">
                      {user.name || user.email}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2.5 rounded-xl text-red-500 hover:bg-red-500/10 active:bg-red-500/25 border border-transparent hover:border-red-500/10 transition-all cursor-pointer"
                    title="Logout"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : null}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
              >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-b border-gray-100 dark:border-white/10 bg-white dark:bg-black/95 backdrop-blur-2xl"
            >
              <div className="px-4 pt-2 pb-6 space-y-2">
                {navLinks.map((link) => {
                  const isActive = location.pathname === link.path;
                  return (
                    <motion.div
                      key={link.name}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                    >
                      <Link
                        to={link.path}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                          isActive
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                            : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
                        }`}
                      >
                        {link.icon}
                        <span className="font-semibold">{link.name}</span>
                      </Link>
                    </motion.div>
                  );
                })}
                {user && (
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/10 transition-all font-semibold cursor-pointer"
                    >
                      <LogOut size={18} />
                      Logout
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </>
  );
}
