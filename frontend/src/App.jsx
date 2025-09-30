import { useState, useRef, useEffect } from "react";
import "./App.css";

export default function App() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("auto");
  const [selectedLanguage, setSelectedLanguage] = useState("auto");
  const [availableVoices, setAvailableVoices] = useState({});
  const [audioFiles, setAudioFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("generate");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // Load available voices and files
  useEffect(() => {
    loadVoices();
    loadAudioFiles();
  }, []);

  const loadVoices = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/voices");
      const data = await response.json();
      if (data.success) {
        setAvailableVoices(data.voices);
      }
    } catch (err) {
      console.error("Failed to load voices:", err);
    }
  };

  const loadAudioFiles = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/files");
      const data = await response.json();
      if (data.success) {
        setAudioFiles(data.files);
      }
    } catch (err) {
      console.error("Failed to load audio files:", err);
    }
  };

  const deleteAudioFile = async (filename) => {
    if (!window.confirm("Are you sure you want to delete this audio file?")) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/files/${filename}`, {
        method: "DELETE"
      });
      
      const data = await response.json();
      if (data.success) {
        loadAudioFiles();
      } else {
        alert("Failed to delete file: " + data.error);
      }
    } catch (err) {
      alert("Error deleting file: " + err.message);
    }
  };

  // Test server connection
  const testServer = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/health");
      const data = await response.json();
      
      alert(`✅ Server Status: ${data.status}\n📊 Files: ${data.outputs.fileCount}\n💾 Total Size: ${(data.outputs.totalSize / 1024 / 1024).toFixed(1)} MB`);
    } catch (err) {
      alert("❌ Server connection failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Test TTS with selected voice
  const testTTS = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: "Hello! This is a test of the text to speech system with multiple voice options.",
          voice: selectedVoice
        })
      });
      
      const data = await response.json();
      if (data.success) {
        const audioUrl = `http://localhost:5000${data.downloadUrl}`;
        const audio = new Audio(audioUrl);
        await audio.play();
        alert(`✅ Test successful! Audio is playing.\n🎵 Voice: ${data.voiceUsed}\n🔧 Service: ${data.service}`);
      } else {
        throw new Error(data.error || "Test failed");
      }
    } catch (error) {
      alert("❌ Test failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate audio
  const generateAudio = async () => {
    if (!text.trim()) {
      setError("Please enter text to convert");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setProgress(0);

    try {
      const response = await fetch("http://localhost:5000/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          voice: selectedVoice,
          language: selectedLanguage
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setResult(data);
        loadAudioFiles();
        
        // Auto-play after short delay
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch(e => {
              console.log("Auto-play blocked:", e.message);
            });
          }
        }, 500);
      } else {
        throw new Error(data.error || "Unknown error occurred");
      }

    } catch (err) {
      console.error("❌ Generation error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle audio play/pause
  const handleAudioPlay = () => {
    setIsPlaying(true);
  };

  const handleAudioPause = () => {
    setIsPlaying(false);
  };

  // Sample texts
  const sampleTexts = {
    hindiShort: "नमस्ते, यह हिंदी टेक्स्ट टू स्पीच कन्वर्टर है। यह बहुत अच्छा काम करता है और लंबे टेक्स्ट को भी ऑडियो में बदल सकता है।",
    englishShort: "Hello! This is an advanced text to speech converter with multiple voice options and support for both short and long texts.",
    hindiLong: `भारत एक विशाल और विविधतापूर्ण देश है जो अपनी समृद्ध सांस्कृतिक विरासत, इतिहास और परंपराओं के लिए जाना जाता है। यह दुनिया का सातवां सबसे बड़ा देश है और जनसंख्या के मामले में दूसरे स्थान पर है। भारत की संस्कृति हज़ारों साल पुरानी है और इसमें कई धर्मों, भाषाओं और परंपराओं का मिश्रण है।`,
    englishLong: `The rapid advancement of technology in the 21st century has fundamentally transformed how we live, work, and communicate. From artificial intelligence and machine learning to quantum computing and biotechnology, technological innovations are reshaping every aspect of human existence. One of the most significant developments has been the rise of the Internet and digital connectivity.`
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-icon">🎵</div>
            <div className="logo-text">
              <h1>VoiceCraft Pro</h1>
              <p>AI-Powered Text to Speech Converter</p>
            </div>
          </div>
          
          <div className="header-actions">
            <button 
              className="btn btn-secondary"
              onClick={testServer}
              disabled={loading}
            >
              <span className="btn-icon">🔧</span>
              Test Server
            </button>
            <button 
              className="btn btn-primary"
              onClick={testTTS}
              disabled={loading}
            >
              <span className="btn-icon">⚡</span>
              Test Voice
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="tabs">
        <div className="tabs-container">
          <button
            className={`tab ${activeTab === "generate" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("generate")}
          >
            <span className="tab-icon">🎵</span>
            Generate Audio
          </button>
          <button
            className={`tab ${activeTab === "files" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("files")}
          >
            <span className="tab-icon">📁</span>
            Audio Files
            {audioFiles.length > 0 && (
              <span className="tab-badge">{audioFiles.length}</span>
            )}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {/* Generate Audio Tab */}
        {activeTab === "generate" && (
          <div className="grid-layout">
            {/* Left Column - Input */}
            <div className="input-section">
              {/* Language Selection */}
              <div className="card">
                <div className="card-header">
                  <span className="card-icon">🌐</span>
                  <h3>Language Settings</h3>
                </div>
                <div className="card-body">
                  <select 
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="select"
                  >
                    <option value="auto">Auto Detect (Recommended)</option>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>
              </div>


              {/* Text Input */}
              <div className="card">
                <div className="card-header">
                  <span className="card-icon">📝</span>
                  <h3>Enter Your Text</h3>
                </div>
                <div className="card-body">
                  {/* Sample Texts */}
                  <div className="sample-texts">
                    <h4 className="sample-title">Try Sample Texts:</h4>
                    <div className="sample-grid">
                      <button 
                        onClick={() => setText(sampleTexts.hindiShort)}
                        className="sample-btn hindi-short"
                      >
                        <span>🇮🇳 Hindi Short</span>
                      </button>
                      <button 
                        onClick={() => setText(sampleTexts.englishShort)}
                        className="sample-btn english-short"
                      >
                        <span>🇺🇸 English Short</span>
                      </button>
                      <button 
                        onClick={() => setText(sampleTexts.hindiLong)}
                        className="sample-btn hindi-long"
                      >
                        <span>🇮🇳 Hindi Long</span>
                      </button>
                      <button 
                        onClick={() => setText(sampleTexts.englishLong)}
                        className="sample-btn english-long"
                      >
                        <span>🇺🇸 English Long</span>
                      </button>
                      <button 
                        onClick={() => setText("")}
                        className="sample-btn clear"
                      >
                        <span>🗑️ Clear Text</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type or paste your text here... (Supports both short and long texts)"
                    rows={8}
                    className="text-input"
                  />
                  <div className="text-stats">
                    <span>{text.length} characters</span>
                    <span>{text.split(/\s+/).filter(word => word.length > 0).length} words</span>
                    <span>~{Math.ceil(text.length / 5)} tokens</span>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <div className="card">
                <div className="card-body">
                  <button
                    onClick={generateAudio}
                    disabled={loading || !text.trim()}
                    className={`generate-btn ${loading ? 'loading' : ''} ${!text.trim() ? 'disabled' : ''}`}
                  >
                    {loading ? (
                      <>
                        <div className="spinner"></div>
                        Creating Audio...
                      </>
                    ) : (
                      <>
                        <span className="btn-icon">🚀</span>
                        Generate Audio
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Results */}
            <div className="output-section">
              {/* Error Display */}
              {error && (
                <div className="error-card">
                  <div className="error-header">
                    <span className="error-icon">❌</span>
                    <h3>Error</h3>
                  </div>
                  <p>{error}</p>
                </div>
              )}

              {/* Result Display */}
              {result && (
                <div className="result-card">
                  <div className="result-header">
                    <div className="success-badge">
                      <span className="success-icon">✅</span>
                      Success!
                    </div>
                    <h3>{result.message}</h3>
                  </div>

                  {/* Voice & Processing Info */}
                  <div className="result-info">
                    <div className="info-grid">
                      <div className="info-item">
                       
                        <span className="info-label">🎵 Voice</span>
                        <span className="info-value">{result.voiceInfo?.voice}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">🌐 Language</span>
                        <span className="info-value">{result.voiceInfo?.language}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">🔧 Service</span>
                        <span className="info-value">{result.voiceInfo?.service}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">📊 Text Length</span>
                        <span className="info-value">{result.textLength} chars</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">📦 Chunks</span>
                        <span className="info-value">{result.chunksProcessed}/{result.totalChunks}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">💾 File Size</span>
                        <span className="info-value">{formatFileSize(result.fileSize)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Audio Player */}
                  <div className="audio-player-section">
                    <h4>🎧 Audio Preview</h4>
                    <div className={`audio-player ${isPlaying ? 'playing' : ''}`}>
                      <audio 
                        ref={audioRef}
                        controls 
                        src={`http://localhost:5000${result.downloadUrl}`}
                        onPlay={handleAudioPlay}
                        onPause={handleAudioPause}
                        onEnded={handleAudioPause}
                      />
                    </div>
                  </div>

                  {/* Download Options */}
                  <div className="action-buttons">
                    <a
                      href={`http://localhost:5000${result.downloadUrl}`}
                      download={result.fileName}
                      className="btn btn-success"
                    >
                      <span className="btn-icon">💾</span>
                      Download MP3
                    </a>
                    <button
                      onClick={() => window.open(`http://localhost:5000${result.downloadUrl}`, "_blank")}
                      className="btn btn-secondary"
                    >
                      <span className="btn-icon">🔗</span>
                      Open in New Tab
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`http://localhost:5000${result.downloadUrl}`);
                        alert("Audio link copied to clipboard!");
                      }}
                      className="btn btn-outline"
                    >
                      <span className="btn-icon">📋</span>
                      Copy Link
                    </button>
                  </div>
                </div>
              )}

              {/* Instructions */}
              {!result && !error && (
                <div className="info-card">
                  <div className="card-header">
                    <span className="card-icon">ℹ️</span>
                    <h3>How to Use</h3>
                  </div>
                  <div className="card-body">
                    <ol className="instructions-list">
                      <li>Select language or use auto-detection</li>
                      <li>Choose a voice from available options</li>
                      <li>Enter text or use sample texts</li>
                      <li>Click "Generate Audio"</li>
                      <li>Play and download your audio file</li>
                    </ol>
                    
                    <div className="features-grid">
                      <div className="feature">
                        <span className="feature-icon">✅</span>
                        <span>Multiple Voice Options</span>
                      </div>
                      <div className="feature">
                        <span className="feature-icon">✅</span>
                        <span>Hindi & English Support</span>
                      </div>
                      <div className="feature">
                        <span className="feature-icon">✅</span>
                        <span>Short & Long Text</span>
                      </div>
                      <div className="feature">
                        <span className="feature-icon">✅</span>
                        <span>High Quality Audio</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audio Files Tab */}
        {activeTab === "files" && (
          <div className="files-section">
            <div className="card">
              <div className="card-header">
                <span className="card-icon">📁</span>
                <h3>Generated Audio Files</h3>
                <button 
                  onClick={loadAudioFiles}
                  className="btn btn-outline"
                >
                  <span className="btn-icon">🔄</span>
                  Refresh
                </button>
              </div>
              <div className="card-body">
                {audioFiles.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🎵</div>
                    <h3>No Audio Files Yet</h3>
                    <p>Generate your first audio file to see it here!</p>
                    <button 
                      onClick={() => setActiveTab("generate")}
                      className="btn btn-primary"
                    >
                      Generate Audio
                    </button>
                  </div>
                ) : (
                  <div className="files-grid">
                    {audioFiles.map((file, index) => (
                      <div key={index} className="file-card">
                        <div className="file-header">
                          <div className="file-info">
                            <h4 className="file-name">{file.name}</h4>
                            <div className="file-meta">
                              <span className="file-size">{formatFileSize(file.size)}</span>
                              <span className="file-date">{formatDate(file.created)}</span>
                            </div>
                          </div>
                          <div className="file-actions">
                            <audio
                              controls
                              src={`http://localhost:5000${file.downloadUrl}`}
                              className="file-audio"
                            />
                            <a
                              href={`http://localhost:5000${file.downloadUrl}`}
                              download={file.name}
                              className="btn btn-success btn-sm"
                            >
                              💾
                            </a>
                            <button
                              onClick={() => deleteAudioFile(file.name)}
                              className="btn btn-danger btn-sm"
                              title="Delete File"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <p>&copy; 2024 VoiceCraft Pro. AI-Powered Text to Speech Converter.</p>
          <div className="footer-links">
            <span>Built with ❤️ using React & Node.js</span>
          </div>
        </div>
      </footer>
    </div>
  );
}







