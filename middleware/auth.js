const Teacher = require('../models/Teacher');

const requireAuth = (req, res, next) => {
    if (!req.session.teacherId) {
        return res.redirect('/auth/login');
    }
    next();
};

const requireAdmin = async (req, res, next) => {
    try {
        const teacher = await Teacher.findById(req.session.teacherId);
        if (!teacher || teacher.role !== 'admin') {
            return res.status(403).render('error', { error: 'Admin access required' });
        }
        req.teacher = teacher;
        next();
    } catch (error) {
        res.redirect('/auth/login');
    }
};

const attachTeacherInfo = async (req, res, next) => {
    if (req.session.teacherId) {
        try {
            const teacher = await Teacher.findById(req.session.teacherId);
            if (teacher) {
                req.teacher = teacher;
                res.locals.teacher = teacher;
                res.locals.teacherRole = teacher.role;
            }
        } catch (error) {
            console.error('Error attaching teacher info:', error);
        }
    }
    next();
};

module.exports = { requireAuth, requireAdmin, attachTeacherInfo };