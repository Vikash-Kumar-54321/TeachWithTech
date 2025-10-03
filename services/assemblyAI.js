const axios = require('axios');

class AssemblyAIService {
    constructor() {
        this.apiKey = process.env.ASSEMBLYAI_API_KEY;
        this.baseURL = 'https://api.assemblyai.com/v2';
    }

    async transcribeAudio(audioUrl) {
        try {
            console.log('🎙️  [ASSEMBLYAI] Starting transcription process...');
            console.log('🎙️  [ASSEMBLYAI] Audio URL:', audioUrl);
            
            // Submit transcription request
            const response = await axios.post(
                `${this.baseURL}/transcript`,
                {
                    audio_url: audioUrl,
                    language_code: 'en',
                    speech_model: 'best',
                    punctuate: true,
                    format_text: true,
                    disfluencies: false
                },
                {
                    headers: {
                        'Authorization': this.apiKey,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const transcriptId = response.data.id;
            console.log('🎙️  [ASSEMBLYAI] Transcript created with ID:', transcriptId);
            console.log('🎙️  [ASSEMBLYAI] Polling for completion...');

            const transcript = await this.pollTranscript(transcriptId);
            console.log('✅ [ASSEMBLYAI] Transcription completed successfully!');
            
            return transcript;

        } catch (error) {
            console.error('❌ [ASSEMBLYAI] Transcription failed:', error.response?.data || error.message);
            throw new Error(`AssemblyAI transcription failed: ${error.message}`);
        }
    }

    async pollTranscript(transcriptId, interval = 3000, timeout = 180000) {
        const startTime = Date.now();
        let pollCount = 0;
        
        while (Date.now() - startTime < timeout) {
            pollCount++;
            try {
                const response = await axios.get(
                    `${this.baseURL}/transcript/${transcriptId}`,
                    {
                        headers: {
                            'Authorization': this.apiKey
                        }
                    }
                );

                const status = response.data.status;
                console.log(`🎙️  [ASSEMBLYAI] Poll ${pollCount}: Status = ${status}`);

                if (status === 'completed') {
                    console.log('✅ [ASSEMBLYAI] Transcription ready!');
                    return {
                        text: response.data.text,
                        words: response.data.words,
                        confidence: response.data.confidence,
                        audioDuration: response.data.audio_duration
                    };
                } else if (status === 'error') {
                    throw new Error(`Transcription failed: ${response.data.error}`);
                }

                await new Promise(resolve => setTimeout(resolve, interval));
            } catch (error) {
                console.error('❌ [ASSEMBLYAI] Polling error:', error.message);
                throw error;
            }
        }
        
        throw new Error('Transcription timeout');
    }
}

module.exports = new AssemblyAIService();