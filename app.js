const express = require("express");
const QRCode = require("qrcode");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

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

  gateStatus: { type: String, default: "OUT" },
  washroomStatus: { type: String, default: "OUT" },

  lastGateUpdate: Date,
  lastWashroomUpdate: Date,

  qrImageUrl: String   // will be filled after AWS
});

const User = mongoose.model("User", userSchema);

/* ---------------- REGISTER USER ---------------- */
app.post("/register", async (req, res) => {
  const { name, phone, gender, aadhaarNumber } = req.body;

  if (!name || !phone || !gender || !aadhaarNumber) {
    return res.json({ success: false, message: "All fields required" });
  }

  const manualCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const user = new User({
    name,
    phone,
    gender,
    aadhaarNumber,
    manualCode
  });

  await user.save();

  const scanUrl = `${process.env.BASE_URL}/scan/${user._id}`;

  // QR image will be added later via AWS
  user.qrImageUrl = null;
  await user.save();

  res.json({
    success: true,
    name: user.name,
    phone: user.phone,
    gender: user.gender,
    aadhaarNumber: user.aadhaarNumber,
    manualCode: user.manualCode,
    gateStatus: user.gateStatus,
    washroomStatus: user.washroomStatus,
    scanUrl,
    qrImageUrl: user.qrImageUrl
  });
});

/* ---------------- UNIVERSAL QR SCAN ---------------- */
app.get("/scan/:id", async (req, res) => {
  const { id } = req.params;
  const { action } = req.query;

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
