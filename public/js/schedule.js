class ScheduleManager {
    constructor() {
        this.currentLecture = null;
        this.checkInterval = null;
        this.isChecking = false;
    }

    init() {
        this.startScheduleChecking();
        this.setupRealTimeUpdates();
    }

    startScheduleChecking() {
        // Check immediately
        this.checkCurrentSchedule();

        // Then check every 30 seconds
        this.checkInterval = setInterval(() => {
            this.checkCurrentSchedule();
        }, 30000);

        console.log('Schedule monitoring started');
    }

    async checkCurrentSchedule() {
        if (this.isChecking) return;
        
        this.isChecking = true;
        try {
            const response = await fetch('/api/current-lecture');
            if (!response.ok) throw new Error('Network error');
            
            const data = await response.json();
            
            if (data.lecture && this.shouldActivateLecture(data.lecture)) {
                this.handleLectureStart(data.lecture);
            } else {
                this.handleNoCurrentLecture();
            }
        } catch (error) {
            console.error('Schedule check error:', error);
        } finally {
            this.isChecking = false;
        }
    }

    shouldActivateLecture(lecture) {
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);
        
        return lecture.status === 'recording' || 
               (currentTime >= lecture.schedule.startTime && 
                currentTime <= lecture.schedule.endTime);
    }

    handleLectureStart(lecture) {
        if (this.currentLecture && this.currentLecture._id === lecture._id) {
            return; // Already handling this lecture
        }

        this.currentLecture = lecture;
        this.updateUIForRecording(lecture);
        this.showBrowserNotification(lecture);
        
        console.log('Lecture activated:', lecture.title);
    }

    handleNoCurrentLecture() {
        if (this.currentLecture) {
            this.updateUIForNoRecording();
            this.currentLecture = null;
        }
    }

    updateUIForRecording(lecture) {
        this.updateRecordingIndicator(lecture);
        this.updateNavigationMenu(lecture);
        this.enableRecordingButton(lecture);
    }

    updateUIForNoRecording() {
        this.hideRecordingIndicator();
        this.disableRecordingButton();
    }

    updateRecordingIndicator(lecture) {
        let indicator = document.getElementById('recordingIndicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'recordingIndicator';
            indicator.className = 'recording-indicator';
            document.body.insertBefore(indicator, document.body.firstChild);
        }

        indicator.innerHTML = `
            <div class="alert alert-info recording-alert">
                <strong>🔴 Live:</strong> ${lecture.title} - 
                ${lecture.subject} (${lecture.class}) - 
                Recording enabled until ${lecture.schedule.endTime}
            </div>
        `;

        indicator.style.display = 'block';
    }

    hideRecordingIndicator() {
        const indicator = document.getElementById('recordingIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    updateNavigationMenu(lecture) {
        const navElement = document.getElementById('currentLectureNav');
        if (navElement) {
            navElement.innerHTML = `
                <span class="nav-lecture-info">
                    📹 ${lecture.subject} - Until ${lecture.schedule.endTime}
                </span>
            `;
        }
    }

    enableRecordingButton(lecture) {
        const startButton = document.getElementById('startRecording');
        if (startButton) {
            startButton.disabled = false;
            startButton.innerHTML = `
                <i class="record-icon"></i>
                Start Recording - ${lecture.title}
            `;
            
            // Update href if it's a link
            if (startButton.tagName === 'A') {
                startButton.href = `/teacher/recording/${lecture._id}`;
            }
        }
    }

    disableRecordingButton() {
        const startButton = document.getElementById('startRecording');
        if (startButton) {
            startButton.disabled = true;
            startButton.innerHTML = 'Waiting for Scheduled Lecture';
        }
    }

    showBrowserNotification(lecture) {
        if (!("Notification" in window)) return;

        if (Notification.permission === "granted") {
            this.createNotification(lecture);
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    this.createNotification(lecture);
                }
            });
        }
    }

    createNotification(lecture) {
        // Only notify if page is not visible
        if (document.hidden) {
            const notification = new Notification("Lecture Recording Time", {
                body: `Time to record: ${lecture.title}\nSubject: ${lecture.subject}\nClass: ${lecture.class}`,
                icon: "/favicon.ico",
                tag: "lecture-recording"
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            setTimeout(() => notification.close(), 10000);
        }
    }

    setupRealTimeUpdates() {
        // Listen for visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkCurrentSchedule(); // Refresh when tab becomes visible
            }
        });

        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.checkCurrentSchedule();
        });

        // Set up page refresh for recording page
        if (window.location.pathname.includes('/recording/')) {
            this.setupRecordingPageUpdates();
        }
    }

    setupRecordingPageUpdates() {
        // Refresh page every minute to check schedule status
        setInterval(() => {
            this.checkCurrentSchedule();
        }, 60000);
    }

    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }
}

// Additional CSS for schedule indicators
const scheduleStyles = `
.recording-indicator {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    animation: slideDown 0.3s ease;
}

.recording-alert {
    margin: 0;
    border-radius: 0;
    text-align: center;
    border: none;
    border-bottom: 2px solid #007bff;
}

.nav-lecture-info {
    background: #ffc107;
    color: #856404;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 0.9rem;
    margin-left: 10px;
}

@keyframes slideDown {
    from { transform: translateY(-100%); }
    to { transform: translateY(0); }
}

.record-icon {
    display: inline-block;
    width: 12px;
    height: 12px;
    background: #dc3545;
    border-radius: 50%;
    margin-right: 8px;
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = scheduleStyles;
document.head.appendChild(styleSheet);

// Initialize schedule manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.scheduleManager = new ScheduleManager();
    window.scheduleManager.init();
});

// Cleanup when page unloads
window.addEventListener('beforeunload', function() {
    if (window.scheduleManager) {
        window.scheduleManager.destroy();
    }
});