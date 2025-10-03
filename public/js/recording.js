class LectureRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.startTime = null;
        this.timerInterval = null;
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.animationId = null;
        
        this.lectureId = document.getElementById('lectureId').value;
        this.startBtn = document.getElementById('startRecording');
        this.stopBtn = document.getElementById('stopRecording');
        this.timer = document.getElementById('timer');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.recordingStatus = document.getElementById('recordingStatus');
        this.recordingProgress = document.getElementById('recordingProgress');
        this.visualizer = document.getElementById('visualizer');
        this.audioWave = document.getElementById('audioWave');
        this.transcriptContainer = document.getElementById('transcriptContainer');
        this.liveTranscript = document.getElementById('liveTranscript');
        
        this.maxDuration = 60 * 60 * 1000; // 1 hour in milliseconds
        
        this.initializeEventListeners();
        this.createAudioBars();
    }
    
    initializeEventListeners() {
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'r' && !this.isRecording) {
                e.preventDefault();
                this.startRecording();
            } else if (e.ctrlKey && e.key === 's' && this.isRecording) {
                e.preventDefault();
                this.stopRecording();
            }
        });
    }
    
    createAudioBars() {
        // Create audio visualization bars
        for (let i = 0; i < 50; i++) {
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = '2px';
            this.audioWave.appendChild(bar);
        }
    }
    
    async startRecording() {
        try {
            console.log('Starting recording...');
            
            // Update UI
            this.updateStatus('Starting recording...', 'info');
            this.startBtn.disabled = true;
            
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                } 
            });
            
            // Initialize audio visualization
            this.initializeAudioVisualization(stream);
            
            // Create MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.saveRecording();
            };
            
            // Start recording
            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;
            this.startTime = new Date();
            
            // Start timer
            this.startTimer();
            
            // Update UI
            this.updateStatus('Recording in progress...', 'warning');
            this.recordingStatus.textContent = '🔴 Recording...';
            this.recordingStatus.className = 'status-recording';
            this.stopBtn.disabled = false;
            this.visualizer.style.display = 'block';
            this.transcriptContainer.style.display = 'block';
            
            // Notify server
            await this.notifyServer('start');
            
            console.log('Recording started successfully');
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.updateStatus('Error starting recording: ' + error.message, 'danger');
            this.startBtn.disabled = false;
        }
    }
    
    initializeAudioVisualization(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(stream);
        
        source.connect(this.analyser);
        this.analyser.fftSize = 256;
        
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
        
        this.animateVisualizer();
    }
    
    animateVisualizer() {
        if (!this.isRecording) return;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        const bars = this.audioWave.getElementsByClassName('bar');
        
        for (let i = 0; i < bars.length; i++) {
            const bar = bars[i];
            const value = this.dataArray[i % this.dataArray.length];
            const height = Math.max(2, (value / 255) * 100);
            bar.style.height = height + 'px';
            bar.style.background = `hsl(${value}, 70%, 50%)`;
        }
        
        this.animationId = requestAnimationFrame(() => this.animateVisualizer());
    }
    
    startTimer() {
        this.timerInterval = setInterval(() => {
            const now = new Date();
            const elapsed = now - this.startTime;
            
            // Update timer display
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            this.timer.textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Update progress bar
            const progress = (elapsed / this.maxDuration) * 100;
            this.recordingProgress.style.width = Math.min(progress, 100) + '%';
            
            // Auto-stop after max duration
            if (elapsed >= this.maxDuration) {
                this.stopRecording();
            }
            
        }, 1000);
    }
    
    async stopRecording() {
        if (!this.isRecording) return;
        
        console.log('Stopping recording...');
        this.updateStatus('Stopping recording...', 'info');
        
        // Stop recording
        this.mediaRecorder.stop();
        this.isRecording = false;
        
        // Stop timer and visualizer
        clearInterval(this.timerInterval);
        cancelAnimationFrame(this.animationId);
        
        // Stop all tracks
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        
        // Update UI
        this.updateStatus('Processing recording...', 'info');
        this.recordingStatus.textContent = '🟡 Processing...';
        this.recordingStatus.className = 'status-processing';
        this.stopBtn.disabled = true;
        this.visualizer.style.display = 'none';
        
        console.log('Recording stopped');
    }
    
    async saveRecording() {
        try {
            console.log('Saving recording...');
            
            // Create audio blob
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            const duration = new Date() - this.startTime;
            
            // Create FormData for upload
            const formData = new FormData();
            const filename = `lecture_${this.lectureId}_${Date.now()}.webm`;
            formData.append('audio', audioBlob, filename);
            
            // Upload audio file
            console.log('Uploading audio file...');
            const uploadResponse = await fetch('/upload/audio', {
                method: 'POST',
                body: formData
            });
            
            const uploadResult = await uploadResponse.json();
            
            if (!uploadResult.success) {
                throw new Error(uploadResult.error);
            }
            
            console.log('Audio uploaded:', uploadResult);
            
            // Notify server recording stopped
            await this.notifyServer('stop', {
                audioUrl: uploadResult.audioUrl,
                filename: uploadResult.filename,
                duration: Math.round(duration / 1000) // Convert to seconds
            });
            
            // Update UI
            this.updateStatus('Recording saved! Analysis started.', 'success');
            this.recordingStatus.textContent = '✅ Analysis Started';
            this.startBtn.disabled = false;
            
            // Redirect to dashboard after 3 seconds
            setTimeout(() => {
                window.location.href = '/teacher/dashboard?message=Recording+completed+successfully';
            }, 3000);
            
        } catch (error) {
            console.error('Error saving recording:', error);
            this.updateStatus('Error saving recording: ' + error.message, 'danger');
            this.startBtn.disabled = false;
        }
    }
    
    async notifyServer(action, data = {}) {
        try {
            const response = await fetch(`/recording/${action}/${this.lectureId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error);
            }
            
            console.log(`Server ${action} notification successful:`, result.message);
            
        } catch (error) {
            console.error(`Error notifying server for ${action}:`, error);
            throw error;
        }
    }
    
    updateStatus(message, type) {
        this.statusIndicator.textContent = message;
        this.statusIndicator.className = `alert alert-${type}`;
    }
}

// Initialize recorder when page loads
document.addEventListener('DOMContentLoaded', () => {
    new LectureRecorder();
});