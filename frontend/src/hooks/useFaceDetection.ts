import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Thresholds ────────────────────────────────────────────────────────────────
// Change these to adjust how sensitive each warning tier is.
// MILD_SECONDS   → seconds of detected distraction before the first warning
// MEDIUM_SECONDS → seconds before the second (angrier) warning
// PENALTY_SECONDS→ seconds before the blackmail email fires
export const MILD_SECONDS = 2 * 60;    // 5 minutes
export const MEDIUM_SECONDS = 3 * 60; // 15 minutes
export const PENALTY_SECONDS = 6 * 60; // 30 minutes

// Head-tilt threshold: chin.y - nose.y > this value means looking down at phone
const HEAD_TILT_THRESHOLD = 0.14;
// How long (ms) a distraction must be held before we count it
const CONFIRM_DELAY_MS = 3000;
// ──────────────────────────────────────────────────────────────────────────────

interface FaceDetectionState {
  isDistracted: boolean;
  distractedSeconds: number;
  totalDistractedSeconds: number;
  cameraError: string | null;
  cameraReady: boolean;
  stream: MediaStream | null;
}

// Custom hook for webcam-based distraction detection using MediaPipe Face Mesh
// Replaces the old tab-visibility approach — now we actually watch you
export function useFaceDetection(isSessionActive: boolean) {
  const [state, setState] = useState<FaceDetectionState>({
    isDistracted: false,
    distractedSeconds: 0,
    totalDistractedSeconds: 0,
    cameraError: null,
    cameraReady: false,
    stream: null,
  });

  // Internal hidden video that MediaPipe Camera utility uses — never shown to user
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const distractedSinceRef = useRef<number | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConfirmedDistractedRef = useRef(false);
  const distractedStartRef = useRef<number | null>(null);
  const totalDistractedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetBaseRef = useRef<number | null>(null);
  const isActiveRef = useRef(isSessionActive);

  useEffect(() => {
    isActiveRef.current = isSessionActive;
  }, [isSessionActive]);

  const stopCamera = useCallback(() => {
    if (cameraRef.current) {
      try { cameraRef.current.stop(); } catch {}
      cameraRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (internalVideoRef.current) {
      internalVideoRef.current.srcObject = null;
      if (internalVideoRef.current.parentNode) {
        internalVideoRef.current.parentNode.removeChild(internalVideoRef.current);
      }
      internalVideoRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
    setState(prev => ({ ...prev, stream: null, cameraReady: false }));
  }, []);

  const startCamera = useCallback(async () => {
    try {
      // Dynamically load MediaPipe — runs fully client-side, no server needed
      const [{ FaceMesh }, { Camera }] = await Promise.all([
        import('@mediapipe/face_mesh'),
        import('@mediapipe/camera_utils'),
      ]);

      // Create a hidden video element purely for MediaPipe to consume
      const hiddenVideo = document.createElement('video');
      hiddenVideo.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
      hiddenVideo.setAttribute('playsinline', 'true');
      hiddenVideo.muted = true;
      document.body.appendChild(hiddenVideo);
      internalVideoRef.current = hiddenVideo;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 },
      });
      streamRef.current = stream;
      hiddenVideo.srcObject = stream;

      // Expose the raw stream so FocusMode can attach it to a visible <video> separately
      setState(prev => ({ ...prev, stream }));

      const faceMesh = new FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });

      faceMesh.onResults((results: any) => {
        if (!isActiveRef.current) return;

        // No face in frame — treat as distracted (walked away / looking down hard)
        const noFace = !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0;

        let lookingAtPhone = false;

        if (!noFace) {
          const landmarks = results.multiFaceLandmarks[0];

          // Landmark indices: nose tip = 1, chin = 152, left eye outer = 33, right eye outer = 263
          const nose = landmarks[1];
          const chin = landmarks[152];
          const leftEyeOuter = landmarks[33];
          const rightEyeOuter = landmarks[263];

          // Head pitch: if chin is much lower than nose in normalised coords, head is tilted down
          const headTilt = chin.y - nose.y;

          // Eye level in frame: if eyes are near the top of the frame, head is tilted down
          const eyeMidY = (leftEyeOuter.y + rightEyeOuter.y) / 2;

          // Gaze direction: compare iris position (landmarks 468/473 with refineLandmarks)
          // If both irises are pointing downward relative to the eye centre, likely looking down
          let gazeDown = false;
          if (landmarks[468] && landmarks[473]) {
            const leftIris = landmarks[468];
            const rightIris = landmarks[473];
            const leftUpperLid = landmarks[159];
            const leftLowerLid = landmarks[145];
            const rightUpperLid = landmarks[386];
            const rightLowerLid = landmarks[374];

            const leftEyeCentreY = (leftUpperLid.y + leftLowerLid.y) / 2;
            const rightEyeCentreY = (rightUpperLid.y + rightLowerLid.y) / 2;

            const leftGazeDown = leftIris.y > leftEyeCentreY + 0.01;
            const rightGazeDown = rightIris.y > rightEyeCentreY + 0.01;
            gazeDown = leftGazeDown && rightGazeDown;
          }

          // Combine signals: strong head tilt alone is enough, or mild tilt + gaze down
          lookingAtPhone =
            headTilt > HEAD_TILT_THRESHOLD ||
            (headTilt > HEAD_TILT_THRESHOLD * 0.7 && gazeDown && eyeMidY < 0.45);
        }

        const isDistracted = noFace || lookingAtPhone;

        if (isDistracted) {
          if (distractedSinceRef.current === null) {
            distractedSinceRef.current = Date.now();
          }
          // Only flip to "confirmed distracted" after CONFIRM_DELAY_MS to avoid false positives
          if (!isConfirmedDistractedRef.current && confirmTimerRef.current === null) {
            confirmTimerRef.current = setTimeout(() => {
              isConfirmedDistractedRef.current = true;
              distractedStartRef.current = Date.now();
              resetBaseRef.current = null;
              setState(prev => ({ ...prev, isDistracted: true, distractedSeconds: 0 }));
              confirmTimerRef.current = null;
            }, CONFIRM_DELAY_MS);
          }
        } else {
          // Back to focus
          distractedSinceRef.current = null;
          if (confirmTimerRef.current) {
            clearTimeout(confirmTimerRef.current);
            confirmTimerRef.current = null;
          }
          if (isConfirmedDistractedRef.current) {
            const awayMs = Date.now() - (distractedStartRef.current ?? Date.now());
            const awaySeconds = Math.floor(awayMs / 1000);
            totalDistractedRef.current += awaySeconds;
            isConfirmedDistractedRef.current = false;
            distractedStartRef.current = null;
            setState(prev => ({
              ...prev,
              isDistracted: false,
              distractedSeconds: awaySeconds,
              totalDistractedSeconds: totalDistractedRef.current,
            }));
          }
        }
      });

      faceMeshRef.current = faceMesh;

      // Update distractedSeconds counter while distracted
      intervalRef.current = setInterval(() => {
        if (isConfirmedDistractedRef.current && distractedStartRef.current) {
          const base = resetBaseRef.current ?? distractedStartRef.current;
          const seconds = Math.floor((Date.now() - base) / 1000);
          setState(prev => ({ ...prev, distractedSeconds: seconds }));
        }
      }, 1000);

      const camera = new Camera(hiddenVideo, {
        onFrame: async () => {
          if (faceMeshRef.current) {
            await faceMeshRef.current.send({ image: hiddenVideo });
          }
        },
        width: 320,
        height: 240,
      });

      cameraRef.current = camera;
      await camera.start();

      setState(prev => ({ ...prev, cameraReady: true, cameraError: null }));
    } catch (err: any) {
      // Camera permission denied or MediaPipe failed to load
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access to use focus detection.'
        : 'Could not start camera. Please check your browser permissions.';
      setState(prev => ({ ...prev, cameraError: msg, cameraReady: false }));
    }
  }, []);

  useEffect(() => {
    if (!isSessionActive) {
      stopCamera();
      // Reset distraction state between sessions
      isConfirmedDistractedRef.current = false;
      distractedStartRef.current = null;
      distractedSinceRef.current = null;
      totalDistractedRef.current = 0;
      resetBaseRef.current = null;
      setState({
        isDistracted: false,
        distractedSeconds: 0,
        totalDistractedSeconds: 0,
        cameraError: null,
        cameraReady: false,
        stream: null,
      });
      return;
    }

    startCamera();
    return () => { stopCamera(); };
  }, [isSessionActive, startCamera, stopCamera]);

  const resetDistracted = useCallback(() => {
    // If currently distracted, move the base forward so distractedSeconds restarts from 0
    if (isConfirmedDistractedRef.current && distractedStartRef.current !== null) {
      resetBaseRef.current = Date.now();
    }
    setState(prev => ({ ...prev, distractedSeconds: 0 }));
  }, []);

  return { ...state, resetDistracted, totalDistractedSeconds: totalDistractedRef.current };
}