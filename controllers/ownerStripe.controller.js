import Stripe from "stripe";
import User from "../models/Users.js";

let stripe = null;
if (process.env.STRIPE_SECRET) {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET);
  } catch (e) {
    console.warn("ownerStripe: Failed to init platform Stripe:", e.message);
  }
}

function isConnectNotEnabledError(err) {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("signed up for connect") ||
    msg.includes("you can only create new accounts") ||
    msg.includes("connect")
  );
}

// Creates (or reuses) a Stripe Express account for the owner and returns a
// hosted onboarding URL. Owner API keys are never required.
export const startConnectOnboarding = async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(500).json({ message: "Stripe is not configured on the server" });
    }

    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const user = await User.findById(userId).select("stripe email");
    if (!user) return res.status(404).json({ message: "User not found" });

    let accountId = user.stripe?.accountId || "";

    if (!accountId || !/^acct_/.test(accountId)) {
      try {
        const account = await stripe.accounts.create({
          type: "express",
          email: user.email || undefined,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: "individual",
          metadata: { userId: String(userId) },
        });
        accountId = account.id;
      } catch (err) {
        if (isConnectNotEnabledError(err)) {
          return res.status(400).json({
            code: "CONNECT_NOT_ENABLED",
            message:
              "Stripe Connect is not enabled on the platform account. Please enable Connect first at https://dashboard.stripe.com/connect",
          });
        }
        throw err;
      }

      await User.findByIdAndUpdate(userId, {
        "stripe.accountId": accountId,
        "stripe.onboardingComplete": false,
      });
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const settingsReturnBase = `${clientUrl}/dashboard/owner?tab=settings`;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${settingsReturnBase}&stripe=refresh`,
      return_url: `${settingsReturnBase}&stripe=connected`,
      type: "account_onboarding",
    });

    return res.json({ url: accountLink.url, accountId });
  } catch (err) {
    next(err);
  }
};

// Returns the owner's current Connect account status.
export const getConnectStatus = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const user = await User.findById(userId).select("stripe");
    if (!user) return res.status(404).json({ message: "User not found" });

    const accountId = user.stripe?.accountId || "";
    if (!accountId || !/^acct_/.test(accountId)) {
      return res.json({ connected: false, accountId: null, onboardingComplete: false });
    }

    let onboardingComplete = user.stripe?.onboardingComplete || false;
    try {
      if (stripe && !onboardingComplete) {
        const account = await stripe.accounts.retrieve(accountId);
        const currentlyDue = (account.requirements && account.requirements.currently_due) || [];
        onboardingComplete = Boolean(account.details_submitted) && currentlyDue.length === 0;
        if (onboardingComplete) {
          await User.findByIdAndUpdate(userId, { "stripe.onboardingComplete": true });
        }
      }
    } catch (stripeErr) {
      console.warn("Could not verify Stripe account status:", stripeErr.message);
    }

    return res.json({ connected: true, accountId, onboardingComplete });
  } catch (err) {
    next(err);
  }
};

// Creates a Stripe Express dashboard login link so owners can view payouts,
// balances, and account status directly in Stripe.
export const createStripeDashboardLink = async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(500).json({ message: "Stripe is not configured on the server" });
    }

    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const user = await User.findById(userId).select("stripe");
    if (!user) return res.status(404).json({ message: "User not found" });

    const accountId = user.stripe?.accountId || "";
    if (!accountId || !/^acct_/.test(accountId)) {
      return res.status(400).json({
        code: "STRIPE_NOT_CONNECTED",
        message: "Stripe account is not connected yet",
      });
    }

    let loginLink;
    try {
      loginLink = await stripe.accounts.createLoginLink(accountId);
    } catch (err) {
      if (err?.statusCode === 404 || err?.code === "resource_missing") {
        return res.status(400).json({
          code: "STRIPE_DASHBOARD_UNAVAILABLE",
          message:
            "Stripe could not open the dashboard for this connected account yet. Complete onboarding first, or reconnect the Stripe account.",
        });
      }
      throw err;
    }

    return res.json({ url: loginLink.url, accountId });
  } catch (err) {
    next(err);
  }
};

// Disconnects Stripe Connect from this owner profile.
export const disconnectStripe = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await User.findByIdAndUpdate(userId, {
      "stripe.accountId": "",
      "stripe.onboardingComplete": false,
    });

    return res.json({ message: "Stripe account disconnected" });
  } catch (err) {
    next(err);
  }
};
