const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer'); // Sirf ek baar upar define karo
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

// --- Schema ---
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

// --- OTP Configuration ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'harshit.sinha.ece@gmail.com', //
        pass: 'mkadlbglunwoihdj' //
    }
});

let otpStore = {}; 

// --- ROUTES ---

// 1. Send OTP Route
app.post('/api/send-otp', async (req, res) => {
    const { email, name } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
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
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "OTP Sent Successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to send OTP" });
    }
});

// 2. Verify OTP Route
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (otpStore[email] && otpStore[email] === otp) {
        delete otpStore[email];
        res.status(200).json({ message: "Verified" });
    } else {
        res.status(400).json({ error: "Invalid OTP" });
    }
});

// 3. Create Razorpay Order
app.post('/api/create-order', async (req, res) => {
    const { amount } = req.body;
    const options = {
        amount: amount * 100, 
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

// 4. Payment Success
app.post('/api/payment-success', async (req, res) => {
    try {
        const { name, email, service, amount, paymentId, orderId } = req.body;
        const newLead = new Lead({
            name, email, service,
            amount: amount / 100,
            paymentId, orderId,
            paymentStatus: 'Paid'
        });
        await newLead.save();
        res.status(200).json({ message: "Lead Saved" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Admin Routes
app.get('/api/admin/leads', async (req, res) => {
    try {
        const leads = await Lead.find().sort({ _id: -1 });
        res.json(leads);
    } catch (err) {
        res.status(500).send(err);
    }
});

app.post('/api/admin/update-status', async (req, res) => {
    try {
        const { id, status } = req.body;
        await Lead.findByIdAndUpdate(id, { paymentStatus: status });
        res.json({ message: "Status Updated" });
    } catch (err) {
        res.status(500).send(err);
    }
});

// 6. Enquiry Route
app.post('/api/enquiry', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        const newEnquiry = new Lead({
            name, email,
            service: "Enquiry: " + message,
            paymentStatus: 'Enquiry Only',
            amount: 0
        });
        await newEnquiry.save();
        res.json({ message: "Enquiry Saved" });
    } catch (err) {
        res.status(500).send(err);
    }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));