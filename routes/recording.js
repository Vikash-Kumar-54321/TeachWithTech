const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Lecture = require('../models/Lecture');
const assemblyAIService = require('../services/assemblyAI');
const grokAIService = require('../services/grokAI');
const audioProcessor = require('../services/audioProcessor');
const router = express.Router();

router.use(requireAuth);

// Start recording
router.post('/start/:lectureId', async (req, res) => {
    try {
        const lecture = await Lecture.findOne({
            _id: req.params.lectureId,
            teacher: req.session.teacherId
        });

        if (!lecture) {
            return res.status(404).json({ success: false, error: 'Lecture not found' });
        }

        // Check if lecture is within scheduled time
        const currentTime = new Date();
        const lectureDate = new Date(lecture.date);
        const lectureStartTime = new Date(lectureDate);
        const lectureEndTime = new Date(lectureDate);
        
        // Parse start and end times
        const [startHours, startMinutes] = lecture.schedule.startTime.split(':').map(Number);
        const [endHours, endMinutes] = lecture.schedule.endTime.split(':').map(Number);
        
        lectureStartTime.setHours(startHours, startMinutes, 0, 0);
        lectureEndTime.setHours(endHours, endMinutes, 0, 0);

        if (currentTime < lectureStartTime || currentTime > lectureEndTime) {
            return res.status(400).json({ 
                success: false, 
                error: 'Recording outside scheduled time' 
            });
        }

        lecture.recording.startTime = currentTime;
        lecture.status = 'recording';
        await lecture.save();

        res.json({ success: true, message: 'Recording started' });
    } catch (error) {
        console.error('Start recording error:', error);
        res.status(500).json({ success: false, error: 'Error starting recording' });
    }
});

// Stop recording and process
router.post('/stop/:lectureId', async (req, res) => {
    try {
        const { audioUrl, filename, duration } = req.body;
        const lecture = await Lecture.findOne({
            _id: req.params.lectureId,
            teacher: req.session.teacherId
        });

        if (!lecture) {
            return res.status(404).json({ success: false, error: 'Lecture not found' });
        }

        lecture.recording.endTime = new Date();
        lecture.recording.audioUrl = audioUrl;
        lecture.recording.duration = duration;
        lecture.status = 'completed';
        await lecture.save();

        // Process in background
        processLectureAnalysis(lecture._id, filename);

        res.json({ 
            success: true, 
            message: 'Recording stopped. Analysis started.' 
        });
    } catch (error) {
        console.error('Stop recording error:', error);
        res.status(500).json({ success: false, error: 'Error stopping recording' });
    }
});

async function processLectureAnalysis(lectureId, filename) {
    try {
        console.log('\n🎯 ===== STARTING LECTURE ANALYSIS PROCESS =====');
        
        const lecture = await Lecture.findById(lectureId);
        if (!lecture) {
            console.log('❌ Lecture not found!');
            return;
        }

        console.log('📚 Processing lecture:', lecture.title);

        // Initialize analysis
        lecture.analysis = {
            status: 'processing',
            analyzedAt: new Date()
        };
        await lecture.save();

        // Step 1: Get YouTube transcript (manual reference)
        const youtubeTranscript = lecture.youtubeVideo?.transcript;
        console.log('📹 YouTube transcript length:', youtubeTranscript?.length || 0);

        // Step 2: Process audio and get AssemblyAI transcript
        let recordedTranscript = '';
        let humanVoiceProbability = 0;
        
        if (filename) {
            console.log('\n🎙️  Processing audio recording...');
            
            try {
                const audioResult = await audioProcessor.processAudioFile(filename);
                recordedTranscript = audioResult.text;
                humanVoiceProbability = audioResult.confidence;
                
                // Store AssemblyAI transcript in database
                lecture.recording.transcript = recordedTranscript;
                lecture.recording.wordCount = audioResult.wordCount;
                lecture.recording.transcriptGeneratedAt = new Date();
                lecture.analysis.humanVoiceProbability = humanVoiceProbability;
                
                console.log('✅ AssemblyAI transcript stored in database');
                console.log('✅ Transcript length:', recordedTranscript.length, 'characters');
                console.log('✅ Word count:', audioResult.wordCount);
                console.log('✅ Human voice probability:', humanVoiceProbability);

            } catch (error) {
                console.log('❌ Audio processing failed:', error.message);
                recordedTranscript = `Audio processing failed: ${error.message}`;
                lecture.recording.transcript = recordedTranscript;
            }
        }

        // Step 3: AI Analysis (only if we have both transcripts)
        console.log('\n🤖 Starting AI analysis...');
        
        if (youtubeTranscript && recordedTranscript && recordedTranscript.length > 50) {
            try {
                const grokResult = await grokAIService.analyzeTranscripts(
                    youtubeTranscript,
                    recordedTranscript,
                    {
                        title: lecture.title,
                        subject: lecture.subject,
                        class: lecture.class
                    }
                );

                lecture.analysis.transcriptMatchPercentage = grokResult.matchPercentage;
                lecture.analysis.grokAnalysis = grokResult;
                lecture.analysis.analyzedAt = new Date();
                
                console.log('✅ AI analysis completed');
                console.log('✅ Match percentage:', grokResult.matchPercentage + '%');

            } catch (error) {
                console.log('❌ AI analysis failed:', error.message);
                // Fallback to simple text comparison
                lecture.analysis.transcriptMatchPercentage = calculateSimpleMatch(
                    youtubeTranscript, 
                    recordedTranscript
                );
            }
        } else {
            console.log('❌ Insufficient data for AI analysis');
            lecture.analysis.transcriptMatchPercentage = 0;
        }

        // Finalize and save everything
        lecture.analysis.status = 'completed';
        lecture.status = 'analyzed';
        
        await lecture.save();
        console.log('✅ All data saved to database successfully');

        // Verify what was stored
        const savedLecture = await Lecture.findById(lectureId);
        console.log('📊 DATABASE VERIFICATION:');
        console.log('📊 YouTube transcript stored:', !!savedLecture.youtubeVideo?.transcript);
        console.log('📊 AssemblyAI transcript stored:', !!savedLecture.recording?.transcript);
        console.log('📊 Analysis results stored:', !!savedLecture.analysis?.transcriptMatchPercentage);

        console.log('🎉 ===== ANALYSIS PROCESS COMPLETED =====');

        // Cleanup audio file
        if (filename) {
            await audioProcessor.cleanupAudioFile(filename);
        }

    } catch (error) {
        console.error('💥 Analysis process failed:', error);
        
        try {
            const lecture = await Lecture.findById(lectureId);
            if (lecture) {
                lecture.analysis.status = 'failed';
                lecture.analysis.error = error.message;
                await lecture.save();
            }
        } catch (saveError) {
            console.error('💥 Failed to save error status:', saveError.message);
        }
    }
}

// Simple text matching fallback
function calculateSimpleMatch(original, recorded) {
    if (!original || !recorded) return 0;
    
    const originalWords = new Set(original.toLowerCase().split(/\s+/));
    const recordedWords = recorded.toLowerCase().split(/\s+/);
    
    let matchCount = 0;
    recordedWords.forEach(word => {
        if (originalWords.has(word)) matchCount++;
    });
    
    return Math.round((matchCount / recordedWords.length) * 100);
}

module.exports = router;