const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

/**
 * Authentication middleware — extracts JWT from cookie or Authorization header,
 * verifies it, looks up the user, and attaches to req.user.
 */
function authenticate(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Role-based authorization middleware.
 * Usage: requireRole('driver', 'admin')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(" or ")}`,
      });
    }
    next();
  };
}

/**
 * Attach full user object to req.user (use after authenticate when you need full user data).
 */
async function attachUser(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch user" });
  }
}

module.exports = { authenticate, requireRole, attachUser };
