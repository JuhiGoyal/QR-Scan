const express = require("express");
const QRCode = require("qrcode");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const AWS = require("aws-sdk"); // ✅ ADDED
const jwt = require("jsonwebtoken"); // ✅ ADDED
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

/* ---------------- AWS CONFIG ---------------- */
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

/* ---------------- MONGODB CONNECTION ---------------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Error:", err));

/* ---------------- USER SCHEMA ---------------- */
const userSchema = new mongoose.Schema({
  name: String,
  phone: String,
  gender: String,
  aadhaarNumber: String,
  manualCode: String,
  address: String,
  carVoucherNumber: String,
  carNumber: String,
  zone: { type: String, default: "" },

  // ✅ NEW fields
  serialNo: { type: String, default: "" },        // ✅ added
  zoneDay1: { type: String, default: "" },
  zoneDay2: { type: String, default: "" },
  referredBy: { type: Number, default: null },    // Preferred By

  gateStatus: { type: String, default: "OUT" },
  washroomStatus: { type: String, default: "OUT" },

  lastGateUpdate: Date,
  lastWashroomUpdate: Date,

  qrImageUrl: String
});

const User = mongoose.model("User", userSchema);

/* ---------------- HELPER: Event Day Check ---------------- */
function getISTDateString() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10); // YYYY-MM-DD
}

function isEventDay() {
  const eventDate = process.env.EVENT_DATE; // YYYY-MM-DD
  if (!eventDate) return true;

  const todayIST = getISTDateString();

  // ✅ optional debug (1 time check)
  console.log("UTC:", new Date().toISOString(), "| IST:", todayIST, "| EVENT_DATE:", eventDate);

  return todayIST === eventDate;
}


/* ---------------- AUTH: Scanner Login ---------------- */
app.post("/scanner-login", (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password !== process.env.SCANNER_PASSWORD) {
      return res.status(401).json({ success: false, message: "Invalid password" });
    }

    const token = jwt.sign(
      { role: "scanner" },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({ success: true, token });
  } catch (err) {
    console.log("Login Error:", err);
    res.status(500).json({ success: false, message: "Login error" });
  }
});

/* ---------------- AUTH MIDDLEWARE ---------------- */
function verifyScannerToken(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.substring(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Scanner login required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.scanner = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid/Expired token" });
  }
}

/* ---------------- HELPER: Day1 -> Day2 zone mapping ---------------- */
// ✅ Update: remove U,V (Day1) and O,P (Day2)
function mapDay1ToDay2Suffix(ch) {
  const map = { W: "Q", X: "R", Y: "S", Z: "T" };
  return map[ch] || "";
}

function computeZoneDay2(zoneDay1) {
  if (!zoneDay1 || typeof zoneDay1 !== "string") return "";

  const zoneDay1Value = zoneDay1.trim().toUpperCase();

  if (
    zoneDay1Value.length === 3 &&
    zoneDay1Value[0] === "A" &&
    (zoneDay1Value[1] === "M" || zoneDay1Value[1] === "F")
  ) {
    const day2Suffix = mapDay1ToDay2Suffix(zoneDay1Value[2]);
    if (!day2Suffix) return "";
    return `B${zoneDay1Value[1]}${day2Suffix}`;
  }
  return "";
}
/* ---------------- GET USER BY ID (FOR UPDATE VIA QR) ---------------- */
app.get("/user/:id", verifyScannerToken, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      user: {
        name: user.name,
        phone: user.phone,
        gender: user.gender,
        aadhaarNumber: user.aadhaarNumber,
        address: user.address,
        carVoucherNumber: user.carVoucherNumber,
        carNumber: user.carNumber,
        serialNo: user.serialNo,
        zoneDay1: user.zoneDay1,
        zoneDay2: user.zoneDay2,
        referredBy: user.referredBy,
        manualCode: user.manualCode
      }
    });
  } catch (err) {
    console.log("User Fetch Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ---------------- REGISTER USER ---------------- */
app.post("/register", async (req, res) => {
  try {
    const {
      name,
      phone,
      gender,
      aadhaarNumber,
      address,
      carVoucherNumber,
      carNumber,
      zone,

      // ✅ NEW INPUTS
      serialNo,
      zoneDay1,
      referredBy
    } = req.body;

    // ✅ Preferred By validation: no limit
    let referredByValue = null;
    if (referredBy !== undefined && referredBy !== null && referredBy !== "") {
      const num = Number(referredBy);
      if (!Number.isFinite(num)) {
        return res.json({ success: false, message: "Referred By must be a valid number" });
      }
      referredByValue = num;
    }

    let zoneDay1Value = "";
    let zoneDay2Value = "";

    if (zoneDay1 && typeof zoneDay1 === "string") {
      zoneDay1Value = zoneDay1.trim().toUpperCase();

      const computed = computeZoneDay2(zoneDay1Value);
      if (!computed) {
        return res.json({ success: false, message: "Invalid zoneDay1 (Example: AMW / AFZ)" });
      }
      zoneDay2Value = computed;
    }

    const manualCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const user = new User({
      name,
      phone,
      gender,
      aadhaarNumber,
      manualCode,
      address,
      carVoucherNumber,
      carNumber,
      zone,

      serialNo: serialNo ? String(serialNo).trim() : "",
      zoneDay1: zoneDay1Value,
      zoneDay2: zoneDay2Value,
      referredBy: referredByValue
    });

    await user.save();

    const scanUrl = `${process.env.BASE_URL}/scan/${user._id}`;

    const qrBuffer = await QRCode.toBuffer(scanUrl);

    const key = `qr/${user._id}.png`;

    await s3.putObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: qrBuffer,
      ContentType: "image/png"
    }).promise();

    const qrImageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    user.qrImageUrl = qrImageUrl;
    await user.save();

    res.json({
      success: true,

      name: user.name,
      phone: user.phone,
      gender: user.gender,
      aadhaarNumber: user.aadhaarNumber,
      address: user.address,
      carVoucherNumber: user.carVoucherNumber,
      carNumber: user.carNumber,
      zone: user.zone,

      serialNo: user.serialNo,
      zoneDay1: user.zoneDay1,
      zoneDay2: user.zoneDay2,
      referredBy: user.referredBy,

      manualCode: user.manualCode,
      gateStatus: user.gateStatus,
      washroomStatus: user.washroomStatus,
      scanUrl,
      qrImageUrl: user.qrImageUrl
    });

  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ---------------- UNIVERSAL QR SCAN (PROTECTED) ---------------- */
app.get("/scan/:id", verifyScannerToken, async (req, res) => {
  const { id } = req.params;
  const { action } = req.query;

  // if (!isEventDay()) {
  //   return res.json({ success: false, message: "QR scanning will be active only on event day" });
  // }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (action === "gate") {
    user.gateStatus = user.gateStatus === "IN" ? "OUT" : "IN";
    user.lastGateUpdate = new Date();
  }

  if (action === "washroom") {
    user.washroomStatus = user.washroomStatus === "IN" ? "OUT" : "IN";
    user.lastWashroomUpdate = new Date();
  }

  await user.save();

  res.json({
    success: true,
    message: `${action === "gate" ? "Gate" : "Washroom"} scan successful`,

    name: user.name,
    phone: user.phone,
    manualCode: user.manualCode,
    gender: user.gender,
    aadhaarNumber: user.aadhaarNumber,
    address: user.address,
    carVoucherNumber: user.carVoucherNumber,
    carNumber: user.carNumber,
    zone: user.zone,

    serialNo: user.serialNo,
    zoneDay1: user.zoneDay1,
    zoneDay2: user.zoneDay2,
    referredBy: user.referredBy,

    gateStatus: user.gateStatus,
    washroomStatus: user.washroomStatus,
    time: new Date()
  });
});

/* ---------------- MANUAL CODE FALLBACK ---------------- */
app.get("/manual", async (req, res) => {
  const { code, action } = req.query;

  const user = await User.findOne({ manualCode: code });
  if (!user) {
    return res.status(404).json({ success: false, message: "Invalid manual code" });
  }

  if (action === "gate") {
    user.gateStatus = user.gateStatus === "IN" ? "OUT" : "IN";
    user.lastGateUpdate = new Date();
  }

  if (action === "washroom") {
    user.washroomStatus = user.washroomStatus === "IN" ? "OUT" : "IN";
    user.lastWashroomUpdate = new Date();
  }

  await user.save();

  res.json({
    success: true,
    name: user.name,
    phone: user.phone,
    manualCode: user.manualCode,

    gender: user.gender,
    aadhaarNumber: user.aadhaarNumber,
    address: user.address,
    carVoucherNumber: user.carVoucherNumber,
    carNumber: user.carNumber,
    zone: user.zone,

    serialNo: user.serialNo,
    zoneDay1: user.zoneDay1,
    zoneDay2: user.zoneDay2,
    referredBy: user.referredBy,

    gateStatus: user.gateStatus,
    washroomStatus: user.washroomStatus
  });
});

/* ---------------- ADMIN USERS ---------------- */
app.get("/users", async (req, res) => {
  const users = await User.find().sort({ _id: -1 });
  res.json(users);
});

/* ---------------- UPDATE USER ---------------- */
app.post("/update", async (req, res) => {
  const user = await User.findOne({ manualCode: req.body.manualCode });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (req.body.zoneDay1 && typeof req.body.zoneDay1 === "string") {
    const z1 = req.body.zoneDay1.trim().toUpperCase();
    const z2 = computeZoneDay2(z1);

    if (!z2) {
      return res.json({ success: false, message: "Invalid zoneDay1 (Example: AMW / AFZ)" });
    }

    req.body.zoneDay1 = z1;
    req.body.zoneDay2 = z2;
  }

  // ✅ Preferred By validation: no limit
  if (req.body.referredBy !== undefined && req.body.referredBy !== null && req.body.referredBy !== "") {
    const num = Number(req.body.referredBy);
    if (!Number.isFinite(num)) {
      return res.json({ success: false, message: "Referred By must be a valid number" });
    }
    req.body.referredBy = num;
  }

  Object.keys(req.body).forEach(key => {
    if (req.body[key] && key !== "manualCode") {
      user[key] = req.body[key];
    }
  });

  await user.save();

  res.json({
    success: true,
    message: "User updated successfully",
    user
  });
});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));
