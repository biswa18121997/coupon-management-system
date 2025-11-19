

# 📌 Coupon Management — Assignment

---
A simple but production-ready E-commerce Coupon Management Service built using Node.js, Express, and MongoDB.

This system allows:

* Admins to create coupons with detailed eligibility rules

* Users to fetch the best applicable coupon for their cart

* This project extends the original assignment by adding:

* User registration

* Auto-seeded demo user

* Usage tracking

* Tier upgrades

* Coupon usage API

* Secure crypto-based coupon-code generator

🚀 1. Project Overview
-

  => * This service provides:

---
* API to create coupons with detailed rules

* API to evaluate user + cart and return the best valid coupon

* Full MongoDB persistence for users & coupons

* Usage limit tracking per user

* Secure SHA-256 + randomBytes based coupon-code generator

* Auto-seeded test user for easier testing

* 🛠 2. Tech Stack

* Language: Node.js (JavaScript)

* Framework: Express.js

* Database: MongoDB + Mongoose

* Libraries Used

* express — HTTP server

* mongoose — schema/DB models

* crypto — secure coupon generation

* cors — cross-origin access

📦 3. How to Run the Project
✔ Prerequisites

Node.js 18+

MongoDB Atlas or local MongoDB

npm 9+

✔ Setup
git clone <your-repo-url>
cd <repo-folder>
npm install

✔ Environment Setup

You can use the hardcoded MongoDB URL in index.js or replace with your own.

✔ Start the Server
npm start


Server runs at:

http://localhost:8086

🧪 4. How to Run Tests (Optional)

If you add tests later:

npm test


(Currently no automated tests, but project structure supports test-mode DB isolation.)

🤖 5. AI Usage Note

AI was used only for documentation and structure, not for writing main logic.

Prompts used:

“Write a professional README for this project.”

“Explain complex parts of my code.”

“Generate schema documentation.”

🔥 Extra Features Implemented (Beyond Assignment)
✅ 1. Full MongoDB Persistence

Coupons stored permanently

Users stored permanently

Tracks:

lifetimeSpend

ordersPlaced

userTier

usedCoupons[]

--

✅ 2. Secure Crypto-Based Coupon Code Generator

Function:
generateCouponCode(input)

Uses:

SHA-256 hashing

randomBytes

ISO timestamp

Guarantees unique, deterministic, collision-proof codes.

--

✅ 3. Auto-Seeding a Demo User

Created at server start:

email: hire-me@anshumat.org
password: HireMe@2025!


Ensures APIs work instantly.

--

✅ 4. User Registration API

POST /register/user

Assigns:

userTier = NEW

lifetimeSpend = 0

ordersPlaced = 0

--

✅ 5. Coupon Usage Tracking

POST /use-coupon

Updates:

usedCoupons[]

ordersPlaced

lifetimeSpend

auto-upgrades tiers

Tier rules:

>= 20000 → GOLD  
>= 5000  → REGULAR  
else     → NEW


--

✅ 6. Deterministic Best-Coupon Ranking

Tie-breaking rules:

Highest discount

If tie → earliest expiry

If tie → lexicographically smaller code

--

✅ 7. Advanced Eligibility Engine

Evaluates all key rules:

User tier

User country

Lifetime spend

Orders placed

First order only

Cart minimum value

Minimum items

Required categories (ANY must match)

Excluded categories (NONE must match)

🧠 Code Explanation (Simplified)
1️⃣ Coupon Eligibility Engine

Function:
function satisfiesEligibility(coupon, user, cart)

Evaluates in logical blocks:

✔ User constraints

Tier

Country

Lifetime spend

Orders placed

First order only

✔ Cart constraints

Minimum cart value

Minimum items count

Must include ANY of these categories

Must NOT include ANY excluded categories

Uses early return for clean and efficient rule evaluation.

2️⃣ Best Coupon Selection Logic

Route:
POST /best-coupon

Process:

Load user

Fetch all coupons

Filter by:

Valid timeframe

Usage limits

Eligibility rules

Compute discount

Deterministic sorting

Return best coupon

3️⃣ Secure Random Coupon Generator

Function:
generateCouponCode(input)

Creates codes like:

CPN-3FJ9KE912A


Ensures:

No duplicates

No predictable patterns

Extremely low collision probability

4️⃣ Auto User Tier Upgrade Logic

Triggered inside /use-coupon

if lifetimeSpend >= 20000 → GOLD  
else if >= 5000 → REGULAR  
else → NEW


This adds a real loyalty system feel.

📚 API Reference
➤ Create Coupon

POST /create-coupon

Creates and stores a new coupon.

--

➤ Get Best Coupon for User + Cart

POST /best-coupon

Returns:

{
  bestCoupon: {...},
  appliedToUser: "<user-email>",
  userTier: "NEW",
  cartValue: 2500
}


--

➤ Apply/Use Coupon

POST /use-coupon

Updates:

usage history

lifetimeSpend

ordersPlaced

tier

--

➤ Register User

POST /register/user

Creates a new user.

🏁 Final Notes

This project delivers a complete, production-level coupon system with:

✔ Full persistence

✔ Rich rule engine

✔ Usage tracking

✔ Tier upgrades

✔ Secure code generation

✔ Professional architecture

✔ Seeded test environment