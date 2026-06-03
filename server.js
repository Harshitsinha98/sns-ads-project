const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Razorpay = require('razorpay');
require('dotenv').config();

const app = express();
app.use(express.json());

// --- CORS Setup ---
app.use(cors({
    origin: '*', 
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

// ==========================================
// BREVO API HELPER FUNCTION (Updated Sender)
// ==========================================
async function sendEmailViaBrevo(toEmail, toName, subject, htmlContent) {
    const BREVO_API_KEY = process.env.BREVO_API_KEY; 

    if (!BREVO_API_KEY) {
        console.error("Missing Brevo API Key in Environment Variables");
        throw new Error("Server config error");
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': BREVO_API_KEY,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: { name: "SNS ADS", email: "admin@pragathanumanji.in" }, // Yahan update kar diya hai
            to: [{ email: toEmail, name: toName || "Client" }],
            subject: subject,
            htmlContent: htmlContent
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Brevo Validation Error:", errorData);
        throw new Error("Email dispatch rejected by Brevo API");
    }
    return response;
}

// Temporary memory store for OTPs
let otpStore = {}; 

// ==========================================
// 1. OTP ROUTES
// ==========================================

app.post('/api/send-otp', async (req, res) => {
    const { email, name } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = otp; 

    const subject = 'Verify Your SNS ADS Account 🔐';
    const htmlContent = `
        <div style="padding: 30px; background: #0f172a; color: white; border-radius: 10px; text-align: center; font-family: sans-serif;">
             <h2 style="color: #3b82f6; text-transform: uppercase; letter-spacing: 2px;">SNS ADS Portal</h2>
             <p style="color: #cbd5e1;">Hello ${name || 'Growth Partner'}, your secure verification code is:</p>
             <h1 style="font-size: 45px; letter-spacing: 8px; color: #ffffff; margin: 20px 0;">${otp}</h1>
             <p style="color: #64748b; font-size: 12px;">Do not share this code with anyone.</p>
        </div>
    `;

    try {
        await sendEmailViaBrevo(email, name, subject, htmlContent);
        res.status(200).json({ message: "OTP Sent Successfully" });
    } catch (err) {
        console.error("Brevo OTP Delivery Error:", err);
        res.status(500).json({ error: "Email failure", detail: err.message });
    }
});

app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (otpStore[email] && otpStore[email] === otp) {
        delete otpStore[email]; 
        res.status(200).json({ message: "Verified" });
    } else {
        res.status(400).json({ error: "Invalid OTP" });
    }
});

// ==========================================
// 2. CONTACT FORM ROUTE
// ==========================================

app.post('/api/enquiry', async (req, res) => {
    const { name, phone, email, business, budget, date } = req.body;

    const subject = `🚀 New Strategy Call Request: ${name}`;
    const htmlContent = `
        <div style="font-family: Arial; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #d97706;">New Client Enquiry Received!</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Business Name:</strong> ${business || 'N/A'}</p>
            <p><strong>Monthly Budget:</strong> ${budget || 'N/A'}</p>
            <p><strong>Time:</strong> ${new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        </div>
    `;

    try {
        await sendEmailViaBrevo('admin@pragathanumanji.in', 'Admin', subject, htmlContent);
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
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };
        const order = await razorpay.orders.create(options);
        res.status(200).json(order);
    } catch (err) {
        res.status(500).json({ error: "Razorpay order failed", detail: err.message });
    }
});

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

        const subject = 'Order Confirmed - Welcome to SNS ADS 🚀';
        const htmlContent = `
            <div style="font-family: Arial; padding: 20px;">
                <h2 style="color: #16a34a;">Dhanyawad ${name}!</h2>
                <p>Aapka payment successful raha for <strong>${service}</strong>.</p>
                <p>Amount Paid: ₹${amount / 100}</p>
                <p>Humari team jald hi aapke onboarding ke liye contact karegi.</p>
            </div>
        `;
        
        sendEmailViaBrevo(email, name, subject, htmlContent).catch(e => console.log("Silent Email Fail:", e.message));

        res.status(200).json({ message: "Lead saved successfully" });
    } catch (err) {
        res.status(500).json({ error: "Data save failed" });
    }
});

// ==========================================
// 4. ADMIN DASHBOARD ROUTE
// ==========================================

app.get('/api/admin/leads', async (req, res) => {
    try {
        const leads = await Lead.find().sort({ date: -1 });
        res.status(200).json(leads);
    } catch (err) {
        res.status(500).json({ error: "Data fetch fail ho gaya" });
    }
});

// --- Server Start ---
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running perfectly on port ${PORT}`));

// Phone OTP Store
let phoneOtpStore = {};

// Route for Phone OTP
app.post('/api/send-phone-otp', async (req, res) => {
    const { phone } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    phoneOtpStore[phone] = otp; 
    
    console.log(`OTP for ${phone}: ${otp}`); // Yahan se aap console mein OTP dekh sakte hain
    res.status(200).json({ message: "OTP Sent Successfully" });
});

// Route for Phone OTP Verify
app.post('/api/verify-phone-otp', (req, res) => {
    const { phone, otp } = req.body;
    if (phoneOtpStore[phone] && phoneOtpStore[phone] === otp) {
        delete phoneOtpStore[phone];
        res.status(200).json({ message: "Verified" });
    } else {
        res.status(400).json({ error: "Invalid OTP" });
    }
});

// ==========================================
// 5. CUSTOMER DASHBOARD ROUTE
// ==========================================
app.get('/api/my-orders', async (req, res) => {
    try {
        const { email, phone } = req.query;
        
        let query = {};
        // Check karenge ki user email se aaya hai ya phone se
        if (email) query.email = email;
        else if (phone) query.service = { $regex: phone, $options: 'i' }; // Phone number humne service description me save kiya tha
        else return res.status(400).json({ error: "Unauthorized access" });

        // Database se orders fetch karo, newest first
        const orders = await Lead.find(query).sort({ date: -1 });
        
        res.status(200).json(orders);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch orders" });
    }
});