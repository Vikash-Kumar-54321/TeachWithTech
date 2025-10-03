require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/database');
const scheduleManager = require('./middleware/schedule');

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'lecture-system-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Add teacher info to all views
app.use(async (req, res, next) => {
    if (req.session.teacherId) {
        try {
            const Teacher = require('./models/Teacher');
            const teacher = await Teacher.findById(req.session.teacherId);
            if (teacher) {
                req.teacher = teacher;
                res.locals.teacher = teacher;
                res.locals.teacherRole = teacher.role;
            }
        } catch (error) {
            console.error('Error loading teacher data:', error);
        }
    }
    next();
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/teacher', require('./routes/teacher'));
app.use('/recording', require('./routes/recording'));
app.use('/upload', require('./routes/upload'));

// API routes
app.get('/api/current-lecture', async (req, res) => {
    try {
        if (!req.session.teacherId) {
            return res.json({ lecture: null });
        }

        const Lecture = require('./models/Lecture');
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);
        
        const lecture = await Lecture.findOne({
            teacher: req.session.teacherId,
            date: {
                $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
            },
            $or: [
                { status: 'recording' },
                { 
                    status: 'scheduled',
                    'schedule.startTime': { $lte: currentTime },
                    'schedule.endTime': { $gte: currentTime }
                }
            ]
        });

        res.json({ lecture });
    } catch (error) {
        console.error('API error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).render('error', { 
        error: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('404');
});

// Start schedule monitoring
scheduleManager.startScheduleMonitoring();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Visit: http://localhost:${PORT}`);
    console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    await mongoose.connection.close();
    process.exit(0);
});