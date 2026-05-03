const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// --- MongoDB & Razorpay Connection ---
mongoose.connect(process.env.MONGO_URI);
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- Schema ---
const leadSchema = new mongoose.Schema({
    name: String, email: String, service: String, amount: Number,
    paymentId: String, orderId: String, paymentStatus: { type: String, default: 'Pending' },
    date: { type: Date, default: Date.now }
});
const Lead = mongoose.model('Lead', leadSchema);

// --- Nodemailer Transporter (Sahi ID aur Password ke saath) ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'sinhahaharshit67@gmail.com', // Aapki sahi email ID
        pass: 'mkadlbglunwoihdj'            // Aapka 16-digit App Password (no spaces)
    }
});

let otpStore = {}; 

// --- OTP ROUTES ---

app.post('/api/send-otp', async (req, res) => {
    const { email, name } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = otp; 

    const mailOptions = {
        from: '"SNS ADS Support" <sinhahaharshit67@gmail.com>',
        to: email,
        subject: 'Verify Your SNS ADS Account',
        html: `<div style="padding: 20px; background: #0f172a; color: white; border-radius: 10px; text-align: center;">
                 <h2 style="color: #3b82f6;">SNS ADS</h2>
                 <p>Hello ${name}, your verification code is:</p>
                 <h1 style="font-size: 40px; letter-spacing: 10px;">${otp}</h1>
               </div>`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "OTP Sent" });
    } catch (err) {
        console.error("Nodemailer Error:", err);
        res.status(500).json({ error: "Email failure", detail: err.message });
    }
});

app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (otpStore[email] === otp) {
        delete otpStore[email];
        res.status(200).json({ message: "Verified" });
    } else {
        res.status(400).json({ error: "Invalid OTP" });
    }
});

// ... (Baki Create-Order aur Success Routes purane wale hi rakhein) ...

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));