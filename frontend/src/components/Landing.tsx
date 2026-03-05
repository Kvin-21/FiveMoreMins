import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Landing page - first thing users see. Make it scary. Make it compelling.
export default function Landing() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(1337); // fake hype countdown

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 0) return 1337;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <div className="landing">
      {/* Background ambient countdown */}
      <div className="ambient-timer" aria-hidden="true">
        {formatCountdown(countdown)}
      </div>

      <div className="landing-content">
        <div className="landing-badge">⚠ ANTI-PROCRASTINATION SYSTEM</div>

        <h1 className="landing-title">
          Five<span className="title-accent">More</span>Mins
        </h1>

        <p className="landing-subtitle">
          The anti-procrastination app that <em>fights dirty</em>
        </p>

        <div className="how-it-works">
          <div className="step">
            <span className="step-num">01</span>
            <p>Upload an embarrassing photo</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <span className="step-num">02</span>
            <p>Enter your accountability partner's email</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <span className="step-num">03</span>
            <p>Start your focus session</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <span className="step-num">04</span>
            <p className="step-danger">Leave for 30 min? 💀 Photo gets sent.</p>
          </div>
        </div>

        <div className="threat-box">
          <p>
            We're not playing around. If you procrastinate for <strong>30+ minutes</strong>,
            your embarrassing photo gets sent to whoever you chose. No warnings.
            No second chances. <strong>Consequences.</strong>
          </p>
        </div>

        <button
          className="btn-primary btn-huge pulse-btn"
          onClick={() => navigate('/setup')}
        >
          I Accept the Risk →
        </button>

        <p className="landing-disclaimer">
          By proceeding, you acknowledge this is a student project and no actual malicious activity occurs.
          The "blackmail" is consensual and for fun (sort of). Your partner gives consent too.
        </p>
      </div>
    </div>
  );
}
