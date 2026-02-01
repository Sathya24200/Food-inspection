import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    FaCamera,
    FaTemperatureHigh,
    FaWeight,
    FaCheckCircle,
    FaTimesCircle,
    FaBox,
    FaLock,
    FaLockOpen,
    FaHistory,
    FaChartBar,
    FaMicrochip,
    FaFileUpload,
} from 'react-icons/fa';
import './Dashboard.css';

const Dashboard = () => {
    // State management
    const [stats, setStats] = useState({
        totalPackages: 0,
        passedPackages: 0,
        rejectedPackages: 0,
        sealedPackages: 0,
        unsealedPackages: 0,
    });
    const [inspections, setInspections] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Camera and inspection state
    const [cameraActive, setCameraActive] = useState(false);
    const [capturedImage, setCapturedImage] = useState(null);
    const [temperature, setTemperature] = useState('');
    const [weight, setWeight] = useState('');
    const [isSealed, setIsSealed] = useState(true);
    const [arduinoConnected, setArduinoConnected] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const fileInputRef = useRef(null);
    const analysisTimerRef = useRef(null);

    const analyzeImage = async (imageSrc, isRealtime = false) => {
        if (!isRealtime) {
            setIsAnalyzing(true);
            setAnalysisResult(null);
        }
        setError('');

        try {
            // Call the real Python AI service
            const response = await axios.post('http://localhost:5001/predict', {
                image: imageSrc
            });

            const data = response.data;

            // Only update the form state if a package was actually detected
            if (data.packageDetected) {
                setIsSealed(data.isSealed);
            }

            setAnalysisResult({
                status: data.status,
                confidence: data.confidence,
                color: data.isSealed ? '#2ecc71' : '#e74c3c'
            });

            if (!isRealtime) {
                setSuccess('AI Analysis Complete');
                setTimeout(() => setSuccess(''), 2000);
            }
        } catch (err) {
            console.error('AI Service Error:', err);
            if (!isRealtime) {
                setError('AI Service not running. Using mock results.');
                // Fallback to mock
                const aiIsSealed = Math.random() > 0.3;
                setIsSealed(aiIsSealed);
                setAnalysisResult({
                    status: aiIsSealed ? 'SEALED' : 'UNSEALED',
                    confidence: (Math.random() * (99 - 85) + 85).toFixed(1) + '%',
                    color: aiIsSealed ? '#2ecc71' : '#e74c3c'
                });
            }
        } finally {
            if (!isRealtime) {
                setIsAnalyzing(false);
            }
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result;
                setCapturedImage(result);
                analyzeImage(result);
            };
            reader.readAsDataURL(file);
        }
    };

    const ConnectArduino = async () => {
        if ('serial' in navigator) {
            try {
                const port = await navigator.serial.requestPort();
                await port.open({ baudRate: 9600 });
                setArduinoConnected(true);
                setSuccess('Arduino connected successfully!');

                const textDecoder = new TextDecoderStream();
                const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
                const reader = textDecoder.readable.getReader();

                let buffer = '';
                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;

                        buffer += value;
                        if (buffer.includes('\n')) {
                            const lines = buffer.split('\n');
                            buffer = lines.pop(); // Keep incomplete line in buffer

                            for (const line of lines) {
                                const cleanLine = line.trim();
                                if (!cleanLine) continue;

                                console.log('Arduino Data:', cleanLine);

                                // Expected formats: 
                                // 1. "T:25.5,W:450,S:1"
                                // 2. "25.5,450,1"

                                if (cleanLine.includes('T:')) {
                                    const parts = cleanLine.split(',');
                                    parts.forEach(part => {
                                        if (part.startsWith('T:')) setTemperature(part.split(':')[1]);
                                        if (part.startsWith('W:')) setWeight(part.split(':')[1]);
                                        if (part.startsWith('S:')) setIsSealed(part.split(':')[1] === '1');
                                    });
                                } else if (cleanLine.includes(',')) {
                                    const [temp, wt, seal] = cleanLine.split(',');
                                    if (temp) setTemperature(temp);
                                    if (wt) setWeight(wt);
                                    if (seal) setIsSealed(seal.trim() === '1');
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Read error:', error);
                } finally {
                    reader.releaseLock();
                }

            } catch (err) {
                console.error('Serial connection error:', err);
                setError('Failed to connect to Arduino: ' + err.message);
                setArduinoConnected(false);
            }
        } else {
            setError('Web Serial API not supported in this browser.');
        }
    };

    // Fetch data on component mount
    useEffect(() => {
        fetchStats();
        fetchInspections();
    }, []);

    // Video Stream & Real-time Analysis Management
    useEffect(() => {
        let interval;
        if (cameraActive && streamRef.current) {
            const video = videoRef.current;
            if (video) {
                video.srcObject = streamRef.current;
                // Force play after metadata is loaded
                video.onloadedmetadata = () => {
                    video.play().catch(err => console.error("Video play error:", err));
                };
                // Fallback direct play
                video.play().catch(() => { });
            }

            interval = setInterval(async () => {
                if (videoRef.current && canvasRef.current && videoRef.current.readyState === 4) {
                    const canvas = canvasRef.current;
                    const video = videoRef.current;
                    const context = canvas.getContext('2d');

                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    context.drawImage(video, 0, 0);

                    const imageData = canvas.toDataURL('image/jpeg', 0.5);
                    await analyzeImage(imageData, true);
                }
            }, 800);
        } else if (!cameraActive && videoRef.current) {
            videoRef.current.srcObject = null;
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [cameraActive]);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    const fetchStats = async () => {
        try {
            const { data } = await axios.get('/api/inspections/stats');
            setStats(data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const fetchInspections = async () => {
        try {
            const { data } = await axios.get('/api/inspections');
            setInspections(data);
        } catch (err) {
            console.error('Error fetching inspections:', err);
        }
    };

    const startCamera = async () => {
        setCapturedImage(null);
        setAnalysisResult(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 } },
            });
            streamRef.current = stream;
            setCameraActive(true);
            setError('');

            // Fallback: Check if ref is already available
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(e => console.log("Play failed, handled by useEffect"));
            }
        } catch (err) {
            setError('Camera access denied or device not found.');
            console.error('Camera error:', err);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            if (videoRef.current) videoRef.current.srcObject = null;
            streamRef.current = null;
        }
        setCameraActive(false);
    };

    const captureImage = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const context = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageData);
        stopCamera();
        analyzeImage(imageData);
    };

    const simulateSensorData = () => {
        // Simulate temperature (0-30°C)
        const temp = (Math.random() * 30).toFixed(1);
        setTemperature(temp);

        // Simulate weight (50-1200g)
        const wt = (Math.random() * 1150 + 50).toFixed(0);
        setWeight(wt);

        // Simulate seal detection (80% sealed, 20% unsealed)
        const sealed = Math.random() > 0.2;
        setIsSealed(sealed);

        setSuccess('Sensor data simulated successfully!');
        setTimeout(() => setSuccess(''), 3000);
    };

    const submitInspection = async () => {
        if (!capturedImage) {
            setError('Please capture an image first');
            return;
        }

        if (!temperature || !weight) {
            setError('Please generate sensor data first');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const packageId = `PKG-${Date.now()}`;

            const inspectionData = {
                packageId,
                temperature: parseFloat(temperature),
                weight: parseFloat(weight),
                isSealed,
                imageData: capturedImage,
            };

            await axios.post('/api/inspections', inspectionData);

            setSuccess('Inspection submitted successfully!');

            // Reset form
            setCapturedImage(null);
            setTemperature('');
            setWeight('');
            setIsSealed(true);

            // Refresh data
            fetchStats();
            fetchInspections();

            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit inspection');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="dashboard-container">
            {/* Header */}
            <header className="dashboard-header">
                <div className="container">
                    <div className="header-content">
                        <div className="header-left">
                            <h1>🍱 Food Quality Inspection</h1>
                            <p>Smart Packaged Food Quality Control System</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container">
                {/* Alerts */}
                {error && (
                    <div className="alert alert-error fade-in">
                        <FaTimesCircle />
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="alert alert-success fade-in">
                        <FaCheckCircle />
                        <span>{success}</span>
                    </div>
                )}

                {/* Statistics Cards */}
                <div className="stats-grid">
                    <div className="stat-card card fade-in" style={{ animationDelay: '0.1s' }}>
                        <div className="stat-icon" style={{ background: 'var(--gradient-1)' }}>
                            <FaBox />
                        </div>
                        <div className="stat-content">
                            <h3>{stats.totalPackages}</h3>
                            <p>Total Packages</p>
                        </div>
                    </div>

                    <div className="stat-card card fade-in" style={{ animationDelay: '0.2s' }}>
                        <div className="stat-icon" style={{ background: 'var(--gradient-4)' }}>
                            <FaCheckCircle />
                        </div>
                        <div className="stat-content">
                            <h3>{stats.passedPackages}</h3>
                            <p>Passed</p>
                        </div>
                    </div>

                    <div className="stat-card card fade-in" style={{ animationDelay: '0.3s' }}>
                        <div className="stat-icon" style={{ background: 'var(--gradient-2)' }}>
                            <FaTimesCircle />
                        </div>
                        <div className="stat-content">
                            <h3>{stats.rejectedPackages}</h3>
                            <p>Rejected</p>
                        </div>
                    </div>

                    <div className="stat-card card fade-in" style={{ animationDelay: '0.4s' }}>
                        <div className="stat-icon" style={{ background: 'var(--gradient-3)' }}>
                            <FaLock />
                        </div>
                        <div className="stat-content">
                            <h3>{stats.sealedPackages}</h3>
                            <p>Sealed</p>
                        </div>
                    </div>

                    <div className="stat-card card fade-in" style={{ animationDelay: '0.5s' }}>
                        <div className="stat-icon" style={{ background: 'var(--gradient-2)' }}>
                            <FaLockOpen />
                        </div>
                        <div className="stat-content">
                            <h3>{stats.unsealedPackages}</h3>
                            <p>Unsealed</p>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="content-grid">
                    {/* Inspection Panel */}
                    <div className="inspection-panel card">
                        <h2>
                            <FaCamera /> New Inspection
                        </h2>

                        {/* Camera Section */}
                        <div className="camera-section">
                            <div className="camera-container" style={{ position: 'relative', background: '#000', overflow: 'hidden' }}>
                                {/* Persistent Video Element */}
                                <div className="camera-feed-container" style={{
                                    position: 'relative',
                                    width: '100%',
                                    height: '100%',
                                    display: cameraActive && !capturedImage ? 'block' : 'none'
                                }}>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="camera-feed"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
                                    ></video>

                                    {analysisResult && (
                                        <div className="live-status-overlay" style={{
                                            position: 'absolute',
                                            top: '15px',
                                            right: '15px',
                                            background: analysisResult.status === 'NO_OBJECT' ? 'rgba(51, 65, 85, 0.8)' : analysisResult.color,
                                            color: 'white',
                                            padding: '8px 15px',
                                            borderRadius: '20px',
                                            fontWeight: 'bold',
                                            zIndex: 10,
                                            boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                                            border: '2px solid white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '14px',
                                            textTransform: 'uppercase'
                                        }}>
                                            {analysisResult.status === 'SEALED' ? <FaLock /> :
                                                analysisResult.status === 'UNSEALED' ? <FaLockOpen /> :
                                                    <FaMicrochip className="spin" />}

                                            {analysisResult.status === 'NO_OBJECT' ? 'Searching for package...' :
                                                `${analysisResult.status} (${analysisResult.confidence})`}
                                        </div>
                                    )}

                                    <div className="scanning-line"></div>
                                </div>

                                {/* Placeholder */}
                                {!cameraActive && !capturedImage && (
                                    <div className="camera-placeholder" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                        <FaCamera style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }} />
                                        <p>Ready to Inspect</p>
                                    </div>
                                )}

                                {/* Image Preview */}
                                {capturedImage && (
                                    <div className="image-preview-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
                                        <img
                                            src={capturedImage}
                                            alt="Captured package"
                                            className="captured-image"
                                            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
                                        />

                                        {isAnalyzing && (
                                            <div className="scanning-overlay" style={{
                                                position: 'absolute',
                                                top: 0, left: 0, right: 0, bottom: 0,
                                                border: '2px solid #3498db',
                                                boxShadow: '0 0 10px #3498db',
                                                background: 'rgba(52, 152, 219, 0.1)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <div style={{ background: 'rgba(0,0,0,0.7)', padding: '10px 20px', borderRadius: '5px', color: 'white' }}>
                                                    <FaMicrochip className="spin" /> Analyzing...
                                                </div>
                                            </div>
                                        )}

                                        {!isAnalyzing && analysisResult && (
                                            <div className="result-overlay" style={{
                                                position: 'absolute',
                                                top: '10px', right: '10px',
                                                background: analysisResult.color,
                                                color: 'white',
                                                padding: '8px 15px',
                                                borderRadius: '20px',
                                                fontWeight: 'bold',
                                                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                                                border: '2px solid white'
                                            }}>
                                                {analysisResult.status} ({analysisResult.confidence})
                                            </div>
                                        )}
                                    </div>
                                )}

                                <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                            </div>


                            <div className="camera-controls">
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    onChange={handleFileUpload}
                                />

                                {!cameraActive && !capturedImage && (
                                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                                        <button onClick={startCamera} className="btn btn-primary" style={{ flex: 1 }}>
                                            <FaCamera /> Start Camera
                                        </button>
                                        <button onClick={() => fileInputRef.current.click()} className="btn btn-secondary" style={{ flex: 1 }}>
                                            <FaFileUpload /> Upload Image
                                        </button>
                                    </div>
                                )}

                                {cameraActive && (
                                    <>
                                        <button onClick={captureImage} className="btn btn-success">
                                            <FaCamera /> Capture Image
                                        </button>
                                        <button onClick={stopCamera} className="btn btn-secondary">
                                            Cancel
                                        </button>
                                    </>
                                )}

                                {capturedImage && (
                                    <button
                                        onClick={() => {
                                            setCapturedImage(null);
                                        }}
                                        className="btn btn-secondary"
                                    >
                                        Retake / Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Sensor Data Section */}
                        <div className="sensor-section">
                            <h3>
                                Sensor Data
                                {arduinoConnected && <span className="badge badge-success" style={{ fontSize: '0.6em', marginLeft: '10px', verticalAlign: 'middle' }}>Arduino Live</span>}
                            </h3>

                            <div className="sensor-controls" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                <button onClick={simulateSensorData} className="btn btn-primary" style={{ flex: 1 }}>
                                    <FaChartBar /> Simulate Data
                                </button>
                                <button onClick={ConnectArduino} className="btn btn-warning" style={{ flex: 1 }} disabled={arduinoConnected}>
                                    <FaMicrochip /> {arduinoConnected ? 'Connected' : 'Connect Arduino'}
                                </button>
                            </div>

                            <div className="sensor-grid">
                                <div className="sensor-item">
                                    <label>
                                        <FaTemperatureHigh /> Temperature (°C)
                                    </label>
                                    <input
                                        type="number"
                                        value={temperature}
                                        onChange={(e) => setTemperature(e.target.value)}
                                        placeholder="0-25°C acceptable"
                                        step="0.1"
                                    />
                                </div>

                                <div className="sensor-item">
                                    <label>
                                        <FaWeight /> Weight (g)
                                    </label>
                                    <input
                                        type="number"
                                        value={weight}
                                        onChange={(e) => setWeight(e.target.value)}
                                        placeholder="100-1000g acceptable"
                                        step="1"
                                    />
                                </div>

                                <div className="sensor-item">
                                    <label>
                                        {isSealed ? <FaLock /> : <FaLockOpen />} Seal Status
                                    </label>
                                    <select
                                        value={isSealed}
                                        onChange={(e) => setIsSealed(e.target.value === 'true')}
                                    >
                                        <option value="true">Sealed</option>
                                        <option value="false">Unsealed</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={submitInspection}
                                className="btn btn-success btn-block"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="loading"></div>
                                ) : (
                                    <>
                                        <FaCheckCircle /> Submit Inspection
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* History Panel */}
                    <div className="history-panel card">
                        <h2>
                            <FaHistory /> Inspection History
                        </h2>

                        <div className="history-list">
                            {inspections.length === 0 ? (
                                <div className="empty-state">
                                    <FaHistory />
                                    <p>No inspections yet</p>
                                </div>
                            ) : (
                                inspections.map((inspection) => (
                                    <div
                                        key={inspection._id}
                                        className={`history-item ${inspection.status}`}
                                    >
                                        <div className="history-header">
                                            <span className="package-id">{inspection.packageId}</span>
                                            <span
                                                className={`badge badge-${inspection.status === 'passed' ? 'success' : 'danger'
                                                    }`}
                                            >
                                                {inspection.status}
                                            </span>
                                        </div>

                                        <div className="history-details">
                                            <div className="detail-item">
                                                <FaTemperatureHigh />
                                                <span>{inspection.temperature}°C</span>
                                            </div>
                                            <div className="detail-item">
                                                <FaWeight />
                                                <span>{inspection.weight}g</span>
                                            </div>
                                            <div className="detail-item">
                                                {inspection.isSealed ? <FaLock /> : <FaLockOpen />}
                                                <span>{inspection.isSealed ? 'Sealed' : 'Unsealed'}</span>
                                            </div>
                                        </div>

                                        <div className="history-reason">
                                            <small>{inspection.reason}</small>
                                        </div>

                                        <div className="history-timestamp">
                                            {formatDate(inspection.timestamp)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
