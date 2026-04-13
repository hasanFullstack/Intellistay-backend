import User from "../models/Users.js";

// Save or update owner's Stripe keys
export const saveStripeKeys = async (req, res, next) => {
  try {
    const userId = req.user && req.user._id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const { publicKey, secretKey, accountId } = req.body;

    if (!publicKey || !secretKey) {
      return res
        .status(400)
        .json({ message: "Both publicKey and secretKey are required" });
    }

    const update = {
      stripe: {
        publicKey: String(publicKey).trim(),
        secretKey: String(secretKey).trim(),
        accountId: accountId ? String(accountId).trim() : "",
      },
    };

    const user = await User.findByIdAndUpdate(userId, update, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      message: "Stripe keys saved",
      stripe: {
        publicKey: user.stripe?.publicKey || null,
        secretKey: user.stripe?.secretKey ? "********" : null,
        accountId: user.stripe?.accountId || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getStripeKeys = async (req, res, next) => {
  try {
    const userId = req.user && req.user._id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const user = await User.findById(userId).select("stripe");
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      publicKey: user.stripe?.publicKey || null,
      secretKey: user.stripe?.secretKey ? "********" : null,
      accountId: user.stripe?.accountId || null,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteStripeKeys = async (req, res, next) => {
  try {
    const userId = req.user && req.user._id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.stripe = { publicKey: "", secretKey: "", accountId: "" };
    await user.save();

    return res.json({ message: "Stripe keys removed" });
  } catch (err) {
    next(err);
  }
};

export default { saveStripeKeys, getStripeKeys };
