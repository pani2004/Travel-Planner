import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import User from "../model/User.js";

const getAccessToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES || "15m",
  });

const getRefreshToken = (userId, refreshTokenTtlDays) =>
  jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: `${refreshTokenTtlDays}d`,
  });

const getRefreshTokenExpiryDate = () => {
  const refreshTokenTtlDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
  const ttlMs = refreshTokenTtlDays * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ttlMs);
};

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7) * 24 * 60 * 60 * 1000,
});

const issueSession = async (user, res) => {
  const refreshTokenTtlDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
  const accessToken = getAccessToken(user._id.toString());
  const refreshToken = getRefreshToken(user._id.toString(), refreshTokenTtlDays);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  user.refreshTokenHash = refreshTokenHash;
  user.refreshTokenExpiresAt = getRefreshTokenExpiryDate();
  await user.save();

  res.cookie("refreshToken", refreshToken, getRefreshCookieOptions());

  return accessToken;
};

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already in use." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const accessToken = await issueSession(user, res);

    return res.status(201).json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const accessToken = await issueSession(user, res);

    return res.status(200).json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getProfile = async (req, res) => {
  return res.status(200).json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
    },
  });
};

const refreshSession = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ message: "Refresh token is missing." });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
      res.clearCookie("refreshToken", getRefreshCookieOptions());
      return res.status(401).json({ message: "Invalid refresh token." });
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.refreshTokenHash || !user.refreshTokenExpiresAt) {
      res.clearCookie("refreshToken", getRefreshCookieOptions());
      return res.status(401).json({ message: "Refresh session not found." });
    }

    if (user.refreshTokenExpiresAt.getTime() < Date.now()) {
      user.refreshTokenHash = null;
      user.refreshTokenExpiresAt = null;
      await user.save();
      res.clearCookie("refreshToken", getRefreshCookieOptions());
      return res.status(401).json({ message: "Refresh token expired. Please login again." });
    }

    const isTokenValid = await bcrypt.compare(token, user.refreshTokenHash);
    if (!isTokenValid) {
      user.refreshTokenHash = null;
      user.refreshTokenExpiresAt = null;
      await user.save();
      res.clearCookie("refreshToken", getRefreshCookieOptions());
      return res.status(401).json({ message: "Refresh token mismatch." });
    }

    const accessToken = await issueSession(user, res);

    return res.status(200).json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
        await User.findByIdAndUpdate(decoded.userId, {
          refreshTokenHash: null,
          refreshTokenExpiresAt: null,
        });
      } catch (error) {
        // Ignore invalid token during logout and continue clearing cookie.
      }
    }

    res.clearCookie("refreshToken", getRefreshCookieOptions());
    return res.status(200).json({ message: "Logged out successfully." });
  } catch (error) {
    return next(error);
  }
};

export { register, login, getProfile, refreshSession, logout };
