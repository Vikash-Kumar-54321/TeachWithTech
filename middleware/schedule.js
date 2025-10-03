const Lecture = require('../models/Lecture');
const cron = require('node-cron');

class ScheduleManager {
    constructor() {
        this.scheduledJobs = new Map();
    }

    startScheduleMonitoring() {
        // Check every minute for upcoming lectures
        cron.schedule('* * * * *', async () => {
            try {
                const now = new Date();
                const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);
                
                // Find lectures that should be active now
                const activeLectures = await Lecture.find({
                    date: {
                        $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                        $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
                    },
                    'schedule.startTime': { $lte: currentTime },
                    'schedule.endTime': { $gte: currentTime },
                    status: 'scheduled'
                });

                for (const lecture of activeLectures) {
                    await this.activateLecture(lecture);
                }

                // Deactivate past lectures
                const pastLectures = await Lecture.find({
                    date: {
                        $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                        $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
                    },
                    'schedule.endTime': { $lt: currentTime },
                    status: 'scheduled'
                });

                for (const lecture of pastLectures) {
                    await Lecture.findByIdAndUpdate(lecture._id, { status: 'cancelled' });
                }

            } catch (error) {
                console.error('Schedule monitoring error:', error);
            }
        });

        console.log('Schedule monitoring started');
    }

    async activateLecture(lecture) {
        try {
            await Lecture.findByIdAndUpdate(lecture._id, { status: 'recording' });
            console.log(`Lecture activated: ${lecture.title} at ${lecture.schedule.startTime}`);
        } catch (error) {
            console.error('Error activating lecture:', error);
        }
    }
}

module.exports = new ScheduleManager();