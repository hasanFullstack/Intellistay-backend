import HostelEnvironment from "../models/HostelEnvironment.js";
import Hostel from "../models/Hostel.js";

// Submit or update hostel environment profile (OWNER ONLY)
export const submitHostelEnvironment = async (req, res) => {
  try {
    const { hostelId, environmentProfile } = req.body;
    const ownerId = req.user.id;

    if (!hostelId || !environmentProfile) {
      return res.status(400).json({
        message: "Hostel ID and environment profile are required",
      });
    }

    // Verify hostel exists
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    // Verify owner (model uses `ownerId`) — use safe string conversion
    if (String(hostel.ownerId) !== String(ownerId)) {
      return res.status(403).json({
        message: "Not authorized to update this hostel",
      });
    }

    const environmentScore = calculateEnvironmentScore(environmentProfile);

    const hostelVector = calculateHostelVector(environmentProfile);

    let profile = await HostelEnvironment.findOne({ hostelId });

    if (profile) {
      profile.environmentProfile = environmentProfile;
      profile.environmentScore = environmentScore;
      profile.hostelVector = hostelVector;
      profile.profileCompleted = true;
    } else {
      profile = new HostelEnvironment({
        hostelId,
        ownerId,
        environmentProfile,
        environmentScore,
        hostelVector,
        profileCompleted: true,
      });
    }

    await profile.save();

    res.status(201).json({
      message: "Environment profile saved",
      profile,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
};

// Get hostel environment
export const getHostelEnvironment = async (req, res) => {
  try {
    const { hostelId } = req.params;

    const environment = await HostelEnvironment.findOne({ hostelId })
      .populate("hostelId", "name");

    if (!environment) {
      return res.status(404).json({ message: "Not found" });
    }

    res.status(200).json(environment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Check completion
export const checkEnvironmentCompletion = async (req, res) => {
  try {
    const { hostelId } = req.params;

    const environment = await HostelEnvironment.findOne({ hostelId });

    res.status(200).json({
      completed: environment ? environment.profileCompleted : false,
      environmentScore: environment ? environment.environmentScore : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin analytics
export const getAllHostelEnvironments = async (req, res) => {
  try {
    const environments = await HostelEnvironment.find()
      .populate("hostelId", "name")
      .populate("ownerId", "name email");

    res.status(200).json(environments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Environment score calculator
const calculateEnvironmentScore = (profile) => {
  let score = 50;

  if (profile.socialEnvironment === "very_social") score += 10;
  if (profile.socialEnvironment === "very_quiet") score -= 10;

  if (profile.cleanlinessStandard === "very_strict") score += 8;
  if (profile.cleanlinessStandard === "relaxed") score -= 8;

  if (profile.noiseLevelNight === "very_quiet") score += 6;
  if (profile.noiseLevelNight === "party_zone") score -= 6;

  return Math.max(0, Math.min(100, score));
};

// Create a 14-dimension vector aligned with student personality vector order
const calculateHostelVector = (profile) => {
  // Mapping heuristics to align environment fields to personality dimensions
  const vec = [];

  // 1. eveningRoutine <- socialEnvironment
  const mapSocial = { very_social: 2, somewhat_social: 1, quiet: -1, very_quiet: -2 };
  vec.push(mapSocial[profile.socialEnvironment] ?? 0);

  // 2. weekendStyle <- eventFrequency
  const mapEvent = { frequent: 2, occasional: 0, rare: -1, none: -2 };
  vec.push(mapEvent[profile.eventFrequency] ?? 0);

  // 3. sharedSpaceReaction <- cleanlinessStandard
  const mapClean = { very_strict: 2, strict: 1, moderate: 0, relaxed: -2 };
  vec.push(mapClean[profile.cleanlinessStandard] ?? 0);

  // 4. noiseDuringFocus <- noiseLevelNight
  const mapNoiseNight = { very_quiet: 2, quiet: 1, moderate: 0, party_zone: -2 };
  vec.push(mapNoiseNight[profile.noiseLevelNight] ?? 0);

  // 5. sleepPattern <- noiseLevelDay (heuristic)
  const mapNoiseDay = { quiet: 2, moderate: 1, lively: 0, very_lively: -1 };
  vec.push(mapNoiseDay[profile.noiseLevelDay] ?? 0);

  // 6. guestComfort <- visitorPolicy
  const mapVisitor = { open: 2, restricted_hours: 0, restricted_days: -1, no_visitors: -2 };
  vec.push(mapVisitor[profile.visitorPolicy] ?? 0);

  // 7. conflictApproach <- diverseBackground (bool)
  vec.push(profile.diverseBackground ? 1 : -1);

  // 8. dailyRoutine <- studyEnvironment (bool)
  vec.push(profile.studyEnvironment ? 1 : -1);

  // 9. focusEnvironment <- academicFocus
  const mapAcademic = { very_high: 2, high: 1, moderate: 0, low: -2 };
  vec.push(mapAcademic[profile.academicFocus] ?? 0);

  // 10. sharedRoomComfort <- maintenanceQuality
  const mapMaintenance = { excellent: 2, good: 1, average: 0, poor: -2 };
  vec.push(mapMaintenance[profile.maintenanceQuality] ?? 0);

  // 11. locationPreference <- budgetTier (heuristic mapping)
  const mapBudgetLoc = { luxury: 2, premium: 1, mid_range: 0, budget: -2 };
  vec.push(mapBudgetLoc[profile.budgetTier] ?? 0);

  // 12. budgetPriority <- budgetTier
  vec.push(mapBudgetLoc[profile.budgetTier] ?? 0);

  // 13. facilityInterest <- amenities richness (count)
  const amenitiesScore = Array.isArray(profile.amenities) ? Math.min(2, profile.amenities.length) : 0;
  vec.push(amenitiesScore);

  // 14. petPreference <- petsAllowed
  vec.push(profile.petsAllowed ? 1 : -2);

  return vec;
};