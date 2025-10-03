const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    if (req.session.teacherId) {
        return res.redirect('/teacher/dashboard');
    }
    res.render('index', { title: 'Lecture Recording System' });
});

router.get('/about', (req, res) => {
    res.render('about', { title: 'About the System' });
});

module.exports = router;