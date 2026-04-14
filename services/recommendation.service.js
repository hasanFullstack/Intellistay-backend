import HostelEnvironment from "../models/HostelEnvironment.js";

const calculateCompatibility = (userVector, hostelVector) => {
    let score = 0;
    let totalWeight = 0;

    const weights = Array(userVector.length).fill(1); // weight per dimension
    userVector.forEach((val, idx) => {
        const diff = Math.abs(val - (hostelVector[idx] ?? 0));
        score += (2 - diff) * weights[idx];
        totalWeight += 2 * weights[idx];
    });

    return Math.max(0, (score / totalWeight) * 100);
};

export const getSmartRecommendations = async (user) => {
    const environments = await HostelEnvironment.find({ profileCompleted: true }).populate("hostelId");

    return environments
        .map((env) => {
            const personalityMatch = calculateCompatibility(user.personalityVector, env.environmentVector);
            const budgetMatch = user.budgetPreference === env.priceLevel ? 10 : 0;

            return {
                hostel: env.hostelId,
                compatibilityScore: personalityMatch + budgetMatch,
                breakdown: { personalityMatch, budgetMatch },
            };
        })
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
        .slice(0, 10);
};