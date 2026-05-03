const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(express.json());
// server.js ke top par ye replace karein
app.use(cors({
    origin: '*', // Pitch ke liye ise open rakho taaki koi blockage na ho
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

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
// --- RAZORPAY ORDER CREATE ROUTE ---
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

// --- PAYMENT SUCCESS & DATA SAVE ROUTE ---
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

        // Confirmation Email (Background mein)
        const mailOptions = {
            from: '"SNS ADS" <sinhahaharshit67@gmail.com>',
            to: email,
            subject: 'Order Confirmed - SNS ADS',
            html: `<h2>Dhanyawad ${name}!</h2><p>Aapka payment successful raha. Hum jald hi aapse contact karenge.</p>`
        };
        transporter.sendMail(mailOptions).catch(e => console.log("Email send fail (silent):", e.message));

        res.status(200).json({ message: "Lead saved successfully" });
    } catch (err) {
        console.error("Database Save Error:", err);
        res.status(500).json({ error: "Data save nahi ho paya" });
    }
});
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));