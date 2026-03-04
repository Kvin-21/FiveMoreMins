import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import Toast from './Toast';
import type { ImageRecord, PartnerStatus } from '../types';

export default function Settings() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const [image, setImage] = useState<ImageRecord | null>(null);
  const [partner, setPartner] = useState<PartnerStatus | null>(null);
  const [newPartnerEmail, setNewPartnerEmail] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    // Fetch current image and partner status in parallel
    api.get<{ image: ImageRecord | null }>('/api/images')
      .then(({ image: img }) => setImage(img))
      .catch(() => {});

    api.get<PartnerStatus>('/api/partner/status')
      .then(setPartner)
      .catch(() => {});
  }, [user]);

  function showToast(message: string, type: 'info' | 'success' | 'error' = 'info') {
    setToast({ message, type });
  }

  // ── Image ────────────────────────────────────────────────────────────────────

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleImageUpload() {
    if (!imageFile) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }
      const data = await res.json();
      setImage(data.image);
      setImageFile(null);
      setImagePreview(null);
      showToast('Image updated. Your future is now more at stake.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleImageDelete() {
    if (!image) return;
    try {
      await api.delete(`/api/images/${image.id}`);
      setImage(null);
      showToast('Image deleted. Living dangerously, are we?', 'info');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  }

  // ── Partner ──────────────────────────────────────────────────────────────────

  async function handlePartnerInvite() {
    if (!newPartnerEmail.trim()) return;
    setSaving(true);
    try {
      const result = await api.post<PartnerStatus>('/api/partner/invite', {
        partner_email: newPartnerEmail.trim(),
      });
      setPartner(result);
      setNewPartnerEmail('');
      showToast('Invite sent. They have no idea what they signed up for.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Invite failed.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRevokePartner() {
    try {
      await api.post('/api/partner/revoke');
      setPartner(null);
      showToast('Partner consent revoked. Going it alone, I see.', 'info');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Revoke failed.', 'error');
    }
  }

  // ── Account deletion ─────────────────────────────────────────────────────────

  async function handleDeleteAccount() {
    try {
      await api.delete('/api/account');
      logout();
      navigate('/');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  }

  if (loading || !user) return <div className="loading-spinner">Loading…</div>;

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Adjust your instruments of accountability.</p>

      {/* ── Image section ── */}
      <div className="settings-section">
        <div className="card">
          <h3>Blackmail Image</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            This gets emailed to your partner if you procrastinate long enough.
            Choose something motivating — for yourself.
          </p>

          {image && (
            <div style={{ marginBottom: '1rem' }}>
              <img
                src={`/uploads/${image.filename}`}
                alt="Current blackmail"
                className="image-preview"
              />
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  {image.original_name}
                </p>
                <button className="btn-danger" onClick={handleImageDelete} style={{ fontSize: '0.85rem' }}>
                  Delete image
                </button>
              </div>
            </div>
          )}

          <div>
            {imagePreview && (
              <img
                src={imagePreview}
                alt="New image preview"
                className="image-preview"
                style={{ marginBottom: '0.75rem' }}
              />
            )}
            <label htmlFor="new-image" className="image-drop-area" style={{ display: 'block', marginBottom: '0.75rem' }}>
              {imageFile ? imageFile.name : (image ? 'Upload a replacement' : 'Upload an image')}
            </label>
            <input
              id="new-image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
            {imageFile && (
              <button className="btn-primary" onClick={handleImageUpload} disabled={saving}>
                {saving ? 'Uploading…' : 'Save image'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Partner section ── */}
      <div className="settings-section">
        <div className="card">
          <h3>Accountability Partner</h3>

          {partner?.partner_email && !partner.revoked_at ? (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Your partner: <strong style={{ color: 'var(--text-primary)' }}>{partner.partner_email}</strong>
                <br />
                {partner.consented_at
                  ? `They consented on ${new Date(partner.consented_at * 1000).toLocaleDateString()}.`
                  : 'Consent pending.'}
              </p>
              <button className="btn-danger" onClick={handleRevokePartner}>
                Revoke consent
              </button>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                {partner?.invite_token
                  ? 'Invite sent — waiting for them to accept the terms of their suffering.'
                  : 'No partner set. Add one to make this feel more real.'}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" htmlFor="partner-email">Partner email</label>
                  <input
                    id="partner-email"
                    type="email"
                    placeholder="partner@example.com"
                    value={newPartnerEmail}
                    onChange={(e) => setNewPartnerEmail(e.target.value)}
                  />
                </div>
                <button
                  className="btn-primary"
                  onClick={handlePartnerInvite}
                  disabled={saving || !newPartnerEmail.trim()}
                  style={{ flexShrink: 0 }}
                >
                  {saving ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Escalation messages info ── */}
      <div className="settings-section">
        <div className="card">
          <h3>Roast Messages</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Messages are selected automatically based on how long you've been away:
          </p>
          <ul style={{ marginTop: '0.75rem', paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '2' }}>
            <li><strong style={{ color: 'var(--warning)' }}>5 min</strong> — Mild disappointment</li>
            <li><strong style={{ color: 'var(--warning)' }}>15 min</strong> — Moderate judgment</li>
            <li><strong style={{ color: 'var(--danger)' }}>30 min</strong> — Full contempt mode + penalty trigger</li>
          </ul>
          <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Custom message support coming soon. Or not. We enjoy having this power over you.
          </p>
        </div>
      </div>

      {/* ── Danger zone ── */}
      <div className="settings-section">
        <div className="danger-zone">
          <h3>Danger Zone</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Deleting your account is permanent. All sessions, your image, and partner links will be
            removed. This won't fix your procrastination problem, just so you know.
          </p>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleDeleteAccount}>
                Yes, delete everything
              </button>
            </div>
          ) : (
            <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
              Delete my account
            </button>
          )}
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
