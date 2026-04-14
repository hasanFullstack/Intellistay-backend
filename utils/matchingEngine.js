/**
 * IntelliStay Advanced Matching Engine
 * 
 * Multi-factor weighted scoring for personality-to-hostel matching
 * and student-to-student similarity.
 */

// Dimension labels and weights (higher = more important for hostel life)
export const DIMENSIONS = [
  { key: "socialStyle",        label: "Social Style",         weight: 1.5 },
  { key: "weekendPreference",  label: "Weekend Preference",   weight: 1.0 },
  { key: "cleanliness",        label: "Cleanliness",          weight: 2.0 },
  { key: "noiseTolerance",     label: "Noise Tolerance",      weight: 2.0 },
  { key: "sleepPattern",       label: "Sleep Pattern",        weight: 1.8 },
  { key: "guestComfort",       label: "Guest Comfort",        weight: 1.2 },
  { key: "conflictApproach",   label: "Conflict Approach",    weight: 1.0 },
  { key: "dailyRoutine",       label: "Daily Routine",        weight: 1.5 },
  { key: "focusEnvironment",   label: "Focus Environment",    weight: 1.8 },
  { key: "sharedRoomComfort",  label: "Shared Room Comfort",  weight: 1.5 },
  { key: "locationPreference", label: "Location Preference",  weight: 1.2 },
  { key: "budgetPriority",     label: "Budget Priority",      weight: 1.0 },
  { key: "facilityInterest",   label: "Facility Interest",    weight: 1.0 },
  { key: "petPreference",      label: "Pet Preference",       weight: 0.8 },
];

/**
 * Weighted Compatibility Score (0-100)
 * 
 * Instead of raw cosine similarity (which gives unintuitive low scores),
 * this calculates per-dimension distance and converts to a percentage.
 * 
 * For each dimension:
 *   - Values range from -2 to +2 (max distance = 4)
 *   - Score = 1 - (|diff| / 4) → 0 to 1
 *   - Weighted by dimension importance
 * 
 * Final score = weighted average × 100
 */
export const calculateCompatibilityScore = (vecA, vecB) => {
  if (!vecA?.length || !vecB?.length) return { score: 0, breakdown: [] };

  const maxDist = 4; // max possible distance between -2 and +2
  let weightedSum = 0;
  let totalWeight = 0;
  const breakdown = [];

  const count = Math.min(vecA.length, vecB.length, DIMENSIONS.length);

  for (let i = 0; i < count; i++) {
    const a = vecA[i] || 0;
    const b = vecB[i] || 0;
    const diff = Math.abs(a - b);
    const dimScore = Math.max(0, 1 - diff / maxDist);
    const weight = DIMENSIONS[i]?.weight || 1;

    weightedSum += dimScore * weight;
    totalWeight += weight;

    // Track per-dimension match quality
    breakdown.push({
      label: DIMENSIONS[i]?.label || `Dim ${i + 1}`,
      score: Math.round(dimScore * 100),
      weight,
      match: dimScore >= 0.75 ? "strong" : dimScore >= 0.5 ? "moderate" : "weak",
    });
  }

  const score = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;

  return { score, breakdown };
};

/**
 * Find strongly matching dimensions (score >= 75%)
 */
export const getStrongMatches = (breakdown) => {
  return breakdown
    .filter((d) => d.match === "strong")
    .map((d) => d.label);
};

/**
 * Find weak/conflicting dimensions (score < 50%)
 */
export const getWeakMatches = (breakdown) => {
  return breakdown
    .filter((d) => d.match === "weak")
    .map((d) => d.label);
};

/**
 * Budget alignment check
 */
export const checkBudgetAlignment = (userBudgetPref, hostelBudgetTier) => {
  const budgetMap = {
    "2":  ["luxury", "premium"],
    "1":  ["premium", "mid_range"],
    "0":  ["mid_range", "budget"],
    "-1": ["budget"],
    "-2": ["budget"],
  };
  const tiers = budgetMap[String(userBudgetPref)] || [];
  const aligned = tiers.includes(hostelBudgetTier);
  return { aligned, bonus: aligned ? 5 : 0 };
};

/**
 * Overall match label
 */
export const getMatchLabel = (score) => {
  if (score >= 85) return { text: "Perfect Match", emoji: "🎯", tier: "S" };
  if (score >= 70) return { text: "Excellent Match", emoji: "⭐", tier: "A" };
  if (score >= 55) return { text: "Great Match", emoji: "🔥", tier: "B" };
  if (score >= 40) return { text: "Good Match", emoji: "👍", tier: "C" };
  if (score >= 25) return { text: "Fair Match", emoji: "🤔", tier: "D" };
  return { text: "Low Match", emoji: "📊", tier: "E" };
};
