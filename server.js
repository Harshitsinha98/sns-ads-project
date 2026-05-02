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

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));