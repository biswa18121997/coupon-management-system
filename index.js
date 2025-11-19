import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import crypto from "crypto";


export const app = express();
app.use(cors());
app.use(express.json());

// -------------------- base envv && mongo db url . --------------------
const PORT = 8086;
const DEFAULT_MONGO ="mongodb+srv://biswajitshrm6:7DL0Lz8dxicjlXQJ@users.mt5yvfh.mongodb.net/couponsDB?retryWrites=true&w=majority";
// -------------------- MongoDB Connection (ONLY ONCE!) --------------------
let isConnected = false;
const SEEDED_EMAIL ='hire-me@anshumat.org'
const SEEDED_PASSWORD = 'HireMe@2025!' ;
async function ensureSeededUser() {
  try {
  if (!isConnected) await connectDB();
  let user = await User.findOne({ email: SEEDED_EMAIL });
  if (!user) {
    user = new User({
      userId: "demo-hireme",
      email: SEEDED_EMAIL,
      password: SEEDED_PASSWORD,
      userTier: "NEW",
      country: "IN",
      lifetimeSpend: 0,
      ordersPlaced: 0,
      usedCoupons: []
    });
    await user.save();
    console.log("Seeded demo user created:", SEEDED_EMAIL);
  }
  } catch (error) {
    console.log(error)
  }
}


async function connectDB() {
  if (isConnected) return;
  
  try {
    await mongoose.connect(DEFAULT_MONGO);
    isConnected = true;
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
  }
}

// Only connect when not in test mode
// if (process.env.NODE_ENV !== 'test') {
//   connectDB();
// }


// async function ensureSeededUser() {
//   if (!isConnected) await connectDB();

// }
ensureSeededUser();


// -------------------- Mongoose Schemas --------------------
//coupan schemaas..
const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  description: { type: String, required: true },
  discountType: { type: String, enum: ["FLAT", "PERCENT"], required: true },
  discountValue: { type: Number, required: true },
  maxDiscountAmount: { type: Number },
  validityStart: { type: Date, default: Date.now },
  validityEnd: { type: Date, default: () => new Date(Date.now() + 30*24*3600*1000) },
  usageLimitPerUser: { type: Number, default: 10 },
  usedBy: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] }, // not used directly, but kept better for check if a user has already used this coupan
  eligibility: {
    //user based eligibilty criteria
    allowedUserTiers: {
      type: [String],
      enum: ["NEW", "REGULAR", "GOLD", "ANY"],
      required: true,
      default: ["ANY"]
    },
    minLifetimeSpend: { type: Number },
    minOrdersPlaced: { type: Number },
    firstOrderOnly: { type: Boolean, default: false },
    allowedCountries: {
      type: [String],
      required: true,
      default: ["IN"]
    },
    // cart based criterias
    minCartValue: { type: Number },
    applicableCategories: [{ type: String }],
    excludedCategories: [{ type: String }],
    minItemsCount: { type: Number },
  },
  createdAt: { type: Date, default: () => new Date() },
});
//user schaema
const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String },
  userTier: { type: String, enum: ["NEW", "REGULAR", "GOLD"], default: "NEW" },
  country: { type: String, default:String, default: "IN" },
  lifetimeSpend: { type: Number, default: 0 },
  ordersPlaced: { type: Number, default: 0 }, // FIXED: was String, now Number
  usedCoupons: {
    type: [String], // stores couponCode repeated N times (e.g. ["WELCOME100", "FESTIVE10", "FESTIVE10"])
    default: []
  },
});

const Coupon = mongoose.model("Coupon", CouponSchema);
const User = mongoose.model("User", UserSchema);

// -------------------- Helpers --------------------
function generateCouponCode(input = "") {
  const raw = input + new Date().toISOString() + crypto.randomBytes(4).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return "CPN-" + BigInt("0x" + hash).toString(36).toUpperCase().substring(0, 10);
}

function computeCartValue(cart) {
  if (!cart || !Array.isArray(cart.items)) return 0;
  return cart.items.reduce((sum, item) => {
    const price = Number(item.unitPrice) || 0;
    const qty = Number(item.quantity) || 0;
    return sum + price * qty;
  }, 0);
}

function countItems(cart) {
  if (!cart || !Array.isArray(cart.items)) return 0;
  return cart.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

function getCartCategories(cart) {
  const set = new Set();
  if (cart && Array.isArray(cart.items)) {
    cart.items.forEach(item => {
      if (item.category) set.add(item.category.trim().toLowerCase());
    });
  }
  return set;
}

// -------------------- Core Eligibilty Loigc --------------------
function isCouponValidNow(coupon) {
  const now = Date.now();
  if (coupon.validityStart && new Date(coupon.validityStart).getTime() > now) return false;
  if (coupon.validityEnd && new Date(coupon.validityEnd).getTime() < now) return false;
  return true;
}

function getUserUsedCount(userUsedCouponsArray, couponCode) {
  if (!Array.isArray(userUsedCouponsArray)) return 0;
  return userUsedCouponsArray.filter(code => code === couponCode).length;
}

function satisfiesEligibility(coupon, user, cart) {
  const e = coupon.eligibility || {};

  // === User Tier ===
  const userTier = (user.userTier || "NEW").toUpperCase();
  const allowedTiers = e.allowedUserTiers || ["ANY"];
  const hasAny = allowedTiers.includes("ANY");
  const hasUserTier = allowedTiers.map(t => t.toUpperCase()).includes(userTier);

  if (!hasAny && !hasUserTier) return false;

  // === Country ===
  const userCountry = (user.country || "IN").toUpperCase();
  const allowedCountries = (e.allowedCountries || ["IN"]).map(c => c.toUpperCase());
  if (!allowedCountries.includes(userCountry)) return false;

  // === Lifetime Spend ===
  if (typeof e.minLifetimeSpend === "number") {
    if ((user.lifetimeSpend || 0) < e.minLifetimeSpend) return false;
  }

  // === Orders Placed ===
  const ordersCount = Number(user.ordersPlaced) || 0;
  if (typeof e.minOrdersPlaced === "number" && ordersCount < e.minOrdersPlaced) return false;

  // === First Order Only ===
  if (e.firstOrderOnly && ordersCount > 0) return false;

  // === Cart Value ===
  const cartValue = computeCartValue(cart);
  if (typeof e.minCartValue === "number" && cartValue < e.minCartValue) return false;

  // === Min Items Count ===
  if (typeof e.minItemsCount === "number" && countItems(cart) < e.minItemsCount) return false;

  // === Applicable Categories (at least one item must match) ===
  if (Array.isArray(e.applicableCategories) && e.applicableCategories.length > 0) {
    const cartCats = getCartCategories(cart);
    const requiredCats = e.applicableCategories.map(c => c.toLowerCase());
    const match = requiredCats.some(cat => cartCats.has(cat));
    if (!match) return false;
  }

  // === Excluded Categories (none should be present) ===
  if (Array.isArray(e.excludedCategories) && e.excludedCategories.length > 0) {
    const cartCats = getCartCategories(cart);
    const excludedCats = e.excludedCategories.map(c => c.toLowerCase());
    const hasExcluded = excludedCats.some(cat => cartCats.has(cat));
    if (hasExcluded) return false;
  }
  return true;
}
// -------------------- Compute Discount Amount --------------------
function computeDiscountAmount(coupon, cartValue) {
  if (coupon.discountType === "FLAT") {
    return coupon.discountValue || 0;
  }

  if (coupon.discountType === "PERCENT") {
    let discount = Math.floor((coupon.discountValue / 100 * cartValue));
    if (typeof coupon.maxDiscountAmount === "number") {
      discount = Math.min(discount, coupon.maxDiscountAmount);
    }
    return discount;
  }

  return 0;
}

// -------------------- API: Best Coupon --------------------
//create coupon
// -------------------- API: Create Coupon (Admin) --------------------
app.post("/create-coupon", async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,        // "FLAT" or "PERCENT"
      discountValue,       // number
      maxDiscountAmount,   // optional, for PERCENT only
      validityStart,       // optional ISO date
      validityEnd,         // optional ISO date
      usageLimitPerUser,   // optional, default 10
      eligibility = {}     // all eligibility rules
    } = req.body;

    // Basic validation
    if (!description || !discountType || discountValue === undefined) {
      return res.status(400).json({
        error: "description, discountType, and discountValue are required"
      });
    }

    if (!["FLAT", "PERCENT"].includes(discountType.toUpperCase())) {
      return res.status(400).json({ error: "discountType must be FLAT or PERCENT" });
    }

    if (discountValue <= 0) {
      return res.status(400).json({ error: "discountValue must be positive" });
    }

    // Generate code if not provided
    const finalCode = code
      ? code.toUpperCase().trim()
      : generateCouponCode(description);

    // Check for duplicate code
    const existing = await Coupon.findOne({ code: finalCode });
    if (existing) {
      return res.status(409).json({ error: "Coupon code already exists" });
    }

    // Create the coupon
    const newCoupon = new Coupon({
      code: finalCode,
      description,
      discountType: discountType.toUpperCase(),
      discountValue: Number(discountValue),
      maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
      validityStart: validityStart ? new Date(validityStart) : undefined,
      validityEnd: validityEnd ? new Date(validityEnd) : undefined,
      usageLimitPerUser: usageLimitPerUser || 10,
      eligibility: {
        allowedUserTiers: eligibility.allowedUserTiers || ["ANY"],
        minLifetimeSpend: eligibility.minLifetimeSpend,
        minOrdersPlaced: eligibility.minOrdersPlaced,
        firstOrderOnly: eligibility.firstOrderOnly || false,
        allowedCountries: eligibility.allowedCountries || ["IN"],
        minCartValue: eligibility.minCartValue,
        applicableCategories: eligibility.applicableCategories || [],
        excludedCategories: eligibility.excludedCategories || [],
        minItemsCount: eligibility.minItemsCount
      }
    });

    await newCoupon.save();

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully!",
      coupon: {
        code: newCoupon.code,
        description: newCoupon.description,
        discountType: newCoupon.discountType,
        discountValue: newCoupon.discountValue,
        maxDiscountAmount: newCoupon.maxDiscountAmount,
        usageLimitPerUser: newCoupon.usageLimitPerUser,
        eligibility: newCoupon.eligibility,
        validityStart: newCoupon.validityStart,
        validityEnd: newCoupon.validityEnd
      }
    });

  } catch (err) {
    console.error("/create-coupon error:", err);
    res.status(500).json({ error: "Failed to create coupon" });
  }
});
//user registration route
app.post('/register/user', async (req, res) => {
  try {
    const { email, password, country } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "User with this email already exists" });
    }
    const newUser = new User({
      userId: "user-" + crypto.randomBytes(6).toString("hex"),
      email,
      password,
      country: country || "IN",
      userTier: "NEW",
      lifetimeSpend: 0,
      ordersPlaced: 0,
      usedCoupons: []
    });
    await newUser.save();
    return res.status(201).json({ message: "User registered successfully", userId: newUser.userId });
  } catch (err) {
    console.error("/register/user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
//best coupon route
app.post("/best-coupon", async (req, res) => {
  try {
    const { userId, email, cart = {} } = req.body;

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(400).json({ error: "Valid cart with items[] is required" });
    }

    let dbUser = null;

    // 1. If userId or email is provided → MUST exist
    if (userId || email) {
      dbUser = userId 
        ? await User.findOne({ userId })
        : await User.findOne({ email });

      if (!dbUser) {
        return res.status(404).json({ 
          error: "User not found", 
          message: "The provided userId or email does not exist in the system" 
        });
      }
    } 
    // 2. If NO userId/email → use seeded demo user
    else {
      dbUser = await User.findOne({ email: SEEDED_EMAIL });
      if (!dbUser) {
        return res.status(500).json({ error: "Demo user missing. Contact admin." });
      }
    }

    // Build final user context
    const user = {
      userId: dbUser.userId,
      userTier: dbUser.userTier || "NEW",
      country: dbUser.country || "IN",
      lifetimeSpend: dbUser.lifetimeSpend || 0,
      ordersPlaced: dbUser.ordersPlaced || 0,
      usedCoupons: dbUser.usedCoupons || []
    };

    const cartValue = computeCartValue(cart);
    const allCoupons = await Coupon.find({});
    const candidates = [];

    for (const coupon of allCoupons) {
      if (!isCouponValidNow(coupon)) continue;

      const usedCount = getUserUsedCount(user.usedCoupons, coupon.code);
      if (coupon.usageLimitPerUser && usedCount >= coupon.usageLimitPerUser) continue;

      if (!satisfiesEligibility(coupon, user, cart)) continue;

      const discount = computeDiscountAmount(coupon, cartValue);
      if (discount <= 0) continue;

      candidates.push({
        coupon,
        discountAmount: discount,
        expiryTime: coupon.validityEnd ? new Date(coupon.validityEnd).getTime() : Infinity
      });
    }

    if (candidates.length === 0) {
      return res.json({ 
        bestCoupon: null,
        usedBy: userId || email || SEEDED_EMAIL
      });
    }

    candidates.sort((a, b) => {
      if (b.discountAmount !== a.discountAmount) return b.discountAmount - a.discountAmount;
      if (a.expiryTime !== b.expiryTime) return a.expiryTime - b.expiryTime;
      return a.coupon.code.localeCompare(b.coupon.code);
    });

    const best = candidates[0];

    return res.json({
      bestCoupon: {
        code: best.coupon.code,
        description: best.coupon.description,
        discountType: best.coupon.discountType,
        discountValue: best.coupon.discountValue,
        maxDiscountAmount: best.coupon.maxDiscountAmount || null,
        computedDiscountAmount: best.discountAmount,
      },
      appliedToUser: userId || email || SEEDED_EMAIL,
      userTier: user.userTier,
      cartValue
    });

  } catch (err) {
    console.error("/best-coupon error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
// /use coupon route
app.post("/use-coupon", async (req, res) => {
  try {
    const { userId, email, couponCode, cartTotal = 0 } = req.body;

    if (!couponCode) {
      return res.status(400).json({ error: "couponCode is required" });
    }

    let user;
    if (userId || email) {
      user = await User.findOne(userId ? { userId } : { email });
    } else {
      user = await User.findOne({ email: SEEDED_EMAIL });
    }

    if (!user) {
      return res.status(userId || email ? 404 : 500).json({
        error: userId || email ? "User not found" : "Demo user not available"
      });
    }

    const coupon = await Coupon.findOne({ code: couponCode });
    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found or invalid" });
    }

    // CRITICAL FIX: Ensure usedCoupons is always a valid array
    if (!user.usedCoupons || !Array.isArray(user.usedCoupons)) {
      user.usedCoupons = [];
    }

    const usedCount = user.usedCoupons.filter(c => c === couponCode).length;

    if (coupon.usageLimitPerUser && usedCount >= coupon.usageLimitPerUser) {
      return res.status(403).json({
        error: "Usage limit exceeded",
        message: `This coupon can only be used ${coupon.usageLimitPerUser} time(s) per user`
      });
    }

    // NOW 100% SAFE
    user.usedCoupons.push(couponCode);
    user.ordersPlaced += 1;
    user.lifetimeSpend += Number(cartTotal);

    // Tier upgrade
    if (user.lifetimeSpend >= 20000) user.userTier = "GOLD";
    else if (user.lifetimeSpend >= 5000) user.userTier = "REGULAR";

    await user.save();

    return res.json({
      success: true,
      message: "Coupon applied successfully!",
      couponCode,
      appliedTo: user.email,
      newTier: user.userTier,
      totalOrders: user.ordersPlaced,
      lifetimeSpend: user.lifetimeSpend,
      timesUsed: usedCount + 1
    });

  } catch (err) {
    console.error("/use-coupon error:", err);
    res.status(500).json({ error: "Failed to apply coupon" });
  }
});
// -------------------- Start server --------------------
app.listen(PORT, () => {
  console.log(`Coupon service listening on port ${PORT}`);
});
