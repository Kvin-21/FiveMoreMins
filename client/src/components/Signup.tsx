import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types';

type Step = 'email' | 'image' | 'partner';

export default function Signup() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { login } = useAuth();

  const steps: Step[] = ['email', 'image', 'partner'];
  const stepIndex = steps.indexOf(step);

  // ── Step 1: Request magic link ─────────────────
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.post<{ user: User }>('/api/signup', { email: email.trim() });
      setEmailSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Upload blackmail image ─────────────
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleImageUpload() {
    if (!imageFile) {
      // Image is optional — they can always do this in settings
      setStep('partner');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      await fetch('/api/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Upload failed.');
        }
      });
      setStep('partner');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Partner email ──────────────────────
  async function handlePartnerSubmit(skip = false) {
    if (!skip && partnerEmail.trim()) {
      setLoading(true);
      setError('');
      try {
        await api.post('/api/partner/invite', { partner_email: partnerEmail.trim() });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not invite partner.');
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    navigate('/focus');
  }

  // After magic link is sent, simulate a "logged in" flow by checking /api/me
  // In real use the user clicks the link and is redirected — this step just tells them what to do
  async function handleContinueAfterEmail() {
    // Try to fetch session in case they've already clicked the link in another tab
    try {
      const user = await api.get<User>('/api/me');
      login(user);
      setStep('image');
    } catch {
      setError("Looks like you haven't clicked your link yet. Check your inbox!");
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Step indicator */}
        <div className="step-indicator">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`step-dot ${i <= stepIndex ? 'active' : ''}`}
            />
          ))}
        </div>

        {/* ── Step 1 ── */}
        {step === 'email' && (
          <>
            <h1 className="auth-title">Let's set you up.</h1>
            <p className="auth-subtitle">
              Enter your email. We'll send you a magic link — no password required.
              After all, you have enough things to forget.
            </p>

            {emailSent ? (
              <>
                <div className="auth-success mb-2">
                  ✉️ Check your email. Link sent.<br />
                  Once you've clicked it, come back and hit continue.
                </div>
                {error && <p className="error-text mb-2">{error}</p>}
                <button className="btn-primary mt-2" style={{ width: '100%' }} onClick={handleContinueAfterEmail}>
                  I clicked the link →
                </button>
              </>
            ) : (
              <form className="auth-form" onSubmit={handleEmailSubmit}>
                <div>
                  <label className="form-label" htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {error && <p className="error-text">{error}</p>}
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Sending…' : 'Send magic link'}
                </button>
              </form>
            )}
          </>
        )}

        {/* ── Step 2 ── */}
        {step === 'image' && (
          <>
            <h1 className="auth-title">Upload your collateral.</h1>
            <p className="auth-subtitle">
              This is the image we send to your accountability partner if you procrastinate
              too hard. Choose wisely. Something embarrassing works best — that's the point.
            </p>

            <label htmlFor="image-upload" className="image-drop-area" style={{ display: 'block' }}>
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain' }}
                />
              ) : (
                <>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📎</div>
                  <div>Click to upload an image</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>JPG, PNG, GIF — max 10MB</div>
                </>
              )}
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />

            {error && <p className="error-text mt-1">{error}</p>}

            <div className="flex gap-1 mt-2" style={{ marginTop: '1rem' }}>
              <button
                className="btn-secondary"
                onClick={() => setStep('partner')}
                style={{ flex: 1 }}
              >
                Skip for now
              </button>
              <button
                className="btn-primary"
                onClick={handleImageUpload}
                disabled={loading}
                style={{ flex: 2 }}
              >
                {loading ? 'Uploading…' : imageFile ? 'Upload & continue →' : 'Continue →'}
              </button>
            </div>
          </>
        )}

        {/* ── Step 3 ── */}
        {step === 'partner' && (
          <>
            <h1 className="auth-title">Who's watching you?</h1>
            <p className="auth-subtitle">
              Add an accountability partner's email. If you ignore the warnings long enough,
              they'll receive a nice email — with your image. Totally optional. (But also,
              does not having one explain your productivity history?)
            </p>

            <div className="auth-form">
              <div>
                <label className="form-label" htmlFor="partner">Partner email (optional)</label>
                <input
                  id="partner"
                  type="email"
                  placeholder="partner@example.com"
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                />
              </div>
              {error && <p className="error-text">{error}</p>}
              <div className="flex gap-1">
                <button
                  className="btn-secondary"
                  onClick={() => handlePartnerSubmit(true)}
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  Skip
                </button>
                <button
                  className="btn-primary"
                  onClick={() => handlePartnerSubmit(false)}
                  style={{ flex: 2 }}
                  disabled={loading}
                >
                  {loading ? 'Saving…' : "Let's go 🔥"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
