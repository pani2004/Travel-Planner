import { validationResult } from "express-validator";
import Trip from "../model/Trip.js";
import { generateItineraryWithGemini } from "../services/geminiService.js";

const generateTrip = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const payload = {
      destination: req.body.destination,
      numberOfDays: Number(req.body.numberOfDays),
      budgetType: req.body.budgetType,
      interests: req.body.interests || [],
    };

    const generated = await generateItineraryWithGemini(payload);

    const trip = await Trip.create({
      user: req.user._id,
      ...payload,
      itinerary: generated.itinerary,
      estimatedBudget: generated.estimatedBudget,
      hotelSuggestions: generated.hotelSuggestions,
    });

    return res.status(201).json({ trip });
  } catch (error) {
    return next(error);
  }
};

const getTrips = async (req, res, next) => {
  try {
    const trips = await Trip.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ trips });
  } catch (error) {
    return next(error);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const trips = await Trip.find({ user: req.user._id }).sort({ createdAt: -1 });

    const totalTrips = trips.length;
    const totalDaysPlanned = trips.reduce((sum, trip) => sum + (trip.numberOfDays || 0), 0);
    const totalEstimatedBudget = trips.reduce(
      (sum, trip) => sum + (trip.estimatedBudget?.total || 0),
      0
    );

    const budgetTypeBreakdown = trips.reduce(
      (acc, trip) => {
        if (!acc[trip.budgetType]) {
          acc[trip.budgetType] = 0;
        }
        acc[trip.budgetType] += 1;
        return acc;
      },
      { Low: 0, Medium: 0, High: 0 }
    );

    const recentTrips = trips.slice(0, 5).map((trip) => ({
      id: trip._id,
      destination: trip.destination,
      numberOfDays: trip.numberOfDays,
      budgetType: trip.budgetType,
      createdAt: trip.createdAt,
    }));

    return res.status(200).json({
      dashboard: {
        totalTrips,
        totalDaysPlanned,
        totalEstimatedBudget,
        budgetTypeBreakdown,
        recentTrips,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getTripById = async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.tripId, user: req.user._id });
    if (!trip) {
      return res.status(404).json({ message: "Trip not found." });
    }

    return res.status(200).json({ trip });
  } catch (error) {
    return next(error);
  }
};

const updateItinerary = async (req, res, next) => {
  try {
    const { action, day, activity, activityIndex, regenerateInstruction } = req.body;
    const trip = await Trip.findOne({ _id: req.params.tripId, user: req.user._id });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found." });
    }

    const dayIndex = trip.itinerary.findIndex((item) => item.day === Number(day));
    if (dayIndex === -1) {
      return res.status(400).json({ message: "Invalid day number." });
    }

    if (action === "addActivity") {
      if (!activity) {
        return res.status(400).json({ message: "activity is required." });
      }
      trip.itinerary[dayIndex].activities.push(activity);
    } else if (action === "removeActivity") {
      const removeIndex = Number(activityIndex);
      if (Number.isNaN(removeIndex) || removeIndex < 0) {
        return res.status(400).json({ message: "Valid activityIndex is required." });
      }
      trip.itinerary[dayIndex].activities = trip.itinerary[dayIndex].activities.filter(
        (_, index) => index !== removeIndex
      );
    } else if (action === "regenerateDay") {
      const regenerated = await generateItineraryWithGemini({
        destination: trip.destination,
        numberOfDays: trip.numberOfDays,
        budgetType: trip.budgetType,
        interests: trip.interests,
        dayToRegenerate: Number(day),
        regenerateInstruction: regenerateInstruction || "",
      });
      const regeneratedDay = regenerated.itinerary.find((item) => item.day === Number(day));
      if (regeneratedDay) {
        trip.itinerary[dayIndex] = regeneratedDay;
      }
    } else {
      return res.status(400).json({
        message: "Unsupported action. Use addActivity, removeActivity, regenerateDay.",
      });
    }

    await trip.save();
    return res.status(200).json({ trip });
  } catch (error) {
    return next(error);
  }
};

const deleteTrip = async (req, res, next) => {
  try {
    const deleted = await Trip.findOneAndDelete({
      _id: req.params.tripId,
      user: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Trip not found." });
    }

    return res.status(200).json({ message: "Trip deleted successfully." });
  } catch (error) {
    return next(error);
  }
};

export { generateTrip, getTrips, getDashboard, getTripById, updateItinerary, deleteTrip };
