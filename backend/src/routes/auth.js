const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { authenticate, attachUser } = require("../middleware/auth");
const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Generate a token and set it as an HTTP-only cookie.
 */
function handleAuthSuccess(res, user) {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      picture: user.picture,
      mobileNumber: user.mobileNumber,
      licenseNumber: user.licenseNumber,
    },
  };
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { email, password, name, role, mobileNumber, licenseNumber } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || "student",
        mobileNumber,
        licenseNumber,
      },
    });

    const responseData = handleAuthSuccess(res, user);
    res.status(201).json(responseData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const responseData = handleAuthSuccess(res, user);
    res.json(responseData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/google
router.post("/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: "No credential provided" });
  }
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          picture,
          role: req.body.role || "student",
        },
      });
    }

    const responseData = handleAuthSuccess(res, user);
    res.json(responseData);
  } catch (err) {
    res.status(401).json({ error: "Invalid Google token" });
  }
});

// GET /api/auth/me (Check current user)
router.get("/me", authenticate, attachUser, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      picture: req.user.picture,
      mobileNumber: req.user.mobileNumber,
      licenseNumber: req.user.licenseNumber,
    },
  });
});

// PUT /api/auth/update-profile
router.put("/update-profile", authenticate, attachUser, async (req, res) => {
  try {
    const { name, mobileNumber, licenseNumber } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        name,
        mobileNumber,
        licenseNumber,
      },
    });

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        picture: user.picture,
        mobileNumber: user.mobileNumber,
        licenseNumber: user.licenseNumber,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
