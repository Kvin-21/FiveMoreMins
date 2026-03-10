import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

// Where we store training samples and the trained model output
const TRAIN_DIR = path.join(__dirname, '..', '..', 'training_data');
const MODEL_PATH = path.join(__dirname, '..', '..', 'trained_model.json');

// Make sure training dir exists
if (!fs.existsSync(TRAIN_DIR)) {
  fs.mkdirSync(TRAIN_DIR, { recursive: true });
}

// POST /train/sample - save a labelled feature vector from the browser
router.post('/sample', (req: Request, res: Response) => {
  const { label, features } = req.body;

  if (!label || !features || !Array.isArray(features)) {
    return res.status(400).json({ error: 'label and features[] are required' });
  }

  if (label !== 'focused' && label !== 'distracted') {
    return res.status(400).json({ error: 'label must be focused or distracted' });
  }

  // Append sample to a JSONL file - one sample per line, easy to read back
  const line = JSON.stringify({ label, features, ts: Date.now() }) + '\n';
  fs.appendFileSync(path.join(TRAIN_DIR, 'samples.jsonl'), line);

  return res.json({ success: true });
});

// POST /train/build - compute per-class means and threshold from saved samples
router.post('/build', (_req: Request, res: Response) => {
  const samplesPath = path.join(TRAIN_DIR, 'samples.jsonl');

  if (!fs.existsSync(samplesPath)) {
    return res.status(400).json({ error: 'No training samples found. Collect some first.' });
  }

  const lines = fs.readFileSync(samplesPath, 'utf8').trim().split('\n').filter(Boolean);
  const samples = lines.map(l => JSON.parse(l) as { label: string; features: number[] });

  const focused = samples.filter(s => s.label === 'focused');
  const distracted = samples.filter(s => s.label === 'distracted');

  if (focused.length < 5 || distracted.length < 5) {
    return res.status(400).json({
      error: `Need at least 5 samples per class. Have ${focused.length} focused, ${distracted.length} distracted.`
    });
  }

  // Compute centroid (mean feature vector) for each class
  const dim = samples[0].features.length;

  const mean = (arr: number[][]): number[] => {
    const out = new Array(dim).fill(0);
    for (const v of arr) v.forEach((x, i) => { out[i] += x; });
    return out.map(x => x / arr.length);
  };

  const focusedMean = mean(focused.map(s => s.features));
  const distractedMean = mean(distracted.map(s => s.features));

  // Euclidean distance helper
  const dist = (a: number[], b: number[]) =>
    Math.sqrt(a.reduce((sum, x, i) => sum + (x - b[i]) ** 2, 0));

  // Store both centroids; at runtime we do nearest-centroid classification
  const model = {
    focusedMean,
    distractedMean,
    focusedCount: focused.length,
    distractedCount: distracted.length,
    builtAt: new Date().toISOString(),
    // Inter-centroid distance for reference
    centroidDist: dist(focusedMean, distractedMean),
  };

  fs.writeFileSync(MODEL_PATH, JSON.stringify(model, null, 2));

  return res.json({
    success: true,
    focusedCount: focused.length,
    distractedCount: distracted.length,
    centroidDist: model.centroidDist,
    message: 'Model trained and saved. The camera will use your personal model from now on.',
  });
});

// GET /train/model - frontend fetches this to load the trained model at session start
router.get('/model', (_req: Request, res: Response) => {
  if (!fs.existsSync(MODEL_PATH)) {
    return res.json({ exists: false });
  }

  const model = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
  return res.json({ exists: true, ...model });
});

// DELETE /train/reset - wipe all samples and the trained model
router.delete('/reset', (_req: Request, res: Response) => {
  const samplesPath = path.join(TRAIN_DIR, 'samples.jsonl');
  if (fs.existsSync(samplesPath)) fs.unlinkSync(samplesPath);
  if (fs.existsSync(MODEL_PATH)) fs.unlinkSync(MODEL_PATH);
  return res.json({ success: true, message: 'Training data wiped. Starting fresh.' });
});

// GET /train/status - how many samples collected so far
router.get('/status', (_req: Request, res: Response) => {
  const samplesPath = path.join(TRAIN_DIR, 'samples.jsonl');

  if (!fs.existsSync(samplesPath)) {
    return res.json({ focused: 0, distracted: 0, modelExists: fs.existsSync(MODEL_PATH) });
  }

  const lines = fs.readFileSync(samplesPath, 'utf8').trim().split('\n').filter(Boolean);
  const samples = lines.map(l => JSON.parse(l) as { label: string });
  const focused = samples.filter(s => s.label === 'focused').length;
  const distracted = samples.filter(s => s.label === 'distracted').length;

  return res.json({ focused, distracted, modelExists: fs.existsSync(MODEL_PATH) });
});

// GET /train - serve the training UI page
// MediaPipe CDN builds are UMD/IIFE scripts — they must be loaded via <script> tags,
// not ES module import(). They attach to window.FaceMesh and window.Camera.
router.get('/', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FiveMoreMins — Train Your Model</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; color: #e0e0e0; font-family: 'Courier New', monospace; padding: 24px; min-height: 100vh; }
  h1 { color: #ff3333; font-size: 1.6rem; margin-bottom: 4px; }
  .sub { color: #666; font-size: 0.85rem; margin-bottom: 24px; }
  .layout { display: flex; gap: 24px; flex-wrap: wrap; }
  .panel { flex: 1; min-width: 280px; background: #141414; border: 1px solid #222; border-radius: 8px; padding: 20px; }
  h2 { font-size: 1rem; color: #aaa; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px; border-bottom: 1px solid #222; padding-bottom: 8px; }
  video { width: 100%; border-radius: 6px; background: #000; display: block; transform: scaleX(-1); }
  canvas { display: none; }
  .status { font-size: 0.8rem; color: #666; margin-top: 8px; min-height: 20px; text-align: center; }
  .status.ok { color: #00ff88; }
  .status.bad { color: #ff3333; }
  .btns { display: flex; gap: 8px; margin-top: 12px; }
  button { flex: 1; padding: 10px; border: none; border-radius: 6px; font-family: inherit; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.15s; }
  .btn-focused { background: rgba(0,255,136,0.15); color: #00ff88; border: 1px solid rgba(0,255,136,0.4); }
  .btn-focused:hover { background: rgba(0,255,136,0.25); }
  .btn-distracted { background: rgba(255,51,51,0.15); color: #ff3333; border: 1px solid rgba(255,51,51,0.4); }
  .btn-distracted:hover { background: rgba(255,51,51,0.25); }
  .btn-build { background: #ff3333; color: white; width: 100%; padding: 12px; margin-top: 12px; font-size: 1rem; }
  .btn-build:hover { background: #cc0000; }
  .btn-reset { background: transparent; color: #666; border: 1px solid #333; width: 100%; padding: 8px; margin-top: 8px; font-size: 0.8rem; }
  .btn-reset:hover { border-color: #ff3333; color: #ff3333; }
  .counts { display: flex; gap: 12px; margin-top: 12px; }
  .count-box { flex: 1; text-align: center; padding: 12px; background: #1a1a1a; border-radius: 6px; }
  .count-num { font-size: 2rem; font-weight: 700; display: block; }
  .count-focused .count-num { color: #00ff88; }
  .count-distracted .count-num { color: #ff3333; }
  .count-label { font-size: 0.7rem; color: #666; text-transform: uppercase; letter-spacing: 0.1em; }
  .log { margin-top: 12px; max-height: 160px; overflow-y: auto; font-size: 0.75rem; color: #555; }
  .log div { padding: 3px 0; border-bottom: 1px solid #1a1a1a; }
  .log .ok { color: #00ff88; }
  .log .err { color: #ff3333; }
  .instructions { background: rgba(255,107,53,0.06); border: 1px solid rgba(255,107,53,0.2); border-radius: 6px; padding: 14px; margin-bottom: 20px; }
  .instructions p { font-size: 0.82rem; color: #aaa; line-height: 1.7; }
  .instructions strong { color: #ff6b35; }
  .burst-indicator { text-align: center; font-size: 2rem; min-height: 48px; margin: 8px 0; letter-spacing: 2px; }
  #modelStatus { padding: 12px; border-radius: 6px; text-align: center; font-size: 0.85rem; margin-top: 12px; }
  .model-ok { background: rgba(0,255,136,0.08); border: 1px solid rgba(0,255,136,0.3); color: #00ff88; }
  .model-none { background: rgba(255,255,255,0.04); border: 1px solid #222; color: #666; }
  #faceIndicator { text-align: center; font-size: 0.75rem; margin-top: 6px; min-height: 18px; }
  .face-yes { color: #00ff88; }
  .face-no { color: #ff3333; }
</style>
</head>
<body>
<h1>🎯 Train Your Personal Model</h1>
<p class="sub">Your personal detector, tuned to your face and setup.</p>

<div class="instructions">
  <p>
    <strong>How it works:</strong> Sit naturally in front of your webcam and look at the screen. Press <strong>✅ I'm Focused</strong> to capture 10 rapid shots of you working normally.
    Then pick up your phone and look down at it — press <strong>📵 Procrastinating</strong> to capture 10 shots of that pose.
    Repeat a few times from different angles. When you have 20+ samples of each, hit <strong>⚡ Build Model</strong>.
    Done — your focus sessions will use your personal model instead of the generic detector.
  </p>
</div>

<div class="layout">
  <div class="panel">
    <h2>📷 Camera</h2>
    <video id="video" autoplay playsinline muted></video>
    <canvas id="canvas" width="320" height="240"></canvas>
    <div id="faceIndicator">Waiting for camera...</div>
    <div class="burst-indicator" id="burstIndicator"></div>
    <div class="status" id="camStatus">Loading MediaPipe...</div>
    <div class="btns">
      <button class="btn-focused" onclick="capture('focused')" id="btnFocused" disabled>✅ I'm Focused</button>
      <button class="btn-distracted" onclick="capture('distracted')" id="btnDistracted" disabled>📵 Procrastinating</button>
    </div>
  </div>

  <div class="panel">
    <h2>📊 Training Data</h2>
    <div class="counts">
      <div class="count-box count-focused">
        <span class="count-num" id="countFocused">0</span>
        <span class="count-label">Focused</span>
      </div>
      <div class="count-box count-distracted">
        <span class="count-num" id="countDistracted">0</span>
        <span class="count-label">Distracted</span>
      </div>
    </div>

    <div id="modelStatus" class="model-none">No model trained yet</div>

    <button class="btn-build" onclick="buildModel()" id="btnBuild">⚡ Build Model</button>
    <button class="btn-reset" onclick="resetData()">🗑 Wipe All Training Data</button>

    <div class="log" id="log"></div>
  </div>
</div>

<!-- MediaPipe must be loaded as plain <script> tags — they are UMD builds, not ES modules -->
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js" crossorigin="anonymous"></script>

<script>
  var lastFeatures = null;
  var capturing = false;
  var faceMeshReady = false;

  var video = document.getElementById('video');
  var camStatus = document.getElementById('camStatus');
  var burstIndicator = document.getElementById('burstIndicator');
  var faceIndicator = document.getElementById('faceIndicator');
  var logEl = document.getElementById('log');

  function log(msg, cls) {
    var d = document.createElement('div');
    d.textContent = new Date().toLocaleTimeString() + ' — ' + msg;
    if (cls) d.className = cls;
    logEl.prepend(d);
  }

  function updateCounts() {
    fetch('/train/status').then(function(r) { return r.json(); }).then(function(d) {
      document.getElementById('countFocused').textContent = d.focused;
      document.getElementById('countDistracted').textContent = d.distracted;
      var ms = document.getElementById('modelStatus');
      if (d.modelExists) {
        ms.textContent = '✅ Trained model active — focus sessions are using it';
        ms.className = 'model-ok';
      } else {
        ms.textContent = 'No model trained yet';
        ms.className = 'model-none';
      }
    });
  }

  // Extract the same 10-feature vector used in useFaceDetection
  function extractFeatures(landmarks) {
    var nose = landmarks[1];
    var chin = landmarks[152];
    var leftEyeOuter = landmarks[33];
    var rightEyeOuter = landmarks[263];
    var foreheadTop = landmarks[10];

    var headTilt = chin.y - nose.y;
    var eyeMidY = (leftEyeOuter.y + rightEyeOuter.y) / 2;
    var faceHeightRatio = chin.y - foreheadTop.y;
    var eyeSpread = Math.abs(rightEyeOuter.x - leftEyeOuter.x);
    var noseToEyeMid = nose.y - eyeMidY;
    var chinZ = chin.z;
    var noseZ = nose.z;
    var headRoll = leftEyeOuter.y - rightEyeOuter.y;

    var leftGazeDelta = 0;
    var rightGazeDelta = 0;
    if (landmarks[468] && landmarks[473]) {
      var leftIris = landmarks[468];
      var rightIris = landmarks[473];
      var leftUpperLid = landmarks[159];
      var leftLowerLid = landmarks[145];
      var rightUpperLid = landmarks[386];
      var rightLowerLid = landmarks[374];
      var leftEyeCentreY = (leftUpperLid.y + leftLowerLid.y) / 2;
      var rightEyeCentreY = (rightUpperLid.y + rightLowerLid.y) / 2;
      leftGazeDelta = leftIris.y - leftEyeCentreY;
      rightGazeDelta = rightIris.y - rightEyeCentreY;
    }

    return [
      headTilt,
      eyeMidY,
      faceHeightRatio,
      eyeSpread,
      noseToEyeMid,
      chinZ,
      noseZ,
      headRoll,
      leftGazeDelta,
      rightGazeDelta
    ];
  }

  function init() {
    // FaceMesh is available on window after the <script> tag loads
    if (typeof FaceMesh === 'undefined' || typeof Camera === 'undefined') {
      camStatus.textContent = '⚠ MediaPipe failed to load. Check your internet connection.';
      camStatus.className = 'status bad';
      log('MediaPipe not on window — script tags may have failed to load', 'err');
      return;
    }

    var fm = new FaceMesh({
      locateFile: function(f) {
        return 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/' + f;
      }
    });

    fm.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });

    fm.onResults(function(results) {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        lastFeatures = extractFeatures(results.multiFaceLandmarks[0]);
        faceIndicator.textContent = '✅ Face detected';
        faceIndicator.className = 'face-yes';
      } else {
        lastFeatures = null;
        faceIndicator.textContent = '❌ No face — move into frame';
        faceIndicator.className = 'face-no';
      }
    });

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } })
      .then(function(stream) {
        video.srcObject = stream;

        var cam = new Camera(video, {
          onFrame: function() {
            return fm.send({ image: video });
          },
          width: 320,
          height: 240
        });

        cam.start().then(function() {
          faceMeshReady = true;
          document.getElementById('btnFocused').disabled = false;
          document.getElementById('btnDistracted').disabled = false;
          camStatus.textContent = '✅ Camera ready — face detection active';
          camStatus.className = 'status ok';
          log('Camera and MediaPipe ready', 'ok');
          updateCounts();
        }).catch(function(e) {
          camStatus.textContent = '⚠ Camera start failed: ' + e.message;
          camStatus.className = 'status bad';
          log('Camera start error: ' + e, 'err');
        });
      })
      .catch(function(e) {
        var msg = e.name === 'NotAllowedError'
          ? 'Camera permission denied — allow camera access in your browser'
          : 'Could not access camera: ' + e.message;
        camStatus.textContent = '⚠ ' + msg;
        camStatus.className = 'status bad';
        log('getUserMedia error: ' + e, 'err');
      });
  }

  // Capture 10 shots in a burst with 200ms gaps — more variety per button press
  function capture(label) {
    if (capturing || !faceMeshReady) return;
    capturing = true;
    var BURST = 10;
    var btn = label === 'focused'
      ? document.getElementById('btnFocused')
      : document.getElementById('btnDistracted');
    btn.disabled = true;

    var saved = 0;
    var i = 0;

    function doShot() {
      if (i >= BURST) {
        burstIndicator.textContent = '';
        btn.disabled = false;
        capturing = false;
        log('Saved ' + saved + '/' + BURST + ' ' + label + ' samples', saved > 0 ? 'ok' : 'err');
        updateCounts();
        return;
      }

      burstIndicator.textContent = (label === 'focused' ? '✅' : '📵').repeat(i + 1);

      setTimeout(function() {
        if (!lastFeatures) {
          log('No face on frame ' + (i + 1) + ', skipping', 'err');
          i++;
          doShot();
          return;
        }

        fetch('/train/sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: label, features: lastFeatures })
        }).then(function(r) {
          if (r.ok) saved++;
          i++;
          doShot();
        }).catch(function(e) {
          log('Failed to save sample: ' + e, 'err');
          i++;
          doShot();
        });
      }, 200);
    }

    doShot();
  }

  function buildModel() {
    var btn = document.getElementById('btnBuild');
    btn.disabled = true;
    btn.textContent = 'Building...';

    fetch('/train/build', { method: 'POST' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) {
          log('Model built! ' + d.focusedCount + ' focused + ' + d.distractedCount + ' distracted. Centroid dist: ' + d.centroidDist.toFixed(4), 'ok');
        } else {
          log('Build failed: ' + d.error, 'err');
        }
        btn.disabled = false;
        btn.textContent = '⚡ Build Model';
        updateCounts();
      })
      .catch(function(e) {
        log('Build request failed: ' + e, 'err');
        btn.disabled = false;
        btn.textContent = '⚡ Build Model';
      });
  }

  function resetData() {
    if (!confirm('Wipe ALL training data and the trained model?')) return;
    fetch('/train/reset', { method: 'DELETE' })
      .then(function() {
        log('All training data wiped.', 'err');
        updateCounts();
      });
  }

  // Wait for MediaPipe scripts to fully execute before calling init
  window.addEventListener('load', function() {
    // Small delay to ensure UMD globals are registered
    setTimeout(init, 300);
  });
</script>
</body>
</html>`);
});

export default router;