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
mongoose.set('strictQuery', false);

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
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected from MongoDB Atlas');
});
const User = require('./models/User');
const Member = require('./models/Member');

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

app.post('/api/signup', async (req, res) => {
    try {
        console.log('Signup request received:', req.body);
        
        const { username, email, phone, password } = req.body;
        if (!username) return res.status(400).json({ error: 'Username is required' });
        if (!email) return res.status(400).json({ error: 'Email is required' });
        if (!phone) return res.status(400).json({ error: 'Phone is required' });
        if (!password) return res.status(400).json({ error: 'Password is required' });

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const existingUser = await User.findOne({ 
            $or: [{ email }, { phone }] 
        });
        
        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({ error: 'Email already registered' });
            }
            if (existingUser.phone === phone) {
                return res.status(400).json({ error: 'Phone number already registered' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            username,
            email,
            phone,
            password: hashedPassword
        });

        await user.save();
        console.log('User saved successfully:', { 
            id: user._id, 
            username: user.username,
            email: user.email 
        });
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User created successfully',
            token
        });
    } catch (error) {
        console.error('Signup error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({ 
            error: 'Error creating user',
            details: error.message 
        });
    }
});
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

app.get('/api/members', authenticateUser, async (req, res) => {
    try {
        const members = await Member.find({ addedBy: req.user._id });
        console.log('Retrieved members:', members); 
        res.json(members);
    } catch (error) {
        console.error('Error fetching members:', error);
        res.status(500).json({ error: 'Error fetching members' });
    }
});
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
app.use(express.static('public'));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});