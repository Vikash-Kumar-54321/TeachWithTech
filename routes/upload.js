const express = require('express');
const multer = require('multer');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Configure multer for audio storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/audio');
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'recording-' + uniqueSuffix + '.webm');
    }
});

const fileFilter = (req, file, cb) => {
    // Check if file is audio
    if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
    } else {
        cb(new Error('Only audio files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

router.use(requireAuth);

// Audio upload endpoint
router.post('/audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No audio file uploaded' 
            });
        }

        const audioUrl = `/audio/${req.file.filename}`;
        
        res.json({ 
            success: true, 
            audioUrl: audioUrl,
            filename: req.file.filename,
            message: 'Audio uploaded successfully'
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'File upload failed: ' + error.message 
        });
    }
});

module.exports = router;