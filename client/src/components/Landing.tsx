import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  function handleCTA() {
    navigate(user ? '/focus' : '/signup');
  }

  return (
    <div>
      {/* Hero */}
      <section className="landing-hero">
        <h1 className="landing-headline">
          Stop Scrolling.<br />
          Start Working.<br />
          <span>Or Else.</span>
        </h1>
        <p className="landing-sub">
          FiveMoreMins watches your tab like a disappointed parent. Switch away for too long
          and you'll get increasingly aggressive roasts. Keep ignoring us, and your
          "accountabilibuddy" receives a very special email. You uploaded the image.
          You knew what you signed up for.
        </p>
        <button className="btn-primary" onClick={handleCTA} style={{ fontSize: '1.05rem', padding: '0.8rem 2rem' }}>
          {user ? 'Back to Focus Mode' : 'Start Suffering Productively'}
        </button>
      </section>

      {/* Features */}
      <div className="landing-features">
        <div className="feature-card">
          <div className="feature-card-icon">👁️</div>
          <h3>Tab Detection</h3>
          <p>
            The moment you switch tabs, we know. The moment you come back, we remember.
            Nothing slips past us.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-card-icon">🔥</div>
          <h3>Escalating Roasts</h3>
          <p>
            Five minutes: mild disappointment. Fifteen: moderate judgment. Thirty minutes:
            pure, unfiltered contempt delivered via modal you can't ignore.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-card-icon">🕵️</div>
          <h3>Blackmail Mode</h3>
          <p>
            Upload an image. Add your accountability partner's email. Now your procrastination
            has consequences. Real ones. We don't make threats; we automate them.
          </p>
        </div>
      </div>

      <p className="landing-footer-text">
        No refunds. No sympathy. Just results.<br />
        (Results not guaranteed. Judgment definitely is.)
      </p>
    </div>
  );
}
