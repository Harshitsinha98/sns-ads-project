const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Razorpay = require('razorpay');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.log("❌ DB Error:", err));

// --- Razorpay Setup ---
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- Schema for Leads (Important: Status aur Service added) ---
const leadSchema = new mongoose.Schema({
    name: String,
    email: String,
    service: String,
    amount: Number,
    paymentId: String,
    orderId: String,
    paymentStatus: { type: String, default: 'Pending' },
    date: { type: Date, default: Date.now }
});
const Lead = mongoose.model('Lead', leadSchema);

// --- ROUTES ---

// 1. Create Razorpay Order
app.post('/api/create-order', async (req, res) => {
    const { amount } = req.body;
    const options = {
        amount: amount * 100, // Paise mein
        currency: "INR",
        receipt: "receipt_" + Math.random(),
    };
    try {
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (err) {
        res.status(500).send(err);
    }
});

// 2. Payment Success: Data Save karne ke liye (Ye zaroori tha!)
app.post('/api/payment-success', async (req, res) => {
    try {
        const { name, email, service, amount, paymentId, orderId } = req.body;
        const newLead = new Lead({
            name,
            email,
            service: service || 'Standard Ads',
            amount: amount / 100,
            paymentId,
            orderId,
            paymentStatus: 'Paid' // Pehla status 'Paid' hoga
        });
        await newLead.save();
        res.status(200).json({ message: "Lead Saved Successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Admin: Saara data fetch karne ke liye
app.get('/api/admin/leads', async (req, res) => {
    try {
        const leads = await Lead.find().sort({ _id: -1 });
        res.json(leads);
    } catch (err) {
        res.status(500).send(err);
    }
});

// 4. Admin: Status update karne ke liye
app.post('/api/admin/update-status', async (req, res) => {
    try {
        const { id, status } = req.body;
        await Lead.findByIdAndUpdate(id, { paymentStatus: status });
        res.json({ message: "Status Updated" });
    } catch (err) {
        res.status(500).send(err);
    }
});

// Ye naya route Enquiry ke liye use karenge
app.post('/api/enquiry', async (req, res) => {
    try {
        const { name, email, message, service } = req.body;
        const newEnquiry = new Lead({
            name,
            email,
            service: "Enquiry: " + service,
            paymentStatus: 'Enquiry Only', // Taaki admin.html mein alag dikhe
            amount: 0
        });
        await newEnquiry.save();
        res.json({ message: "Enquiry Saved" });
    } catch (err) {
        res.status(500).send(err);
    }
});
const nodemailer = require('nodemailer');
const nodemailer = require('nodemailer');

// 1. Transporter Setup - Aapke Gmail se connect kiya gaya hai
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'harshit.sinha.ece@gmail.com', // Aapka email
        pass: 'mkadlbglunwoihdj'           // Aapka naya 16-digit App Password
    }
});

let otpStore = {}; // Temporary memory mein OTP save karne ke liye

// 2. Route: User ko OTP bhejna
app.post('/api/send-otp', async (req, res) => {
    const { email, name } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit random number
    otpStore[email] = otp; 

    const mailOptions = {
        from: '"SNS ADS Verification" <harshit.sinha.ece@gmail.com>',
        to: email,
        subject: 'Verify Your SNS ADS Account',
        html: `
            <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: white; padding: 40px; border-radius: 20px;">
                <h1 style="color: #3b82f6;">SNS ADS</h1>
                <p>Hello <b>${name}</b>,</p>
                <p>Your verification code for SNS ADS is:</p>
                <div style="background: rgba(255,255,255,0.1); padding: 20px; font-size: 32px; font-weight: bold; letter-spacing: 5px; text-align: center; border-radius: 10px; border: 1px solid #3b82f6;">
                    ${otp}
                </div>
                <p style="margin-top: 20px; color: #94a3b8;">This code is valid for 10 minutes.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions); // Email bhej raha hai
        res.status(200).json({ message: "OTP Sent Successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to send OTP" });
    }
});

// 3. Route: OTP Verify karna
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (otpStore[email] && otpStore[email] === otp) {
        delete otpStore[email]; // Ek baar verify hone par delete kar do
        res.status(200).json({ message: "Verified" });
    } else {
        res.status(400).json({ error: "Invalid OTP" });
    }
});
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));