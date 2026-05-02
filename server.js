const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Razorpay = require('razorpay'); // 1. Razorpay ko bulaya
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.log("❌ DB Error:", err));

// 2. Razorpay ka setup (Key ID aur Secret yahan use honge)
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Schema for Leads
const leadSchema = new mongoose.Schema({
    name: String,
    email: String,
    service: String,
    paymentStatus: { type: String, default: 'Pending' }, // Payment track karne ke liye
    orderId: String
});
const Lead = mongoose.model('Lead', leadSchema);

// --- ROUTES ---

// A. Purana Route: Lead save karne ke liye
app.post('/api/contact', async (req, res) => {
    try {
        const newLead = new Lead(req.body);
        await newLead.save();
        res.status(201).json({ message: "Lead Saved" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// B. Naya Route: Razorpay Order banane ke liye
app.post('/api/create-order', async (req, res) => {
    const { amount } = req.body; // Amount frontend se aayega

    const options = {
        amount: amount * 100, // Razorpay paise mein leta hai (Rupees * 100)
        currency: "INR",
        receipt: "receipt_" + Math.random(),
    };

    try {
        const order = await razorpay.orders.create(options);
        res.json(order); // Ye Order ID frontend ko bhej dega
    } catch (err) {
        res.status(500).send(err);
    }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));