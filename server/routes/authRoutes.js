import express from "express";
import { body } from "express-validator";
import {
  getProfile,
  login,
  logout,
  refreshSession,
  register,
} from "../controllers/authController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post(
  "/register",
  [
    body("name").trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters."),
    body("email").isEmail().withMessage("Valid email is required."),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters."),
  ],
  register
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required."),
    body("password").notEmpty().withMessage("Password is required."),
  ],
  login
);

router.post("/refresh", refreshSession);
router.post("/logout", logout);

router.get("/me", protect, getProfile);

export default router;
