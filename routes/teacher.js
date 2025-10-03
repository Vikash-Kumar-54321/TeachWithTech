const express = require('express');
const { requireAuth, attachTeacherInfo } = require('../middleware/auth');
const Lecture = require('../models/Lecture');
const router = express.Router();
const Teacher = require('../models/Teacher'); 

router.use(requireAuth);
router.use(attachTeacherInfo);

// Teacher dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const lectures = await Lecture.find({
            teacher: req.session.teacherId,
            date: {
                $gte: today,
                $lt: tomorrow
            }
        }).sort({ 'schedule.startTime': 1 });

        const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
        
        // Find current or next lecture
        let currentLecture = null;
        for (const lecture of lectures) {
            const canRecord = currentTime >= lecture.schedule.startTime && 
                            currentTime <= lecture.schedule.endTime;
            if (lecture.status === 'recording' || canRecord) {
                currentLecture = lecture;
                break;
            }
        }

        res.render('teacher/dashboard', { 
            lectures, 
            currentLecture,
            currentTime,
            title: 'Teacher Dashboard',
            message: req.query.message
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render('error', { error: 'Error loading dashboard' });
    }
});

// Recording page
router.get('/recording/:lectureId', async (req, res) => {
    try {
        const lecture = await Lecture.findOne({
            _id: req.params.lectureId,
            teacher: req.session.teacherId
        }).populate('teacher');

        if (!lecture) {
            return res.status(404).render('error', { error: 'Lecture not found' });
        }

        const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
        const canRecord = currentTime >= lecture.schedule.startTime && 
                        currentTime <= lecture.schedule.endTime;

        if (!canRecord && lecture.status !== 'recording') {
            return res.render('error', { 
                error: 'Recording is not available at this time. Scheduled time: ' + 
                       lecture.schedule.startTime + ' - ' + lecture.schedule.endTime
            });
        }

        res.render('teacher/recording', { 
            lecture, 
            title: `Record - ${lecture.title}` 
        });
    } catch (error) {
        console.error('Recording page error:', error);
        res.render('error', { error: 'Error loading recording page' });
    }
});

// Lecture history
router.get('/lectures', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const lectures = await Lecture.find({ teacher: req.session.teacherId })
            .sort({ date: -1, 'schedule.startTime': -1 })
            .skip(skip)
            .limit(limit);

        const total = await Lecture.countDocuments({ teacher: req.session.teacherId });
        const totalPages = Math.ceil(total / limit);

        res.render('teacher/lectures', { 
            lectures, 
            currentPage: page,
            totalPages,
            title: 'My Lectures' 
        });
    } catch (error) {
        console.error('Lectures list error:', error);
        res.render('error', { error: 'Error loading lectures' });
    }
});

// Lecture details
router.get('/lectures/:lectureId', async (req, res) => {
    try {
        const lecture = await Lecture.findOne({
            _id: req.params.lectureId,
            teacher: req.session.teacherId
        }).populate('teacher');

        if (!lecture) {
            return res.status(404).render('error', { error: 'Lecture not found' });
        }

        res.render('teacher/lecture-details', { 
            lecture, 
            title: `Lecture Details - ${lecture.title}` 
        });
    } catch (error) {
        console.error('Lecture details error:', error);
        res.render('error', { error: 'Error loading lecture details' });
    }
});


router.get("/markAttendance", (req, res) => {
    if (!req.teacher) return res.redirect("/auth/login"); // <-- use req.teacher
    res.render("teacher/markAttendance", { teacher: req.teacher, title: "Mark Attendance" });
});


// Save attendance (called by Flask after verification)



router.post('/mark-attendance', async (req, res) => {
    try {
        // ✅ Check API Key in headers
        const apiKey = req.headers['x-api-key'];
        if (!apiKey || apiKey !== "my-secret-key") {
            return res.status(401).json({
                success: false,
                message: "Unauthorized - Invalid API Key"
            });
        }

        const { email, date, time, faceMatched, locationMatched, verified } = req.body;

        console.log('📝 Received attendance data:', req.body);

        // Validate required fields
        if (!email || !date || !time) {
            return res.status(400).json({
                success: false,
                message: 'Email, date, and time are required'
            });
        }

        // Find teacher by email
        const teacher = await Teacher.findOne({ email });
        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        console.log(`👨‍🏫 Found teacher: ${teacher.name}`);

        // Check if attendance already marked for today
        const today = date; // YYYY-MM-DD format
        const existingAttendanceIndex = teacher.attendance.findIndex(record =>
            record.date === today
        );

        console.log(`📅 Existing attendance index: ${existingAttendanceIndex}`);

        let action = 'created';
        let attendanceRecord;

        if (existingAttendanceIndex !== -1) {
            // Update existing attendance record
            teacher.attendance[existingAttendanceIndex] = {
                date: date,
                time: time,
                faceMatched: faceMatched !== undefined ? faceMatched : false,
                locationMatched: locationMatched !== undefined ? locationMatched : false,
                verified: verified !== undefined ? verified : (faceMatched && locationMatched)
            };
            action = 'updated';
            attendanceRecord = teacher.attendance[existingAttendanceIndex];
        } else {
            // Add new attendance record
            attendanceRecord = {
                date: date,
                time: time,
                faceMatched: faceMatched !== undefined ? faceMatched : false,
                locationMatched: locationMatched !== undefined ? locationMatched : false,
                verified: verified !== undefined ? verified : (faceMatched && locationMatched)
            };
            teacher.attendance.push(attendanceRecord);
        }

        console.log(`💾 Saving attendance record:`, attendanceRecord);

        // Save teacher doc
        await teacher.save();

        console.log(`✅ Attendance ${action} for teacher: ${teacher.name}`);
        console.log(`📊 Total attendance records: ${teacher.attendance.length}`);

        res.json({
            success: true,
            message: `Attendance ${action} successfully`,
            data: {
                teacher: teacher.name,
                email: teacher.email,
                date: date,
                time: time,
                faceMatched: attendanceRecord.faceMatched,
                locationMatched: attendanceRecord.locationMatched,
                verified: attendanceRecord.verified,
                action: action
            }
        });

    } catch (error) {
        console.error('❌ Error marking attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});


// Check today's attendance status
// Check today's attendance status
// router.get('/attendance-status', async (req, res) => {
//     try {
//         const { email } = req.query;
        
//         if (!email) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Email is required'
//             });
//         }

//         console.log(`🔍 Checking attendance status for: ${email}`);

//         const teacher = await Teacher.findOne({ email });
//         if (!teacher) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Teacher not found'
//             });
//         }

//         const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
//         console.log(`📅 Today's date: ${today}`);
        
//         const todayAttendance = teacher.attendance.find(record => record.date === today);

//         console.log(`📊 Today's attendance found:`, todayAttendance);
//         console.log(`📋 Total attendance records: ${teacher.attendance.length}`);

//         res.json({
//             success: true,
//             data: {
//                 attendanceMarked: !!todayAttendance,
//                 attendance: todayAttendance || null
//             }
//         });

//     } catch (error) {
//         console.error('❌ Error checking attendance status:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     }
// });

// Fix the attendance-status route in your Express app
// Fix the attendance-status route in your Express app
router.get('/attendance-status', async (req, res) => {
    try {
        const { email } = req.query;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        console.log(`🔍 Checking attendance status for: ${email}`);

        const teacher = await Teacher.findOne({ email });
        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        // Get both UTC and local dates to handle timezone differences
        const now = new Date();
        const todayUTC = now.toISOString().split('T')[0]; // UTC date (what Flask uses)
        const todayLocal = now.toLocaleDateString('en-CA'); // Local date YYYY-MM-DD
        
        console.log(`📅 Today's date - UTC: ${todayUTC}, Local: ${todayLocal}`);
        console.log(`📋 Total attendance records: ${teacher.attendance.length}`);
        
        // Debug: log all attendance records
        console.log('📊 All attendance records:', teacher.attendance);

        // Check for attendance with both UTC and local dates
        let todayAttendance = teacher.attendance.find(record => record.date === todayUTC);
        
        // If not found with UTC date, try local date
        if (!todayAttendance) {
            todayAttendance = teacher.attendance.find(record => record.date === todayLocal);
            if (todayAttendance) {
                console.log('🔄 Found attendance using local date instead of UTC');
            }
        }

        console.log(`🎯 Today's attendance found:`, todayAttendance);

        res.json({
            success: true,
            data: {
                attendanceMarked: !!todayAttendance,
                attendance: todayAttendance || null
            }
        });

    } catch (error) {
        console.error('❌ Error checking attendance status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Get all attendance records for a teacher
// Get all attendance records for a teacher
router.get('/attendance-history', async (req, res) => {
    try {
        const { email } = req.query;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const teacher = await Teacher.findOne({ email }).select('name email attendance');
        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        // Sort attendance by date (newest first)
        const sortedAttendance = teacher.attendance.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            success: true,
            data: {
                teacher: teacher.name,
                email: teacher.email,
                attendance: sortedAttendance
            }
        });

    } catch (error) {
        console.error('Error fetching attendance history:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Debug route to check database storage
router.get('/debug/:lectureId', async (req, res) => {
    try {
        const lecture = await Lecture.findOne({
            _id: req.params.lectureId,
            teacher: req.session.teacherId
        });
        
        if (!lecture) {
            return res.json({ error: 'Lecture not found' });
        }

        res.json({
            lecture: {
                title: lecture.title,
                youtubeTranscript: {
                    exists: !!lecture.youtubeVideo?.transcript,
                    length: lecture.youtubeVideo?.transcript?.length || 0,
                    generated: lecture.youtubeVideo?.transcriptGenerated || false,
                    generatedAt: lecture.youtubeVideo?.transcriptGeneratedAt
                },
                recordingTranscript: {
                    exists: !!lecture.recording?.transcript,
                    length: lecture.recording?.transcript?.length || 0,
                    wordCount: lecture.recording?.wordCount || 0,
                    generatedAt: lecture.recording?.transcriptGeneratedAt
                },
                analysis: {
                    matchPercentage: lecture.analysis?.transcriptMatchPercentage,
                    humanVoiceProbability: lecture.analysis?.humanVoiceProbability,
                    status: lecture.analysis?.status,
                    analyzedAt: lecture.analysis?.analyzedAt
                }
            }
        });

    } catch (error) {
        res.json({ error: error.message });
    }
});

module.exports = router;