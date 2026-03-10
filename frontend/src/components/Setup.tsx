import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { signup, login, uploadImage } from '../utils/api';
import Toast from './Toast';

interface SetupProps {
  onLogin: (token: string, user: { id: number; email: string; partner_email: string; image_path: string }) => void;
}

export default function Setup({ onLogin }: SetupProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Toggle between signup (new user) and login (returning user)
  const [mode, setMode] = useState<'signup' | 'login'>('signup');

  const [email, setEmail] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setToast({ message: 'Only image files please', type: 'error' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setToast({ message: 'File too large (max 10MB)', type: 'error' });
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) return setToast({ message: 'Enter your email', type: 'error' });

    if (mode === 'signup') {
      if (!partnerEmail) return setToast({ message: "Enter your partner's email", type: 'error' });
      if (email === partnerEmail) return setToast({ message: "Your partner can't be yourself (or can it?)", type: 'error' });
      if (!imageFile) return setToast({ message: 'Upload an embarrassing photo — that\'s the whole point', type: 'error' });
      if (!consent) return setToast({ message: 'You need to check the consent box', type: 'error' });
    } else {
      if (!partnerEmail) return setToast({ message: "Enter your partner's email", type: 'error' });
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        // Returning user — just look them up
        const { token, user } = await login(email);
        onLogin(token, user);
        navigate('/focus');
        return;
      }

      // Create/login user
      const { token, user } = await signup(email, partnerEmail);
      localStorage.setItem('fmm_token', token);
      localStorage.setItem('fmm_user', JSON.stringify(user));

      // Upload image if provided
      if (imageFile) {
        try {
          const uploadData = await uploadImage(imageFile);
          if (uploadData.success) {
            user.image_path = uploadData.imagePath;
          }
        } catch {
          // Image upload failure is non-fatal — session still works without it
          console.warn('Image upload failed, continuing without image');
        }
      }

      onLogin(token, user);
      navigate('/focus');
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Something went wrong', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="setup-container">
        <h2 className="setup-title">Configure Your Doom</h2>
        <p className="setup-subtitle">Set up your accountability trap. No take-backs.</p>

        {/* Mode toggle */}
        <div className="setup-mode-toggle">
          <button
            type="button"
            className={`mode-btn ${mode === 'signup' ? 'mode-btn-active' : ''}`}
            onClick={() => setMode('signup')}
          >
            New Setup
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === 'login' ? 'mode-btn-active' : ''}`}
            onClick={() => setMode('login')}
          >
            Login
          </button>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">
          {/* Your email */}
          <div className="form-group">
            <label className="form-label">Your Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <span className="form-hint">We identify you by this. No passwords needed.</span>
          </div>

          {/* Partner email */}
          <div className="form-group">
            <label className="form-label">
              Accountability Partner's Email
              <span className="label-danger"> ⚠ They get the photo</span>
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="partner@example.com"
              value={partnerEmail}
              onChange={e => setPartnerEmail(e.target.value)}
              required
            />
            <span className="form-hint">Choose someone who will judge you. Choose wisely.</span>
          </div>

          {/* Image upload — only on signup, and now compulsory */}
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label">
                Embarrassing Photo
                <span className="label-danger"> ⚠ Required</span>
              </label>
              <div
                ref={dropZoneRef}
                className={`drop-zone ${isDragging ? 'dragging' : ''} ${imagePreview ? 'has-image' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="image-preview-container">
                    <img src={imagePreview} alt="Preview" className="image-preview" />
                    <div className="image-preview-overlay">
                      <span>Click to change</span>
                    </div>
                  </div>
                ) : (
                  <div className="drop-zone-content">
                    <span className="drop-icon">📷</span>
                    <p>Drop your photo here or click to browse</p>
                    <p className="drop-hint">JPG, PNG, GIF — Max 10MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden-input"
                onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>
          )}

          {/* Consent checkbox — only on signup */}
          {mode === 'signup' && (
            <div className="form-group consent-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  className="checkbox-input"
                />
                <span className="checkbox-custom"></span>
                <span className="checkbox-text">
                  I understand that if I look at my phone for 30+ minutes during a focus session, my uploaded image
                  will be sent to my accountability partner. This is consensual and for motivational purposes.
                </span>
              </label>
            </div>
          )}

          <button
            type="submit"
            className={`btn-primary btn-full ${loading ? 'btn-loading' : ''}`}
            disabled={loading}
          >
            {loading ? 'Setting up...' : mode === 'login' ? 'Login →' : "Let's Begin ☠️"}
          </button>
        </form>
      </div>
    </div>
  );
}