// test.js
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from './index.js';

const TEST_DB = "mongodb+srv://biswajitshrm6:7DL0Lz8dxicjlXQJ@users.mt5yvfh.mongodb.net/couponsDB_test?retryWrites=true&w=majority";
const SEEDED_EMAIL = "hire-me@anshumat.org";

beforeAll(async () => {
  // Disconnect if already connected
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Connect to TEST database
  await mongoose.connect(TEST_DB);
  
  // Clean everything
  await mongoose.connection.db.dropDatabase();

  // Create seeded user
  const User = mongoose.model('User');
  await User.create({
    userId: "demo-hireme",
    email: SEEDED_EMAIL,
    userTier: "NEW",
    country: "IN",
    lifetimeSpend: 0,
    ordersPlaced: 0,
    usedCoupons: []
  });
}, 10000);

afterAll(async () => {
  await mongoose.disconnect();
});

const createCoupon = async (data) => {
  const Coupon = mongoose.model('Coupon');
  await Coupon.create({
    code: data.code || `TEST${Date.now()}`,
    description: data.description || "test",
    discountType: data.discountType || "FLAT",
    discountValue: data.discountValue || 100,
    eligibility: data.eligibility || { allowedUserTiers: ["ANY"] },
    ...data
  });
};

const best = (body) => request(app).post('/best-coupon').send(body);
const use = (body) => request(app).post('/use-coupon').send(body);
const cart = (items) => ({ items });

describe('Coupon System – Final Working Tests', () => {
  beforeEach(async () => {
    await mongoose.model('Coupon').deleteMany({});
    await mongoose.model('User').updateOne(
      { email: SEEDED_EMAIL },
      { usedCoupons: [], ordersPlaced: 0, lifetimeSpend: 0, userTier: "NEW" }
    );
  });

  test('uses seeded user when no credentials sent', async () => {
    await createCoupon({ code: "FREE100", discountValue: 100 });
    const res = await best({ cart: cart([{ unitPrice: 5000, quantity: 1 }]) });
    expect(res.body.bestCoupon.code).toBe("FREE100");
    expect(res.body.appliedToUser).toBe(SEEDED_EMAIL);
  });

  test('404 on unknown user', async () => {
    const res = await best({
      email: "fake@xyz.com",
      cart: cart([{ unitPrice: 1000, quantity: 1 }])
    });
    expect(res.status).toBe(404);
  });

  test('firstOrderOnly works only once', async () => {
    await createCoupon({
      code: "WELCOME500",
      discountValue: 500,
      eligibility: { allowedUserTiers: ["NEW"], firstOrderOnly: true }
    });

    let res = await best({ cart: cart([{ unitPrice: 10000, quantity: 1 }]) });
    expect(res.body.bestCoupon.code).toBe("WELCOME500");

    await use({ couponCode: "WELCOME500", cartTotal: 10000 });

    res = await best({ cart: cart([{ unitPrice: 10000, quantity: 1 }]) });
    expect(res.body.bestCoupon).toBeNull();
  });

  test('auto tier upgrade to GOLD', async () => {
    await createCoupon({
      code: "GOLDONLY",
      discountValue: 2000,
      eligibility: { allowedUserTiers: ["GOLD"] }
    });

    await use({ couponCode: "GOLDONLY", cartTotal: 25000 });

    const res = await best({ cart: cart([{ unitPrice: 1000, quantity: 1 }]) });
    expect(res.body.userTier).toBe("GOLD");
  });
});