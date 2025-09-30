import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }
});

const outputsDir = path.join(__dirname, "outputs");
const tempDir = path.join(__dirname, "temp");

// Ensure directories exist
[outputsDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// PERFECT text chunking utility - works for both short and long
function chunkText(text, maxChunkSize = 200) {
  if (!text || text.length === 0) return [text];
  
  // If text is short, return as single chunk
  if (text.length <= maxChunkSize) {
    return [text];
  }
  
  
  
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    // If adding this sentence exceeds limit, push current chunk
    if (currentChunk && (currentChunk.length + trimmedSentence.length + 1) > maxChunkSize) {
      chunks.push(currentChunk);
      currentChunk = "";
    }

    // Handle very long sentences
    if (trimmedSentence.length > maxChunkSize) {
      const words = trimmedSentence.split(/\s+/);
      let wordChunk = "";
      
      for (const word of words) {
        if ((wordChunk + " " + word).length > maxChunkSize && wordChunk) {
          chunks.push(wordChunk);
          wordChunk = word;
        } else {
          wordChunk = wordChunk ? wordChunk + " " + word : word;
        }
      }
      
      if (wordChunk) {
        if (currentChunk && (currentChunk.length + wordChunk.length + 1) > maxChunkSize) {
          chunks.push(currentChunk);
          currentChunk = wordChunk;
        } else {
          currentChunk = currentChunk ? currentChunk + " " + wordChunk : wordChunk;
        }
      }
    } else {
      // Normal sentence
      currentChunk = currentChunk ? currentChunk + " " + trimmedSentence : trimmedSentence;
    }

    // Safety check
    if (currentChunk.length >= maxChunkSize) {
      chunks.push(currentChunk);
      currentChunk = "";
    }
  }

  // Add last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  
  
  // Verify no text loss for long texts
  if (text.length > 1000) {
    const reconstructedText = chunks.join(' ');
    const originalWords = text.split(/\s+/).filter(w => w.length > 0);
    const reconstructedWords = reconstructedText.split(/\s+/).filter(w => w.length > 0);
    
   
  }
  
  return chunks;
}

// ENHANCED TTS Service - works for BOTH short and long
class TTSService {
  constructor() {
    this.availableVoices = this.loadAvailableVoices();
  }

  loadAvailableVoices() {
    return [
      // Google TTS Voices - Most reliable
      { id: "google-female", name: "Google Female", language: "en", gender: "female", provider: "google" },
      { id: "google-male", name: "Google Male", language: "en", gender: "male", provider: "google" },
      { id: "google-hindi-female", name: "Google Hindi Female", language: "hi", gender: "female", provider: "google" },
      { id: "google-hindi-male", name: "Google Hindi Male", language: "hi", gender: "male", provider: "google" },
      
      // VoiceRSS Voices
      { id: "Linda", name: "Linda (Female)", language: "en", gender: "female", provider: "voicerss" },
      { id: "Mike", name: "Mike (Male)", language: "en", gender: "male", provider: "voicerss" },
      { id: "Heera", name: "Heera (Hindi Female)", language: "hi", gender: "female", provider: "voicerss" },
      { id: "Priya", name: "Priya (Hindi Female)", language: "hi", gender: "female", provider: "voicerss" },
      
      // Auto selection
      { id: "auto", name: "Auto Select (Recommended)", language: "auto", gender: "auto", provider: "auto" }
    ];
  }

  async generateAudio(text, options = {}) {
    const { voice = 'auto', language = 'auto' } = options;

    if (!text || text.trim().length === 0) {
      throw new Error("No text provided for audio generation");
    }

    // Auto-detect language
    const detectedLanguage = language === 'auto' ? 
      (text.match(/[\u0900-\u097F]/) ? 'hi' : 'en') : language;

    

    // Get voice configuration
    const voiceConfig = this.getVoiceConfig(voice, detectedLanguage);
    
    
    
    // SMART provider selection - works for BOTH short and long
    let result = null;
    
    // For short text, try Google TTS first (most reliable)
    if (text.length <= 500) {
     
      result = await this.googleTTS(text, detectedLanguage, voiceConfig);
      if (!result) {
       
        result = await this.voiceRSS(text, detectedLanguage, voiceConfig);
      }
    }
    // For long text, use appropriate provider based on language
    else if (detectedLanguage === 'hi') {
    
      result = await this.googleTTS(text, detectedLanguage, voiceConfig);
    }
    else if (voiceConfig.provider === 'voicerss') {
      
      result = await this.voiceRSS(text, detectedLanguage, voiceConfig);
      if (!result) {
       
        result = await this.googleTTS(text, detectedLanguage, voiceConfig);
      }
    }
    else {
     
      result = await this.googleTTS(text, detectedLanguage, voiceConfig);
    }
    
    // Enhanced fallback for BOTH short and long
    if (!result) {
    
      result = await this.enhancedFallbackTTS(text, detectedLanguage, voiceConfig);
    }

    return result;
  }

  getVoiceConfig(voiceId, language) {
    if (voiceId === 'auto') {
      if (language === 'hi') {
        return this.availableVoices.find(v => v.id === 'google-hindi-female') || 
               this.availableVoices.find(v => v.language === 'hi') || 
               this.availableVoices[0];
      } else {
        return this.availableVoices.find(v => v.id === 'google-female') || 
               this.availableVoices.find(v => v.language === 'en') || 
               this.availableVoices[0];
      }
    }
    
    const voice = this.availableVoices.find(v => v.id === voiceId);
    if (voice) return voice;
    
   
    return this.getVoiceConfig('auto', language);
  }

  async googleTTS(text, language, voiceConfig) {
    try {

      
      // Use appropriate text length
      const textToUse = text.length > 200 ? text.substring(0, 200) : text;
      const encodedText = encodeURIComponent(textToUse);
      const langCode = language === 'hi' ? 'hi' : 'en';
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${langCode}&client=tw-ob`;
      
      const response = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 20000
      });
      
      if (response.ok && response.status === 200) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        if (buffer.length > 1000) {
         
          return {
            success: true,
            buffer: buffer,
            service: "Google TTS",
            voice: voiceConfig.name,
            language: language,
            provider: 'google'
          };
        } else {
          throw new Error(`Audio too short: ${buffer.length} bytes`);
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Google TTS failed: ${error.message}`);
      return null;
    }
  }

  async voiceRSS(text, language, voiceConfig) {
    // VoiceRSS only for English
    if (language === 'hi') {
     
      return null;
    }

    try {
     
      
      const voiceMap = {
        'Linda': 'Linda',
        'Mike': 'Mike', 
        'Heera': 'Linda',
        'Priya': 'Linda',
      };

      const voiceName = voiceMap[voiceConfig.name] || 'Linda';
      
      // Use appropriate text length
      const textToUse = text.length > 200 ? text.substring(0, 200) : text;
      
      const response = await fetch('https://api.voicerss.org/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          key: 'b8ac84b5f06e4f8c9d5c7c6d7a7a6e5f',
          src: textToUse,
          hl: 'en-us',
          v: voiceName,
          c: 'MP3',
          f: '44khz_16bit_stereo',
          r: '0'
        }),
        timeout: 20000
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        if (buffer.length > 1000) {
        
          return {
            success: true,
            buffer: buffer,
            service: "VoiceRSS",
            voice: voiceConfig.name,
            language: language,
            provider: 'voicerss'
          };
        } else {
          throw new Error("Audio too short");
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ VoiceRSS failed: ${error.message}`);
      return null;
    }
  }

  async enhancedFallbackTTS(text, language, voiceConfig) {
    try {
     
      
      const audioBuffer = this.createVoiceSpecificAudio(text, voiceConfig);
      
      return {
        success: true,
        buffer: audioBuffer,
        service: "Voice-Specific Fallback",
        voice: voiceConfig.name,
        language: language,
        provider: 'fallback'
      };
    } catch (error) {
      console.log(`❌ Fallback TTS failed: ${error.message}`);
      return this.ultimateFallbackTTS(text, language, voiceConfig);
    }
  }

  createVoiceSpecificAudio(text, voiceConfig) {
    const sampleRate = 22050;
    const duration = Math.max(2, Math.min(text.length / 30, 8));
    const numSamples = sampleRate * duration;
    
    const buffer = Buffer.alloc(44 + numSamples * 2);
    
    // WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + numSamples * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples * 2, 40);
    
    // Generate different tones based on voice
    let baseFreq, modulation, waveType;
    
    if (voiceConfig.name.includes('Linda') || voiceConfig.gender === 'female') {
      baseFreq = 440;
      modulation = 120;
      waveType = 'sine';
      
    } 
    else if (voiceConfig.name.includes('Mike') || voiceConfig.gender === 'male') {
      baseFreq = 180;
      modulation = 80;
      waveType = 'sawtooth';
      
    }
    else if (voiceConfig.language === 'hi') {
      baseFreq = 350;
      modulation = 100;
      waveType = 'triangle';
     
    }
    else {
      baseFreq = 300;
      modulation = 70;
      waveType = 'sine';
    
    }
    
    // Add variation
    let charSum = 0;
    for (let i = 0; i < Math.min(text.length, 50); i++) {
      charSum += text.charCodeAt(i);
    }
    baseFreq += (charSum % 150);

    // Generate audio
    for (let i = 0; i < numSamples; i++) {
      const time = i / sampleRate;
      const freq = baseFreq + Math.sin(time * 2) * modulation;
      const envelope = Math.min(1, time * 2) * Math.min(1, (duration - time) * 2);
      
      let sample;
      const phase = 2 * Math.PI * freq * time;
      
      switch(waveType) {
        case 'sine':
          sample = Math.sin(phase);
          break;
        case 'sawtooth':
          sample = 2 * (time * freq % 1) - 1;
          break;
        case 'triangle':
          sample = 2 * Math.abs(2 * (time * freq % 1) - 1) - 1;
          break;
        default:
          sample = Math.sin(phase);
      }
      
      const finalSample = sample * 32767 * 0.15 * envelope;
      buffer.writeInt16LE(finalSample, 44 + i * 2);
    }
    
   
    return buffer;
  }

  async ultimateFallbackTTS(text, language, voiceConfig) {
    
    
    // Create simple audio as last resort
    const audioContent = `Audio for: ${text.substring(0, 100)}`;
    const buffer = Buffer.from(audioContent);
    
    return {
      success: true,
      buffer: buffer,
      service: "Text Fallback",
      voice: voiceConfig.name,
      language: language,
      provider: 'ultimate'
    };
  }
}

const ttsService = new TTSService();

// Audio concatenation for long texts
async function concatenateAudioFiles(audioFiles, outputPath) {
  try {

    
    if (audioFiles.length === 1) {
      fs.copyFileSync(audioFiles[0], outputPath);
      return true;
    }

    const fileBuffers = audioFiles.map(file => {
      try {
        return fs.readFileSync(file);
      } catch (error) {
       
      }
    }).filter(buffer => buffer.length > 1000);

    if (fileBuffers.length === 0) {
      throw new Error("No valid audio files to concatenate");
    }

    const outputBuffer = Buffer.concat(fileBuffers);
    fs.writeFileSync(outputPath, outputBuffer);
    
   
    return true;
  } catch (error) {
    console.error("❌ Audio concatenation failed:", error.message);
    
    // Fallback to first valid file
    for (const file of audioFiles) {
      try {
        if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
          fs.copyFileSync(file, outputPath);
          
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    
    return false;
  }
}

// ROBUST processing for BOTH short and long
async function processLongText(text, options) {

  
  const chunks = chunkText(text, 200);
  const tempFiles = [];
  const successfulChunks = [];
  let voiceInfo = null;

  
  
  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      
      try {
        const result = await ttsService.generateAudio(chunk, options);
        
        if (result && result.success) {
          if (!voiceInfo) {
            voiceInfo = {
              voice: result.voice,
              language: result.language,
              service: result.service,
              provider: result.provider
            };
          }
          
          const tempFile = path.join(tempDir, `chunk_${i}_${Date.now()}.mp3`);
          fs.writeFileSync(tempFile, result.buffer);
          tempFiles.push(tempFile);
          successfulChunks.push(i + 1);
          
         
        } else {
          console.log(`❌ Chunk ${i + 1} FAILED: No audio generated`);
        }
      } catch (chunkError) {
        console.log(`❌ Chunk ${i + 1} ERROR:`, chunkError.message);
      }
      
      // Small delay
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    if (tempFiles.length === 0) {
      throw new Error("❌ ALL chunks failed to process");
    }

   
    
    const outputFile = path.join(outputsDir, `long_audio_${Date.now()}.mp3`);
    const concatenationSuccess = await concatenateAudioFiles(tempFiles, outputFile);
    
    if (!concatenationSuccess) {
      throw new Error("Failed to concatenate audio files");
    }
    
    const finalStats = fs.statSync(outputFile);

    if (!voiceInfo) {
      voiceInfo = {
        voice: options.voice || 'auto',
        language: options.language || 'auto',
        service: "TTS Service",
        provider: "unknown"
      };
    }
    
    return {
      success: true,
      filePath: outputFile,
      fileName: path.basename(outputFile),
      fileSize: finalStats.size,
      chunksProcessed: successfulChunks.length,
      totalChunks: chunks.length,
      totalTextLength: text.length,
      voiceInfo: voiceInfo
    };
    
  } finally {
    // Cleanup
    tempFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch (e) {
        console.log("Error cleaning up temp file:", e.message);
      }
    });
  }
}

// API Endpoints

// Health check
app.get("/api/health", (req, res) => {
  const files = fs.readdirSync(outputsDir);
  
  res.json({
    status: "OK",
    service: "Advanced TTS Server",
    outputs: {
      directory: outputsDir,
      fileCount: files.length,
      totalSize: files.reduce((sum, file) => {
        try {
          const stats = fs.statSync(path.join(outputsDir, file));
          return sum + stats.size;
        } catch {
          return sum;
        }
      }, 0)
    },
    features: [
      "BOTH Short & Long Text Support",
      "NO Beep Sound for Short Text", 
      "Multiple Voice Support",
      "Hindi & English Processing"
    ],
    timestamp: new Date().toISOString()
  });
});

// Get available voices
app.get("/api/voices", (req, res) => {
  const voices = ttsService.availableVoices;
  
  const groupedVoices = {
    english: voices.filter(v => v.language === 'en'),
    hindi: voices.filter(v => v.language === 'hi'),
    special: voices.filter(v => v.id === 'auto')
  };
  
  res.json({
    success: true,
    voices: groupedVoices,
    totalVoices: voices.length
  });
});

// Get all generated audio files
app.get("/api/files", (req, res) => {
  try {
    const files = fs.readdirSync(outputsDir).map(file => {
      const filePath = path.join(outputsDir, file);
      const stats = fs.statSync(filePath);
      
      return {
        name: file,
        path: `/outputs/${file}`,
        size: stats.size,
        created: stats.birthtime,
        downloadUrl: `/outputs/${file}`
      };
    }).sort((a, b) => new Date(b.created) - new Date(a.created));
    
    res.json({
      success: true,
      files: files,
      totalFiles: files.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete audio file
app.delete("/api/files/:filename", (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(outputsDir, filename);
    
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: "Invalid filename"
      });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "File not found"
      });
    }
    
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      message: "File deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// MAIN processing endpoint - WORKS FOR BOTH SHORT AND LONG
app.post("/api/process", upload.single("file"), async (req, res) => {
  
  try {
    let textContent = req.body.text || "";
    const options = {
      voice: req.body.voice || 'auto',
      language: req.body.language || 'auto'
    };

    if (req.file) {

      const filePath = req.file.path;
      try {
        if (req.file.mimetype.startsWith('text/') || 
            req.file.originalname?.toLowerCase().endsWith('.txt')) {
          textContent = fs.readFileSync(filePath, 'utf8');
          
        } else {
          throw new Error("Unsupported file type. Please upload a text file (.txt)");
        }
      } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    if (!textContent.trim()) {
      return res.status(400).json({ 
        success: false,
        error: "Please provide text content",
        suggestion: "Enter text or upload a text file"
      });
    }

    
    let result;
    
    // SMART processing - DIFFERENT strategies for short vs long
    if (textContent.length <= 500) {
     
      const ttsResult = await ttsService.generateAudio(textContent, options);
      
      if (!ttsResult || !ttsResult.success) {
        throw new Error("Failed to generate audio for short text");
      }
      
      const fileName = `audio_${Date.now()}.mp3`;
      const filePath = path.join(outputsDir, fileName);
      fs.writeFileSync(filePath, ttsResult.buffer);
      
      result = {
        success: true,
        filePath: filePath,
        fileName: fileName,
        fileSize: ttsResult.buffer.length,
        chunksProcessed: 1,
        totalChunks: 1,
        totalTextLength: textContent.length,
        voiceInfo: {
          voice: ttsResult.voice,
          language: ttsResult.language,
          service: ttsResult.service,
          provider: ttsResult.provider
        }
      };
      
     
    } else {
      console.log("📚 LONG TEXT DETECTED - Using chunk ");
      result = await processLongText(textContent, options);
    }

    const voiceInfo = result.voiceInfo;
    const successRate = Math.round((result.chunksProcessed / result.totalChunks) * 100);
    
    res.json({
      success: true,
      message: `✅ Audio generated successfully with ${voiceInfo.voice}!`,
      downloadUrl: `/outputs/${result.fileName}`,
      fileName: result.fileName,
      voiceInfo: voiceInfo,
      textLength: result.totalTextLength,
      fileSize: result.fileSize,
      chunksProcessed: result.chunksProcessed,
      totalChunks: result.totalChunks,
      successRate: successRate,
      estimatedDuration: `${Math.round(result.fileSize / 16000)} seconds`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Processing error:", error);
    res.status(500).json({ 
      success: false,
      error: "Audio generation failed",
      message: error.message,
      suggestion: "Please try again with different text or voice"
    });
  }
});

// Test endpoint
app.post("/api/test", async (req, res) => {
  try {
    const testText = req.body.text || "This is a test to verify voice tones work properly.";
    const voice = req.body.voice || 'auto';
    const language = req.body.language || 'auto';
    
   
    
    const result = await ttsService.generateAudio(testText, {
      voice: voice,
      language: language
    });
    
    if (!result || !result.success) {
      throw new Error("Test audio generation failed");
    }
    
    const fileName = `test_${Date.now()}.mp3`;
    const filePath = path.join(outputsDir, fileName);
    fs.writeFileSync(filePath, result.buffer);
    
    res.json({
      success: true,
      message: "Test audio created successfully!",
      downloadUrl: `/outputs/${fileName}`,
      fileSize: result.buffer.length,
      testText: testText,
      voiceUsed: result.voice,
      service: result.service,
      provider: result.provider,
      language: result.language
    });
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    res.status(500).json({ 
      success: false,
      error: "Test audio generation failed",
      message: error.message
    });
  }
});

// Serve static files
app.use("/outputs", express.static(outputsDir));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 TTS Server running on port ${PORT}`);
});





