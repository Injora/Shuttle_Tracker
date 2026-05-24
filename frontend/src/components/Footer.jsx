import React from "react";
import { Home as HomeIcon, MapPin, User, LogIn } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Dock, DockIcon } from "./ui/Dock";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";

export default function Footer() {
  const location = useLocation();
  const { userType } = useAuth();

  const dockItems = [
    { title: "Home", icon: HomeIcon, href: "/" },
    { title: "Track", icon: MapPin, href: "/track-shuttle" },
    ...(userType === "driver"
      ? [{ title: "Driver Hub", icon: User, href: "/driver" }]
      : []),
    ...(userType === "student"
      ? [{ title: "Student Panel", icon: User, href: "/student" }]
      : []),
    ...(!userType ? [{ title: "Login", icon: LogIn, href: "/login" }] : []),
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <Dock className="bg-white/10 dark:bg-black/10 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl">
        {dockItems.map((item) => (
          <DockIcon
            key={item.title}
            magnification={70}
            distance={100}
            className="bg-transparent hover:bg-white/20 dark:hover:bg-white/10 transition-colors rounded-xl"
          >
            <Link
              to={item.href}
              className="w-full h-full flex items-center justify-center relative"
              title={item.title}
            >
              {location.pathname === item.href && (
                <motion.div
                  layoutId="activeDock"
                  className="absolute -bottom-2 w-1.5 h-1.5 bg-blue-500 rounded-full"
                />
              )}
              <item.icon
                className={`w-5 h-5 ${location.pathname === item.href ? "text-blue-500" : "text-gray-600 dark:text-gray-300"}`}
              />
            </Link>
          </DockIcon>
        ))}
      </Dock>
    </div>
  );
}
