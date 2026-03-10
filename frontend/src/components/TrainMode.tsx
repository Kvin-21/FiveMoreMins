import { useState, useEffect, useRef, useCallback } from 'react';
import { extractFeatures } from '../hooks/useFaceDetection';

type Label = 'focused' | 'distracted';

interface Sample {
  features: number[];
  label: Label;
}

// The secret calibration page — visit /train to personalise the detection model
// Takes rapid snapshots of your face and lets you label them, then computes
// personal thresholds that replace the hardcoded defaults in useFaceDetection
export default function TrainMode() {
  const [phase, setPhase] = useState<'idle' | 'capturing' | 'done'>('idle');
  const [currentLabel, setCurrentLabel] = useState<Label>('focused');
  const [samples, setSamples] = useState<Sample[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [status, setStatus] = useState('');
  const [calibrationSaved, setCalibrationSaved] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const captureRef = useRef(false);
  const latestFeaturesRef = useRef<number[] | null>(null);
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const focusedSamples = samples.filter(s => s.label === 'focused');
  const distractedSamples = samples.filter(s => s.label === 'distracted');

  const stopEverything = useCallback(() => {
    captureRef.current = false;
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    if (cameraRef.current) {
      try { cameraRef.current.stop(); } catch {}
      cameraRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const [{ FaceMesh }, { Camera }] = await Promise.all([
        import('@mediapipe/face_mesh'),
        import('@mediapipe/camera_utils'),
      ]);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const faceMesh = new FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65,
      });

      faceMesh.onResults((results: any) => {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
          latestFeaturesRef.current = null;
          return;
        }
        const landmarks = results.multiFaceLandmarks[0];
        latestFeaturesRef.current = extractFeatures(landmarks);
      });

      faceMeshRef.current = faceMesh;

      // Use the same visible video element for both display and MediaPipe
      const internalVideo = document.createElement('video');
      internalVideo.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
      internalVideo.setAttribute('playsinline', 'true');
      internalVideo.muted = true;
      internalVideo.srcObject = stream;
      document.body.appendChild(internalVideo);

      const camera = new Camera(internalVideo, {
        onFrame: async () => {
          if (faceMeshRef.current) {
            await faceMeshRef.current.send({ image: internalVideo });
          }
        },
        width: 640,
        height: 480,
      });

      cameraRef.current = camera;
      await camera.start();

      setStatus('Camera ready. Start labelling your poses.');
    } catch (err: any) {
      setStatus('Camera error: ' + (err?.message || 'unknown'));
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopEverything();
  }, [startCamera, stopEverything]);

  const startCapturing = (label: Label) => {
    if (captureIntervalRef.current) return;
    setCurrentLabel(label);
    setPhase('capturing');
    setCountdown(3);

    // Brief countdown before capturing starts so you can get into position
    let count = 3;
    const countTimer = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(countTimer);
        setCountdown(0);
        setStatus(`Capturing "${label}" samples — hold your position...`);
        captureRef.current = true;

        // Rapid burst: capture one sample every 250ms
        captureIntervalRef.current = setInterval(() => {
          if (!captureRef.current) return;
          const features = latestFeaturesRef.current;
          if (features) {
            setSamples(prev => [...prev, { features, label }]);
          }
        }, 250);

        // Auto-stop after 5 seconds of capture (20 samples at 250ms)
        setTimeout(() => {
          captureRef.current = false;
          if (captureIntervalRef.current) {
            clearInterval(captureIntervalRef.current);
            captureIntervalRef.current = null;
          }
          setPhase('idle');
          setStatus(`Done! Captured "${label}" samples. Add more or save calibration.`);
        }, 5000);
      }
    }, 1000);
  };

  const saveCalibration = () => {
    if (focusedSamples.length < 5 || distractedSamples.length < 5) {
      setStatus('Need at least 5 focused AND 5 distracted samples before saving.');
      return;
    }

    // Compute the mean headTilt (feature index 0) for each class
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    const focusedTilts = focusedSamples.map(s => s.features[0]);
    const distractedTilts = distractedSamples.map(s => s.features[0]);

    const focusedMeanTilt = mean(focusedTilts);
    const distractedMeanTilt = mean(distractedTilts);

    // Also compute mean gaze score (feature index 5)
    const focusedGaze = mean(focusedSamples.map(s => s.features[5]));
    const distractedGaze = mean(distractedSamples.map(s => s.features[5]));

    // Also compute chin ratio mean (feature index 4)
    const focusedChin = mean(focusedSamples.map(s => s.features[4]));
    const distractedChin = mean(distractedSamples.map(s => s.features[4]));

    const calibration = {
      focusedTilt: focusedMeanTilt,
      distractedTilt: distractedMeanTilt,
      focusedGaze,
      distractedGaze,
      focusedChin,
      distractedChin,
      samplesCount: samples.length,
      trainedAt: new Date().toISOString(),
    };

    localStorage.setItem('fmm_calibration', JSON.stringify(calibration));
    setCalibrationSaved(true);
    setPhase('done');
    setStatus('✅ Personal calibration saved! The focus detector is now tuned to you.');
  };

  const clearCalibration = () => {
    localStorage.removeItem('fmm_calibration');
    setSamples([]);
    setCalibrationSaved(false);
    setPhase('idle');
    setStatus('Calibration cleared. Start fresh.');
  };

  const existingCalibration = (() => {
    try {
      const raw = localStorage.getItem('fmm_calibration');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  return (
    <div className="train-page">
      <div className="train-header">
        <h2 className="train-title">🎯 Personal Calibration</h2>
        <p className="train-subtitle">
          Train the detector to know <em>your</em> focused vs. distracted pose so it stops crying wolf.
        </p>
      </div>

      <div className="train-layout">
        {/* Camera preview */}
        <div className="train-camera-col">
          <div className="train-camera-wrapper">
            <video
              ref={videoRef}
              className="train-camera-video"
              autoPlay
              playsInline
              muted
            />
            {countdown > 0 && (
              <div className="train-countdown">{countdown}</div>
            )}
            <div className={`train-camera-label ${currentLabel === 'distracted' ? 'train-label-bad' : 'train-label-ok'}`}>
              {phase === 'capturing' ? `Capturing: ${currentLabel}` : 'Live preview'}
            </div>
          </div>

          <div className="train-sample-counts">
            <div className="train-count train-count-focused">
              <span className="count-icon">✅</span>
              <span className="count-num">{focusedSamples.length}</span>
              <span className="count-label">focused</span>
            </div>
            <div className="train-count train-count-distracted">
              <span className="count-icon">📵</span>
              <span className="count-num">{distractedSamples.length}</span>
              <span className="count-label">distracted</span>
            </div>
          </div>
        </div>

        {/* Instructions + controls */}
        <div className="train-controls-col">
          <div className="train-instructions">
            <h3>How to calibrate:</h3>
            <ol>
              <li>Click <strong>Capture Focused</strong> — sit normally like you're working. Hold for 5 seconds.</li>
              <li>Click <strong>Capture Distracted</strong> — look down at your phone. Hold for 5 seconds.</li>
              <li>Repeat 2–3 times each for better accuracy.</li>
              <li>Click <strong>Save Calibration</strong> when done.</li>
            </ol>
            <p className="train-note">Need at least <strong>5 samples each</strong>. More is better. Runs 100% locally — nothing is sent anywhere.</p>
          </div>

          {status && (
            <div className={`train-status ${status.startsWith('✅') ? 'train-status-ok' : ''}`}>
              {status}
            </div>
          )}

          <div className="train-buttons">
            <button
              className="btn-train-focused"
              onClick={() => startCapturing('focused')}
              disabled={phase === 'capturing'}
            >
              ✅ Capture Focused
            </button>
            <button
              className="btn-train-distracted"
              onClick={() => startCapturing('distracted')}
              disabled={phase === 'capturing'}
            >
              📵 Capture Distracted
            </button>
          </div>

          <button
            className="btn-save-calibration"
            onClick={saveCalibration}
            disabled={focusedSamples.length < 5 || distractedSamples.length < 5}
          >
            💾 Save Calibration ({samples.length} samples)
          </button>

          {existingCalibration && (
            <div className="train-existing">
              <div className="train-existing-title">Current calibration:</div>
              <div className="train-existing-detail">
                Trained with {existingCalibration.samplesCount} samples on {new Date(existingCalibration.trainedAt).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore' })}
              </div>
              <button className="btn-clear-calibration" onClick={clearCalibration}>
                🗑 Clear &amp; Retrain
              </button>
            </div>
          )}

          {calibrationSaved && (
            <div className="train-success-box">
              <p>✅ Calibration active! Your focus sessions will now use your personal thresholds.</p>
              <a href="/focus" className="btn-primary btn-small">Go Focus →</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}