import { useEffect, useRef } from 'react';

interface WarningModalProps {
  tier: 'mild' | 'medium' | 'aggressive';
  message: string;
  awayMinutes: number;
  partnerEmail?: string;
  penaltySent: boolean;
  onDismiss: () => void;
}

export default function WarningModal({
  tier,
  message,
  awayMinutes,
  partnerEmail,
  penaltySent,
  onDismiss,
}: WarningModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Trap focus inside modal
  useEffect(() => {
    const el = modalRef.current?.querySelector('button');
    el?.focus();
  }, []);

  const tierConfig = {
    mild: {
      icon: '😒',
      title: 'Really?',
      btnText: 'Fine, I\'ll work',
      className: 'modal-mild',
    },
    medium: {
      icon: '😤',
      title: 'You\'ve Done It Now',
      btnText: 'I deserve this lecture',
      className: 'modal-medium',
    },
    aggressive: {
      icon: '💀',
      title: 'CONSEQUENCES ACTIVATED',
      btnText: 'I understand I have failed',
      className: 'modal-aggressive',
    },
  };

  const config = tierConfig[tier];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div
        ref={modalRef}
        className={`warning-modal ${config.className} shake-anim`}
      >
        <div className="modal-icon">{config.icon}</div>
        <h2 className="modal-title">{config.title}</h2>

        <div className="modal-away-time">
          <span className="away-label">TIME WASTED</span>
          <span className="away-value">{awayMinutes} minutes</span>
        </div>

        <p className="modal-message">{message}</p>

        {tier === 'aggressive' && penaltySent && partnerEmail && (
          <div className="penalty-notice">
            <div className="penalty-icon">⚠️</div>
            <p className="penalty-text">
              YOUR IMAGE HAS BEEN SENT TO{' '}
              <strong>{partnerEmail}</strong>
            </p>
            <p className="penalty-subtext">
              Your accountability partner now knows about your failure. Congrats.
            </p>
          </div>
        )}

        {tier === 'aggressive' && !penaltySent && (
          <div className="penalty-notice penalty-sending">
            <div className="penalty-icon">📤</div>
            <p className="penalty-text">Sending your image to {partnerEmail || 'your partner'}...</p>
          </div>
        )}

        <button className="modal-dismiss-btn" onClick={onDismiss}>
          {config.btnText}
        </button>
      </div>
    </div>
  );
}
