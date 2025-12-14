const express = require("express");
const QRCode = require("qrcode");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(cors());

let users = []; // In-memory DB

// REGISTER USER (ONE QR + MANUAL CODE)
app.post("/register", async (req, res) => {
    const { name, email, phone } = req.body;

    const manualCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const user = {
        id: users.length + 1,
        name,
        email,
        phone,
        manualCode,

        gateStatus: "OUT",
        washroomStatus: "OUT",

        lastGateUpdate: null,
        lastWashroomUpdate: null
    };

    users.push(user);

    const scanUrl = `http://192.168.137.1:3000/scan/${user.id}`; // CHANGE YOUR_IP // your ip address , ipconfig
    const qrCode = await QRCode.toDataURL(scanUrl);

    res.json({
        success: true,
        user,
        scanUrl,
        manualCode,
        qrCode
    });
});

// UNIVERSAL SCAN: ONE QR FOR EVERYTHING
app.get("/scan/:id", (req, res) => {
    const { id } = req.params;
    const { action } = req.query;

    const user = users.find(u => u.id == id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (action === "gate") {
        user.gateStatus = user.gateStatus === "IN" ? "OUT" : "IN";
        user.lastGateUpdate = new Date();
    }

    if (action === "washroom") {
        user.washroomStatus = user.washroomStatus === "IN" ? "OUT" : "IN";
        user.lastWashroomUpdate = new Date();
    }

    res.json({
        success: true,
        updatedBy: action,
        user
    });
});

// MANUAL CODE FALLBACK
app.get("/manual", (req, res) => {
    const { code, action } = req.query;

    const user = users.find(u => u.manualCode === code);
    if (!user) return res.status(404).json({ success: false, message: "Invalid manual code" });

    if (action === "gate") {
        user.gateStatus = user.gateStatus === "IN" ? "OUT" : "IN";
        user.lastGateUpdate = new Date();
    }

    if (action === "washroom") {
        user.washroomStatus = user.washroomStatus === "IN" ? "OUT" : "IN";
        user.lastWashroomUpdate = new Date();
    }

    res.json({
        success: true,
        verifiedBy: "manual_code",
        user
    });
});

// ADMIN VIEW
app.get("/users", (req, res) => {
    res.json(users);
});

app.listen(3000, () => console.log("Server running on port 3000"));
