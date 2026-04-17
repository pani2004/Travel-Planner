import { GoogleGenerativeAI } from "@google/generative-ai";

const buildFallbackPlan = ({
  destination,
  numberOfDays,
  budgetType,
  interests,
  dayToRegenerate,
}) => {
  const interestText = interests.length ? interests.join(", ") : "general travel";
  const itinerary = Array.from({ length: numberOfDays }).map((_, index) => {
    const day = index + 1;
    const title = `Explore ${destination} - Day ${day}`;
    const activities = [
      `Morning: Local ${interestText} experience`,
      `Afternoon: Visit a top attraction in ${destination}`,
      `Evening: Try regional food and relax`,
    ];

    if (dayToRegenerate && day === dayToRegenerate) {
      return {
        day,
        title: `Regenerated Day ${day} in ${destination}`,
        activities: [
          `Morning: Outdoor walking tour`,
          `Afternoon: Nature-focused activity`,
          `Evening: Scenic sunset viewpoint`,
        ],
        notes: `Regenerated for more outdoor focus with ${budgetType} budget`,
      };
    }

    return {
      day,
      title,
      activities,
      notes: `Planned for ${budgetType} budget`,
    };
  });

  const multiplier = budgetType === "High" ? 1.8 : budgetType === "Medium" ? 1.2 : 0.9;
  const base = numberOfDays * 90 * multiplier;
  const flights = Math.round(300 * multiplier);
  const accommodation = Math.round(numberOfDays * 60 * multiplier);
  const food = Math.round(numberOfDays * 25 * multiplier);
  const activities = Math.round(numberOfDays * 20 * multiplier);
  const localTransport = Math.round(numberOfDays * 12 * multiplier);
  const total = flights + accommodation + food + activities + localTransport + Math.round(base * 0.05);

  return {
    itinerary,
    estimatedBudget: {
      flights,
      accommodation,
      food,
      activities,
      localTransport,
      total,
      currency: "USD",
    },
    hotelSuggestions: [
      `${destination} Budget Stay - Budget Friendly`,
      `${destination} Central Suites - Mid Range`,
      `${destination} Grand Palace Hotel - Luxury`,
    ],
  };
};

const extractJson = (rawText) => {
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
};

const generateItineraryWithGemini = async (payload) => {
  const {
    destination,
    numberOfDays,
    budgetType,
    interests,
    dayToRegenerate = null,
    regenerateInstruction = "",
  } = payload;

  if (!process.env.GEMINI_API_KEY) {
    return buildFallbackPlan({
      destination,
      numberOfDays,
      budgetType,
      interests,
      dayToRegenerate,
    });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
You are an AI travel planner.
Create a STRICT JSON response only.

Input:
- destination: ${destination}
- numberOfDays: ${numberOfDays}
- budgetType: ${budgetType}
- interests: ${interests.join(", ")}
- dayToRegenerate: ${dayToRegenerate ?? "none"}
- regenerateInstruction: ${regenerateInstruction || "none"}

Return JSON with this exact shape:
{
  "itinerary": [
    { "day": 1, "title": "string", "activities": ["string"], "notes": "string" }
  ],
  "estimatedBudget": {
    "flights": 0,
    "accommodation": 0,
    "food": 0,
    "activities": 0,
    "localTransport": 0,
    "total": 0,
    "currency": "USD"
  },
  "hotelSuggestions": ["string", "string", "string"]
}

Rules:
- Keep day numbers unique and from 1..numberOfDays
- Keep budget realistic for the destination and budgetType
- Keep hotels aligned with budget and ratings
- If dayToRegenerate is set, regenerate only that day while keeping others coherent
- Output valid JSON only, no markdown.
`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  try {
    return extractJson(text);
  } catch (error) {
    return buildFallbackPlan({
      destination,
      numberOfDays,
      budgetType,
      interests,
      dayToRegenerate,
    });
  }
};

export { generateItineraryWithGemini };
