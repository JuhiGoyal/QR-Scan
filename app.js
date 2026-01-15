const express = require("express");
const QRCode = require("qrcode");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const AWS = require("aws-sdk"); // ✅ ADDED
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

  gateStatus: { type: String, default: "OUT" },
  washroomStatus: { type: String, default: "OUT" },

  lastGateUpdate: Date,
  lastWashroomUpdate: Date,

  qrImageUrl: String
});

const User = mongoose.model("User", userSchema);

/* ---------------- REGISTER USER ---------------- */
app.post("/register", async (req, res) => {
  try {
    const { name, phone, gender, aadhaarNumber,address,
      carVoucherNumber,
      carNumber,
      zone } = req.body;

    if (!name || !phone || !gender || !aadhaarNumber) {
      return res.json({ success: false, message: "All fields required" });
    }

    const manualCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const user = new User({
      name,
      phone,
      gender,
      aadhaarNumber,
      manualCode, address,
      carVoucherNumber,
      carNumber,
      zone
    });

    await user.save();

    const scanUrl = `${process.env.BASE_URL}/scan/${user._id}`;

    /* --------- GENERATE QR BUFFER --------- */
    const qrBuffer = await QRCode.toBuffer(scanUrl);

    /* --------- UPLOAD TO S3 --------- */
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
    address: user.address,
    carVoucherNumber: user.carVoucherNumber,
    carNumber: user.carNumber,
    zone: user.zone,
    gateStatus: user.gateStatus,
    washroomStatus: user.washroomStatus,
    time: new Date()
  });
});
async function downloadQR(qrUrl, fileName) {
  try {
    const response = await fetch(qrUrl);
    if (!response.ok) throw new Error("Failed to fetch QR image");

    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.png`;  // ✅ manualCode as filename
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Download failed");
  }
}

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
