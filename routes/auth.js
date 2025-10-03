const express = require('express');
const Teacher = require('../models/Teacher');
const router = express.Router();

// Login page
router.get('/login', (req, res) => {
    if (req.session.teacherId) {
        return res.redirect('/teacher/dashboard');
    }
    res.render('auth/login', { error: null });
});

// Login handler
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.render('auth/login', { error: 'Email and password are required' });
        }

        const teacher = await Teacher.findOne({ email });
        
        if (!teacher || !(await teacher.comparePassword(password))) {
            return res.render('auth/login', { error: 'Invalid email or password' });
        }

        if (!teacher.isActive) {
            return res.render('auth/login', { error: 'Account is deactivated' });
        }

        req.session.teacherId = teacher._id;
        req.session.teacherRole = teacher.role;

        res.redirect(teacher.role === 'admin' ? '/admin/dashboard' : '/teacher/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        res.render('auth/login', { error: 'Login failed. Please try again.' });
    }
});

// Registration page
router.get('/register', (req, res) => {
    if (req.session.teacherId) {
        return res.redirect('/teacher/dashboard');
    }
    res.render('auth/register', { error: null });
});

// Registration handler
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, confirmPassword, subjects, classes } = req.body;
        
        if (password !== confirmPassword) {
            return res.render('auth/register', { error: 'Passwords do not match' });
        }

        const existingTeacher = await Teacher.findOne({ email });
        if (existingTeacher) {
            return res.render('auth/register', { error: 'Email already registered' });
        }

        const teacher = new Teacher({ 
            name, 
            email, 
            password,
            subjects: subjects ? subjects.split(',').map(s => s.trim()) : [],
            classes: classes ? classes.split(',').map(c => c.trim()) : []
        });

        await teacher.save();

        res.redirect('/auth/login?message=Registration successful. Please login.');
    } catch (error) {
        console.error('Registration error:', error);
        res.render('auth/register', { error: 'Registration failed. Please try again.' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/auth/login');
    });
});

module.exports = router;