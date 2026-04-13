export const calculateBehavioralVector = (responses) => {
    // Map each answer to -2..2 based on actual quiz option values
    const mapOption = {
        eveningRoutine: { 
            hangout_group: 2, 
            small_group: 0, 
            relax_alone: -2, 
            productive_time: -1 
        },
        weekendStyle: { 
            social_outings: 2, 
            balanced_mix: 0, 
            quiet_indoor: -2, 
            goal_oriented: -1 
        },
        sharedSpaceReaction: { 
            clean_immediately: 2, 
            clean_my_part: 0, 
            ignore_small_mess: -2, 
            not_bothered: -1 
        },
        noiseDuringFocus: { 
            easily_disturbed: -2, 
            notice_manage: 0, 
            barely_notice: 1, 
            not_affected: 2 
        },
        sleepPattern: { 
            sleep_early: -2, 
            sleep_midnight: 0, 
            sleep_late: 2, 
            irregular_sleep: 0 
        },
        guestComfort: { 
            prefer_notice: -1, 
            occasionally_okay: 0, 
            comfortable_with_it: 1, 
            enjoy_company: 2 
        },
        conflictApproach: { 
            discuss_directly: 2, 
            wait_observe: 0, 
            avoid_topic: -2, 
            adjust_myself: -1 
        },
        dailyRoutine: { 
            structured_planned: 2, 
            semi_structured: 0, 
            go_with_flow: -1, 
            very_spontaneous: -2 
        },
        focusEnvironment: { 
            private_quiet_space: -2, 
            library_environment: -1, 
            any_comfortable_spot: 0, 
            last_minute_style: 1 
        },
        sharedRoomComfort: { 
            personal_space: -2, 
            clear_routines: 0, 
            friendly_environment: 1, 
            flexible_arrangement: 2 
        },
        locationPreference: { 
            urban_lively: 2, 
            near_campus_or_office: 1, 
            quiet_residential: -1, 
            flexible_location: 0 
        },
        budgetPriority: { 
            premium_comfort: 2, 
            balanced_quality: 1, 
            affordable_pricing: 0, 
            basic_essentials: -1 
        },
        facilityInterest: { 
            fitness_facilities: 1, 
            entertainment_space: 1, 
            quiet_study_space: 0, 
            minimal_needs: -1 
        },
        petPreference: { 
            love_pets: 2, 
            okay_with_pets: 1, 
            neutral_about_pets: 0, 
            prefer_no_pets: -2 
        },
    };

    const vector = [];

    Object.keys(responses).forEach((key) => {
        if (mapOption[key]) {
            const value = mapOption[key][responses[key]] ?? 0;
            vector.push(value);
        }
    });

    // Return vector + budget preference separately
    const budgetIndex = vector[11]; // budgetPriority is at index 11
    return { vector, budgetPreference: budgetIndex };
};