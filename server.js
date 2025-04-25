require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Successfully connected to MongoDB Atlas');
        console.log('Database:', mongoose.connection.name);
        console.log('Host:', mongoose.connection.host);
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Add connection event handlers
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected from MongoDB Atlas');
});

// Import models
const User = require('./models/User');
const Member = require('./models/Member');

// Authentication middleware
const authenticateUser = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Please authenticate' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Please authenticate' });
    }
};

// Signup Route
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = new User({
            name,
            email,
            phone,
            password: hashedPassword
        });
        
        await user.save();
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error creating user' });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = await User.findOne({
            $or: [{ email: identifier }, { phone: identifier }]
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        
        // Generate JWT token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
            expiresIn: '24h'
        });
        
        res.json({ 
            userId: user._id, 
            name: user.name,
            token
        });
    } catch (error) {
        res.status(500).json({ error: 'Error logging in' });
    }
});

// Add Member Route (Protected)
app.post('/api/members', authenticateUser, async (req, res) => {
    try {
        const { name, age, phone, email, plan, timing, duration, startDate } = req.body;
        if (!name || !age || !phone || !email || !plan || !timing || !duration || !startDate) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        const member = new Member({
            name,
            age,
            phone,
            email,
            plan,
            timing,
            duration,
            startDate: new Date(startDate),
            addedBy: req.user._id
        });
        await member.save();
        res.status(201).json({ message: 'Member added successfully', member });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Members Route (Protected)
app.get('/api/members', authenticateUser, async (req, res) => {
    try {
        const members = await Member.find({ addedBy: req.user._id });
        console.log('Retrieved members:', members); // Debug log
        res.json(members);
    } catch (error) {
        console.error('Error fetching members:', error);
        res.status(500).json({ error: 'Error fetching members' });
    }
});

// Test route to verify everything is working
app.get('/api/status', async (req, res) => {
    try {
        const stats = {
            usersCount: await User.countDocuments(),
            membersCount: await Member.countDocuments(),
            dbConnection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
        };
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this route to test the connection and view members
app.get('/api/test-db', async (req, res) => {
    try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        const memberCount = await Member.countDocuments();
        res.json({
            status: 'connected',
            collections: collections.map(c => c.name),
            memberCount,
            connectionState: mongoose.connection.readyState
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Handle all other routes by serving index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});