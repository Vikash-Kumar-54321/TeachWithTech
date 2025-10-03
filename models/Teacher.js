const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const teacherSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    subjects: [String],
    classes: [String],
    role: {
        type: String,
        enum: ['teacher', 'admin'],
        default: 'teacher'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    imageUrl: {
        type: String,    // URL of teacher's image for face recognition (from Cloudinary)
    },
    cloudinaryId: {
        type: String,    // Cloudinary public_id for image management
    },
    attendance: [
        {
            date: { type: String },       // "YYYY-MM-DD"
            time: { type: String },       // "HH:MM:SS"
            faceMatched: { type: Boolean, default: false },   // true if face verified
            locationMatched: { type: Boolean, default: false }, // true if location verified
            verified: { 
                type: Boolean,
                default: function() {
                    return this.faceMatched && this.locationMatched;
                }
            }
        }
    ]
}, {
    timestamps: true
});

// Hash password before saving
teacherSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password method
teacherSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Teacher', teacherSchema);