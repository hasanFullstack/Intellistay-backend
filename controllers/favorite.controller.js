import Favorite from "../models/Favorite.js";
import Hostel from "../models/Hostel.js";

// Add hostel to favorites
export const addFavorite = async (req, res) => {
  try {
    const { hostelId } = req.body;
    const userId = req.user._id;

    if (!hostelId) {
      return res.status(400).json({ msg: "Hostel ID is required" });
    }

    // Check if hostel exists
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ msg: "Hostel not found" });
    }

    // Check if already favorited
    const existing = await Favorite.findOne({ userId, hostelId });
    if (existing) {
      return res.status(400).json({ msg: "Already in favorites" });
    }

    // Create favorite
    const favorite = new Favorite({ userId, hostelId });
    await favorite.save();

    res.status(201).json({ msg: "Added to favorites", favorite });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

// Remove hostel from favorites
export const removeFavorite = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const userId = req.user._id;

    const result = await Favorite.findOneAndDelete({ userId, hostelId });
    if (!result) {
      return res.status(404).json({ msg: "Favorite not found" });
    }

    res.json({ msg: "Removed from favorites" });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

// Get user's favorite hostels
export const getUserFavorites = async (req, res) => {
  try {
    const userId = req.user._id;

    const favorites = await Favorite.find({ userId }).populate("hostelId");
    const hostels = favorites.map((fav) => fav.hostelId);

    res.json(hostels);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

// Check if hostel is favorited by user
export const isFavorited = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const userId = req.user._id;

    const favorite = await Favorite.findOne({ userId, hostelId });
    res.json({ isFavorited: !!favorite });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

// Get favorite status for multiple hostels
export const checkFavorites = async (req, res) => {
  try {
    const { hostelIds } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(hostelIds)) {
      return res.status(400).json({ msg: "hostelIds must be an array" });
    }

    const favorites = await Favorite.find({
      userId,
      hostelId: { $in: hostelIds },
    });

    const favoriteMap = {};
    favorites.forEach((fav) => {
      favoriteMap[String(fav.hostelId)] = true;
    });

    res.json(favoriteMap);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

// Sync cached favorites to database (on login)
export const syncFavorites = async (req, res) => {
  try {
    const { hostelIds } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(hostelIds) || hostelIds.length === 0) {
      return res.json({ msg: "No favorites to sync" });
    }

    // Get existing favorites
    const existing = await Favorite.find({ userId }).select("hostelId");
    const existingIds = existing.map((fav) => String(fav.hostelId));

    // Find new favorites to add
    const newFavorites = hostelIds.filter(
      (id) => !existingIds.includes(String(id))
    );

    if (newFavorites.length > 0) {
      const favoritesToInsert = newFavorites.map((hostelId) => ({
        userId,
        hostelId,
      }));

      await Favorite.insertMany(favoritesToInsert, { ordered: false }).catch(
        (err) => {
          // Ignore duplicate key errors
          if (err.code !== 11000) throw err;
        }
      );
    }

    res.json({
      msg: "Favorites synced",
      syncedCount: newFavorites.length,
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};
