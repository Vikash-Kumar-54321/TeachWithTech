const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Lecture = require('../models/Lecture');
const Teacher = require('../models/Teacher');
const Schedule = require('../models/Schedule');
const router = express.Router();

router.use(requireAuth, requireAdmin);

// Admin dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const lectures = await Lecture.find()
            .populate('teacher')
            .sort({ date: -1, 'schedule.startTime': 1 })
            .limit(50);

        const teachers = await Teacher.find({ isActive: true });
        const today = new Date();
        
        const todaysLectures = lectures.filter(lecture => 
            lecture.date.toDateString() === today.toDateString()
        );

        res.render('admin/dashboard', { 
            lectures, 
            teachers, 
            todaysLectures,
            title: 'Admin Dashboard' 
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render('error', { error: 'Error loading dashboard' });
    }
});

// Create lecture page
router.get('/create-lecture', async (req, res) => {
    try {
        const teachers = await Teacher.find({ isActive: true });
        res.render('admin/create-lecture', { 
            teachers, 
            title: 'Create New Lecture' 
        });
    } catch (error) {
        res.render('error', { error: 'Error loading form' });
    }
});

// Create lecture handler - UPDATED FOR MANUAL TRANSCRIPT
router.post('/create-lecture', async (req, res) => {
    try {
        const { 
            title, 
            teacherId, 
            subject, 
            class: className, 
            date, 
            startTime, 
            endTime, 
            youtubeUrl, 
            referenceTranscript 
        } = req.body;
        
        console.log('📝 Creating new lecture:', title);
        console.log('📝 YouTube URL:', youtubeUrl);
        console.log('📝 Reference transcript length:', referenceTranscript ? referenceTranscript.length : 0);

        if (!title || !teacherId || !subject || !className || !date || !startTime || !endTime) {
            return res.render('admin/create-lecture', { 
                error: 'All fields are required',
                teachers: await Teacher.find({ isActive: true })
            });
        }

        const lecture = new Lecture({
            title,
            teacher: teacherId,
            subject,
            class: className,
            date: new Date(date),
            schedule: { startTime, endTime },
            youtubeVideo: { 
                url: youtubeUrl,
                transcript: referenceTranscript || null,
                transcriptGenerated: !!referenceTranscript, // true if transcript provided
                transcriptGeneratedAt: referenceTranscript ? new Date() : null
            }
        });

        await lecture.save();
        console.log('✅ Lecture created with ID:', lecture._id);
        console.log('✅ Reference transcript stored:', !!referenceTranscript);

        res.redirect('/admin/dashboard?message=Lecture created successfully');

    } catch (error) {
        console.error('❌ Create lecture error:', error);
        res.render('admin/create-lecture', { 
            error: 'Error creating lecture',
            teachers: await Teacher.find({ isActive: true })
        });
    }
});

// Schedules management
router.get('/schedules', async (req, res) => {
    try {
        const schedules = await Schedule.find()
            .populate('teacher')
            .sort({ day: 1, startTime: 1 });

        res.render('admin/schedules', { 
            schedules, 
            title: 'Manage Schedules' 
        });
    } catch (error) {
        res.render('error', { error: 'Error loading schedules' });
    }
});

// Teacher management page
router.get('/teachers', async (req, res) => {
    try {
        const teachers = await Teacher.find().sort({ name: 1 });
        res.render('admin/teachers', { 
            teachers, 
            title: 'Manage Teachers' 
        });
    } catch (error) {
        console.error('Error loading teachers:', error);
        res.render('error', { error: 'Error loading teachers' });
    }
});
// Create teacher handler
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer with Cloudinary storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'lecture-system/teachers',
        format: async (req, file) => 'jpg',
        public_id: (req, file) => {
            return `teacher-${Date.now()}`;
        },
    },
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Create teacher handler with file upload
router.post('/teachers', upload.single('profileImage'), async (req, res) => {
    try {
        const { name, email, password, subjects, classes, role } = req.body;
        
        const existingTeacher = await Teacher.findOne({ email });
        if (existingTeacher) {
            // Delete uploaded file if teacher already exists
            if (req.file) {
                await cloudinary.uploader.destroy(req.file.filename);
            }
            return res.render('admin/teachers', { 
                error: 'Teacher with this email already exists',
                teachers: await Teacher.find().sort({ name: 1 })
            });
        }

        const teacherData = {
            name,
            email,
            password,
            subjects: subjects ? subjects.split(',').map(s => s.trim()) : [],
            classes: classes ? classes.split(',').map(c => c.trim()) : [],
            role: role || 'teacher'
        };

        // Add image data if file was uploaded
        if (req.file) {
            teacherData.imageUrl = req.file.path;
            teacherData.cloudinaryId = req.file.filename;
        }

        const teacher = new Teacher(teacherData);
        await teacher.save();
        
        res.redirect('/admin/teachers?message=Teacher created successfully');
        
    } catch (error) {
        console.error('Error creating teacher:', error);
        
        // Delete uploaded file if error occurred
        if (req.file) {
            try {
                await cloudinary.uploader.destroy(req.file.filename);
            } catch (deleteError) {
                console.error('Error deleting uploaded file:', deleteError);
            }
        }
        
        res.render('admin/teachers', { 
            error: 'Error creating teacher: ' + error.message,
            teachers: await Teacher.find().sort({ name: 1 })
        });
    }
});

module.exports = router;