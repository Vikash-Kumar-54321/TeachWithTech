require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    mongodbUri: process.env.MONGODB_URI,
    sessionSecret: process.env.SESSION_SECRET,
    assemblyAIKey: process.env.ASSEMBLYAI_API_KEY,
    grokAIKey: process.env.GROK_API_KEY,
    isProduction: process.env.NODE_ENV === 'production'
};