const mongoose = require('mongoose');

const lectureSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    class: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    schedule: {
        startTime: String,
        endTime: String
    },
    youtubeVideo: {
        url: String,
        transcript: String,  // Manual reference transcript
        transcriptGenerated: { type: Boolean, default: false },
        transcriptGeneratedAt: Date,
        transcriptSource: {  // Track where transcript came from
            type: String,
            enum: ['manual', 'youtube', 'none'],
            default: 'none'
        }
    },
    recording: {
        audioUrl: String,
        transcript: String,  // AssemblyAI generated transcript
        startTime: Date,
        endTime: Date,
        duration: Number,
        wordCount: Number,
        transcriptGeneratedAt: Date
    },
    analysis: {
        humanVoiceProbability: Number,
        transcriptMatchPercentage: Number,  // Compare manual vs AssemblyAI
        grokAnalysis: Object,
        analyzedAt: Date,
        status: { 
            type: String, 
            enum: ['pending', 'processing', 'completed', 'failed'], 
            default: 'pending' 
        }
    },
    status: {
        type: String,
        enum: ['scheduled', 'recording', 'completed', 'analyzed', 'cancelled'],
        default: 'scheduled'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Lecture', lectureSchema);