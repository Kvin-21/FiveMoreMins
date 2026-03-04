import type { EscalationLevel } from '../data/messages';

interface SnarkyModalProps {
  level: EscalationLevel;
  message: string;
  awayMinutes: number;
  onClose: () => void;
  onAcknowledge: () => void;
}

const levelConfig: Record<EscalationLevel, { label: string; color: string; bg: string }> = {
  mild: {
    label: '😐 Mild Disappointment',
    color: '#eab308',
    bg: '#1a1500',
  },
  medium: {
    label: '😤 Moderate Judgment',
    color: '#f97316',
    bg: '#1a0d00',
  },
  aggressive: {
    label: '🚨 Full Contempt Mode',
    color: '#ef4444',
    bg: '#1a0000',
  },
};

export default function SnarkyModal({
  level,
  message,
  awayMinutes,
  onClose,
  onAcknowledge,
}: SnarkyModalProps) {
  const config = levelConfig[level];

  return (
    <div className="modal-overlay" onClick={onClose}>
      {/* Stop click-through on the box itself */}
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div
          className="modal-level-badge"
          style={{ background: config.bg, color: config.color, border: `1px solid ${config.color}44` }}
        >
          {config.label}
        </div>

        <p className="modal-message">"{message}"</p>

        <p className="modal-away-time">
          You've been away for approximately <strong>{Math.round(awayMinutes)} minute{awayMinutes !== 1 ? 's' : ''}</strong>.
        </p>

        {level === 'aggressive' && (
          <div className="modal-warning">
            ⚠️ <strong>Penalty triggered.</strong> If you have an accountability partner set up,
            they may receive an email shortly. You did this to yourself.
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Dismiss
          </button>
          <button
            className="btn-primary"
            onClick={onAcknowledge}
            style={{ background: config.color }}
          >
            I know, I know. Get back to work.
          </button>
        </div>
      </div>
    </div>
  );
}
