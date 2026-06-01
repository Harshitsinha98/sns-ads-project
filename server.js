const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(express.json());

// --- CORS Setup (Open for Pitch & Production) ---
app.use(cors({
    origin: '*', // Pitch ke liye open rakha hai taaki koi blockage na ho
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// --- MongoDB & Razorpay Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected Successfully"))
    .catch((err) => console.log("MongoDB Connection Error:", err));

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- MongoDB Schema ---
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

// --- Nodemailer Transporter (Aapki ID aur App Password ke saath) ---
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Port 465 ke liye true rahega
    auth: {
        user: 'sinhahaharshit67@gmail.com',
        pass: 'mkadlbglunwoihdj'
    },
    tls: {
        rejectUnauthorized: false // Isse connection timeout ke chances kam ho jate hain
    }
});

// Temporary memory store for OTPs
let otpStore = {}; 

// ==========================================
// 1. OTP ROUTES (Login Gate ke liye)
// ==========================================

app.post('/api/send-otp', async (req, res) => {
    const { email, name } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = otp; 

    const mailOptions = {
        from: '"SNS ADS Support" <sinhahaharshit67@gmail.com>',
        to: email,
        subject: 'Verify Your SNS ADS Account 🔐',
        html: `
            <div style="padding: 30px; background: #0f172a; color: white; border-radius: 10px; text-align: center; font-family: sans-serif;">
                 <h2 style="color: #3b82f6; text-transform: uppercase; letter-spacing: 2px;">SNS ADS Portal</h2>
                 <p style="color: #cbd5e1;">Hello ${name || 'Growth Partner'}, your secure verification code is:</p>
                 <h1 style="font-size: 45px; letter-spacing: 8px; color: #ffffff; margin: 20px 0;">${otp}</h1>
                 <p style="color: #64748b; font-size: 12px;">Do not share this code with anyone.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP Email sent to ${email}`);
        res.status(200).json({ message: "OTP Sent" });
    } catch (err) {
        console.error("Nodemailer Error:", err);
        res.status(500).json({ error: "Email failure", detail: err.message });
    }
});

app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (otpStore[email] && otpStore[email] === otp) {
        delete otpStore[email]; // Security ke liye verify hone ke baad delete
        res.status(200).json({ message: "Verified" });
    } else {
        res.status(400).json({ error: "Invalid OTP" });
    }
});

// ==========================================
// 2. CONTACT FORM ROUTE (Newly Added for index.html)
// ==========================================

app.post('/api/enquiry', async (req, res) => {
    const { name, phone, email, business, budget, date } = req.body;

    const mailOptions = {
        from: '"SNS ADS Leads" <sinhahaharshit67@gmail.com>',
        to: 'sinhahaharshit67@gmail.com', // Form bharne par alert is email par aayega
        subject: `🚀 New Strategy Call Request: ${name}`,
        html: `
            <div style="font-family: Arial; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #d97706;">New Client Enquiry Received!</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Phone:</strong> ${phone}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Business Name:</strong> ${business || 'N/A'}</p>
                <p><strong>Monthly Budget:</strong> ${budget || 'N/A'}</p>
                <p><strong>Submission Time:</strong> ${new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("Enquiry lead sent via Email");
        res.status(200).json({ message: "Enquiry received successfully" });
    } catch (err) {
        console.error("Enquiry Email Error:", err);
        res.status(500).json({ error: "Failed to process enquiry" });
    }
});

// ==========================================
// 3. RAZORPAY PAYMENT ROUTES
// ==========================================

app.post('/api/create-order', async (req, res) => {
    try {
        const { amount } = req.body;
        const options = {
            amount: Math.round(amount * 100), // Paise mein convert karna zaroori hai
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };
        const order = await razorpay.orders.create(options);
        res.status(200).json(order);
    } catch (err) {
        console.error("Razorpay Order Error:", err);
        res.status(500).json({ error: "Razorpay order fail ho gaya", detail: err.message });
    }
});

app.post('/api/payment-success', async (req, res) => {
    try {
        const { name, email, service, amount, paymentId, orderId } = req.body;
        
        // MongoDB mein lead save karna
        const newLead = new Lead({
            name, email, service,
            amount: amount / 100, // Wapas Rupees mein save karne ke liye
            paymentId, orderId,
            paymentStatus: 'Paid'
        });
        await newLead.save();

        // Confirmation Email (Background mein user ko jayega)
        const mailOptions = {
            from: '"SNS ADS Growth" <sinhahaharshit67@gmail.com>',
            to: email,
            subject: 'Order Confirmed - Welcome to SNS ADS 🚀',
            html: `
                <div style="font-family: Arial; padding: 20px;">
                    <h2 style="color: #16a34a;">Dhanyawad ${name}!</h2>
                    <p>Aapka payment successful raha for <strong>${service}</strong>.</p>
                    <p>Amount Paid: ₹${amount / 100}</p>
                    <p>Humari team jald hi aapke onboarding ke liye contact karegi.</p>
                </div>
            `
        };
        transporter.sendMail(mailOptions).catch(e => console.log("Email send fail (silent):", e.message));

        res.status(200).json({ message: "Lead saved successfully" });
    } catch (err) {
        console.error("Database Save Error:", err);
        res.status(500).json({ error: "Data save nahi ho paya" });
    }
});

// ==========================================
// 4. ADMIN DASHBOARD ROUTE
// ==========================================

app.get('/api/admin/leads', async (req, res) => {
    try {
        // MongoDB se saari leads nikaalo (latest orders upar aayenge)
        const leads = await Lead.find().sort({ date: -1 });
        res.status(200).json(leads);
    } catch (err) {
        res.status(500).json({ error: "Data fetch fail ho gaya" });
    }
});

// --- Server Start ---
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running perfectly on port ${PORT}`));