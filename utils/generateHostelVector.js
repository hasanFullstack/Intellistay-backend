export const generateHostelVector = (profile) => {
    const socialMap = {
        very_social: 2,
        somewhat_social: 1,
        quiet: -1,
        very_quiet: -2,
    };

    const cleanlinessMap = {
        very_strict: 2,
        strict: 1,
        moderate: 0,
        relaxed: -1,
    };

    const noiseNightMap = {
        very_quiet: -2,
        quiet: -1,
        moderate: 1,
        party_zone: 2,
    };

    const academicFocusMap = {
        very_high: 2,
        high: 1,
        moderate: 0,
        low: -1,
    };

    const budgetMap = {
        luxury: 2,
        premium: 1,
        mid_range: 0,
        budget: -1,
    };

    const vector = [];

    vector.push(socialMap[profile.socialEnvironment] || 0);        // 0
    vector.push(cleanlinessMap[profile.cleanlinessStandard] || 0); // 1
    vector.push(noiseNightMap[profile.noiseLevelNight] || 0);      // 2
    vector.push(profile.studyEnvironment ? 1 : -1);                // 3
    vector.push(profile.petsAllowed ? 1 : -1);                     // 4
    vector.push(profile.visitorPolicy === "open" ? 1 : -1);        // 5
    vector.push(academicFocusMap[profile.academicFocus] || 0);     // 6
    vector.push(profile.diverseBackground ? 1 : 0);                // 7
    vector.push(profile.nearbyNature ? 1 : 0);                     // 8
    vector.push(profile.eventFrequency === "frequent" ? 2 : 0);    // 9
    vector.push(budgetMap[profile.budgetTier] || 0);               // 10
    vector.push(profile.maintenanceQuality === "excellent" ? 2 : 0); // 11
    vector.push(profile.ageGroup === "mixed" ? 1 : 0);             // 12
    vector.push(profile.studyEnvironment ? 1 : 0);                 // 13

    return vector;
};