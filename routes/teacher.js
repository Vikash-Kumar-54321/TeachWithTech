const express = require("express");
const axios = require("axios");
const router = express.Router();

const { requireAuth, attachTeacherInfo } = require("../middleware/auth");
const Lecture = require("../models/Lecture");
const Teacher = require("../models/Teacher");

// =====================
// CONFIG
// =====================
const PYTHON_API = process.env.PYTHON_API_URL;

// =====================
// MIDDLEWARE
// =====================
router.use(requireAuth);
router.use(attachTeacherInfo);

// =====================
// DASHBOARD
// =====================
router.get("/dashboard", async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const lectures = await Lecture.find({
            teacher: req.session.teacherId,
            date: { $gte: today, $lt: tomorrow }
        }).sort({ "schedule.startTime": 1 });

        const currentTime = new Date().toTimeString().slice(0, 5);

        let currentLecture = null;
        for (const lecture of lectures) {
            const canRecord =
                currentTime >= lecture.schedule.startTime &&
                currentTime <= lecture.schedule.endTime;

            if (lecture.status === "recording" || canRecord) {
                currentLecture = lecture;
                break;
            }
        }

        res.render("teacher/dashboard", {
            lectures,
            currentLecture,
            currentTime,
            title: "Teacher Dashboard"
        });

    } catch (err) {
        console.error(err);
        res.render("error", { error: "Dashboard error" });
    }
});

// =====================
// MARK ATTENDANCE PAGE
// =====================
router.get("/markAttendance", (req, res) => {
    if (!req.teacher) return res.redirect("/auth/login");
    res.render("teacher/markAttendance", {
        teacher: req.teacher,
        title: "Mark Attendance"
    });
});

// =======================================================
// 🔥 ATTENDANCE – PRODUCTION SAFE FLOW (NO LOCALHOST)
// =======================================================

// ---------- START VERIFICATION ----------
router.post("/start-verification", async (req, res) => {
    try {
        const { email, imageUrl } = req.body;

        const response = await axios.post(
            `${PYTHON_API}/start_verification`,
            { email, imageUrl }
        );

        res.json({ success: true, ...response.data });

    } catch (err) {
        console.error("Start verification error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to start verification"
        });
    }
});

// ---------- VERIFICATION STATUS ----------
router.get("/verification-status", async (req, res) => {
    try {
        const response = await axios.get(`${PYTHON_API}/status`);
        res.json(response.data);
    } catch (err) {
        console.error("Status error:", err.message);
        res.json({ attendance_done: false });
    }
});

// ---------- VIDEO FEED (STREAM PROXY) ----------
router.get("/video-feed", async (req, res) => {
    try {
        const response = await axios.get(
            `${PYTHON_API}/video_feed`,
            { responseType: "stream" }
        );

        res.setHeader(
            "Content-Type",
            "multipart/x-mixed-replace; boundary=frame"
        );

        response.data.pipe(res);

    } catch (err) {
        console.error("Video feed error:", err.message);
        res.end();
    }
});

// ---------- STOP VERIFICATION ----------
router.post("/stop-verification", async (req, res) => {
    try {
        await axios.post(`${PYTHON_API}/stop_verification`);
        res.json({ success: true });
    } catch (err) {
        console.error("Stop error:", err.message);
        res.json({ success: false });
    }
});

// =======================================================
// SAVE ATTENDANCE (CALLED BY PYTHON)
// =======================================================
router.post("/mark-attendance", async (req, res) => {
    try {
        const apiKey = req.headers["x-api-key"];
        if (apiKey !== "my-secret-key") {
            return res.status(401).json({ success: false });
        }

        const { email, date, time, faceMatched, locationMatched } = req.body;

        const teacher = await Teacher.findOne({ email });
        if (!teacher) {
            return res.status(404).json({ success: false });
        }

        const index = teacher.attendance.findIndex(a => a.date === date);

        const record = {
            date,
            time,
            faceMatched: !!faceMatched,
            locationMatched: !!locationMatched,
            verified: faceMatched && locationMatched
        };

        if (index >= 0) {
            teacher.attendance[index] = record;
        } else {
            teacher.attendance.push(record);
        }

        await teacher.save();

        res.json({ success: true });

    } catch (err) {
        console.error("Attendance save error:", err);
        res.status(500).json({ success: false });
    }
});

// =====================
// ATTENDANCE STATUS
// =====================
router.get("/attendance-status", async (req, res) => {
    try {
        const { email } = req.query;
        const teacher = await Teacher.findOne({ email });

        if (!teacher) {
            return res.json({ success: false });
        }

        const today = new Date().toISOString().split("T")[0];
        const attendance = teacher.attendance.find(a => a.date === today);

        res.json({
            success: true,
            data: {
                attendanceMarked: !!attendance,
                attendance: attendance || null
            }
        });

    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});

module.exports = router;
