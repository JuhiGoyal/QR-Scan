const express = require("express");
const QRCode = require("qrcode");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

/* ---------------- MONGODB CONNECTION ---------------- */
mongoose
  .connect(process.env.MONGO_URI, { dbName: "qrSystem" })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Error:", err));

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

  qrCode: String
});

const User = mongoose.model("User", userSchema);

/* ---------------- REGISTER USER ---------------- */
app.post("/register", async (req, res) => {
  console.log("REGISTER API CALLED:", req.body);
  const { name, phone, gender, aadhaarNumber } = req.body;

  const manualCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const newUser = new User({
    name,
    phone,
    gender,
    aadhaarNumber,
    manualCode,
    gateStatus: "OUT",
    washroomStatus: "OUT"
  });

  await newUser.save(); // get _id first

  const scanUrl = `http://192.168.137.1:3000/scan/${newUser._id}`;

  // Generate PNG QR
  const qrPngBuffer = await QRCode.toBuffer(scanUrl);

  // Create folder if not exists
  const qrFolder = path.join(__dirname, "qr-codes");
  if (!fs.existsSync(qrFolder)) fs.mkdirSync(qrFolder);

  const fileName = `${newUser._id}.png`;
  const filePath = path.join(qrFolder, fileName);
  fs.writeFileSync(filePath, qrPngBuffer);

  newUser.qrCode = `/qr/${fileName}`;
  await newUser.save();

  res.json({
    success: true,
    user: newUser,
    scanUrl,
    manualCode,
    qrPngUrl: `http://192.168.137.1:3000/qr/${fileName}`
  });
});

/* ---------------- UNIVERSAL QR SCAN ---------------- */
app.get("/scan/:id", async (req, res) => {
  const { id } = req.params;
  const { action } = req.query;

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

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
  if (!user) return res.status(404).json({ success: false, message: "Invalid manual code" });

  if (action === "gate") {
    user.gateStatus = user.gateStatus === "IN" ? "OUT" : "IN";
    user.lastGateUpdate = new Date();
  }

  if (action === "washroom") {
    user.washroomStatus = user.washroomStatus === "IN" ? "OUT" : "IN";
    user.lastWashroomUpdate = new Date();
  }

  await user.save();
  res.json({ success: true, verifiedBy: "manual_code", user });
});

/* ---------------- ADMIN USERS VIEW ---------------- */
app.get("/users", async (req, res) => {
  const users = await User.find().sort({ _id: -1 });
  res.json(users);
});
app.post("/update", async (req, res) => {
  const {
    manualCode,
    name,
    phone,
    gender,
    aadhaarNumber,
    gateStatus,
    washroomStatus
  } = req.body;

  const user = await User.findOne({ manualCode });
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  // update only if value is provided
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (gender) user.gender = gender;
  if (aadhaarNumber) user.aadhaarNumber = aadhaarNumber;
  if (gateStatus) user.gateStatus = gateStatus;
  if (washroomStatus) user.washroomStatus = washroomStatus;

  await user.save();

  res.json({
    success: true,
    message: "User updated successfully",
    user
  });
});

/* ----------- SERVE PNG QR FILES TO CLIENT ----------- */
app.use("/qr", express.static("qr-codes"));

/* ---------------- START SERVER ---------------- */
app.listen(3000, () => console.log("Server running on port 3000"));
