import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

export const getSuggestedPrice = async (room, hostel) => {
    try {
        const month = new Date().getMonth() + 1; // 1-12
        const occupancyRate = (room.totalBeds - room.availableBeds) / room.totalBeds;

        // Count string amenities or use length if array
        const amenityScore = Array.isArray(hostel.amenities) ? hostel.amenities.length :
            (hostel.amenities ? hostel.amenities.split(',').length : 0);

        // Map location text to a tier (simplistic for now)
        let cityTier = 2; // Default medium city
        const loc = (hostel.city || "").toLowerCase();
        if (loc.includes('islamabad') || loc.includes('lahore') || loc.includes('karachi')) {
            cityTier = 1;
        }

        const payload = {
            occupancy_rate: Math.max(0.0, Math.min(1.0, occupancyRate)), // Clamp 0-1
            total_beds: room.totalBeds || 1,
            base_price: room.pricePerBed || 10000,
            month: month,
            amenity_score: Math.min(10, amenityScore), // Max 10
            city_tier: cityTier
        };

        console.log(`Sending payload to AI service:`, payload);

        const response = await axios.post(`${AI_SERVICE_URL}/predict-price`, payload);
        return response.data;
    } catch (error) {
        console.error("AI Pricing Service Error:", error.message);
        throw new Error("Could not calculate dynamic price. AI service might be down.");
    }
};
