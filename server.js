const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// 1. Database Connection
mongoose.connect("mongodb+srv://sinhaharshit67_db_user:lkysa0Xm1tryCI3o@cluster0.ar6yjcf.mongodb.net/sns_ads_db?retryWrites=true&w=majority")
.then(() => console.log("✅ Astra connected to MongoDB!"))
.catch((err) => console.log("❌ DB Error:", err));

// --- YE SECTION ADD KIYA HAI ---
// Check karne ke liye ki backend zinda hai ya nahi
app.get('/', (req, res) => {
    res.send("🚀 SNS ADS Backend is Running on Astra!");
});
// -------------------------------

// 2. Lead Schema
const leadSchema = new mongoose.Schema({
    name: String,
    email: String,
    service: String,
    date: { type: Date, default: Date.now }
});
const Lead = mongoose.model('Lead', leadSchema);

// 3. API Route
app.post('/api/contact', async (req, res) => {
    console.log("Data received from Frontend:", req.body); // Debugging ke liye
    try {
        const newLead = new Lead(req.body);
        await newLead.save();
        res.status(201).json({ message: "Lead saved successfully!" });
    } catch (err) {
        console.log("Save Error:", err);
        res.status(500).json({ error: "Failed to save lead" });
    }
});

const PORT = 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));