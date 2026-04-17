import express from "express";
import { body, param } from "express-validator";
import {
  deleteTrip,
  getDashboard,
  generateTrip,
  getTripById,
  getTrips,
  updateItinerary,
} from "../controllers/tripController.js";
import protect from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";

const router = express.Router();

router.use(protect);

router.post(
  "/generate",
  [
    body("destination").trim().notEmpty().withMessage("destination is required."),
    body("numberOfDays")
      .isInt({ min: 1, max: 30 })
      .withMessage("numberOfDays should be between 1 and 30."),
    body("budgetType").isIn(["Low", "Medium", "High"]).withMessage("Invalid budgetType."),
    body("interests").optional().isArray().withMessage("interests should be an array."),
  ],
  validateRequest,
  generateTrip
);

router.get("/", getTrips);
router.get("/dashboard", getDashboard);

router.get(
  "/:tripId",
  [param("tripId").isMongoId().withMessage("Invalid tripId.")],
  validateRequest,
  getTripById
);

router.patch(
  "/:tripId/itinerary",
  [
    param("tripId").isMongoId().withMessage("Invalid tripId."),
    body("action")
      .isIn(["addActivity", "removeActivity", "regenerateDay"])
      .withMessage("Invalid action."),
    body("day").isInt({ min: 1 }).withMessage("day is required."),
  ],
  validateRequest,
  updateItinerary
);

router.delete(
  "/:tripId",
  [param("tripId").isMongoId().withMessage("Invalid tripId.")],
  validateRequest,
  deleteTrip
);

export default router;
