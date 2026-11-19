import { useState } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Login() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const location = useLocation(); // get the current location to determine where to redirect after login

  if (loading) return null; // still checking for an existing session

  if (user) {
    const prevLocation = location.state?.from;
    const goToBooking = prevLocation?.state?.afterLogin === "booking";
    const returnState = prevLocation?.state
      ? { ...prevLocation.state, afterLogin: null }
      : undefined;
    return (
      <Navigate
        to={goToBooking ? "/booking" : "/"}
        replace
        state={goToBooking ? returnState : undefined}
      />
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="field-guide-search auth-page">
      <section className="field-guide-hero">
        <section className="auth-card">
          <h1>Login</h1>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={{ width: "100%", paddingRight: 44 }}
                required
              />
                <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#244c3d', cursor: 'pointer', padding: 6, display: 'flex' }}>
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c5 0 8.7 4 10 7a12 12 0 0 1-3.1 4.2"/><path d="M6.1 6.1A12.5 12.5 0 0 0 2 12c1.3 3 5 7 10 7 1.6 0 3-.4 4.3-1.1"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Logging in..." : "Login"}
            </button>
          </form>
          <p
            style={{ marginTop: "16px", fontSize: "0.875rem", textAlign: "center" }}
          >
            Don't have an account? <Link to="/register">Sign up here</Link>
          </p>
        </section>

        <div
          className="field-guide-landscape"
          aria-label="Illustrated mountain landscape"
        >
          <svg
            className="auth-landscape-svg"
            viewBox="0 0 600 430"
            preserveAspectRatio="xMidYMax slice"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="authSkyLogin" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d9e0d5" />
                <stop offset="48%" stopColor="#c6d2c4" />
                <stop offset="100%" stopColor="#a6b8a8" />
              </linearGradient>
            </defs>
            <rect width="600" height="430" fill="url(#authSkyLogin)" />
            <circle cx="360" cy="85" r="34" fill="#e9cda5" opacity="0.9" />
            <polygon
              points="0,260 100,140 180,220 260,90 340,210 430,120 520,200 600,150 600,430 0,430"
              fill="#829b8c"
              opacity="0.72"
            />
            <polygon
              points="0,320 90,200 170,280 260,160 350,260 440,180 520,260 600,220 600,430 0,430"
              fill="#587966"
            />
            <polygon
              points="0,380 110,290 200,350 300,260 390,340 480,280 560,340 600,320 600,430 0,430"
              fill="#355d48"
            />
            <polygon points="210,300 300,300 255,255" fill="#754f3d" />
            <rect x="220" y="300" width="70" height="55" fill="#d7c5a6" stroke="#3e5948" strokeWidth="4" />
            <rect x="235" y="330" width="16" height="25" fill="#6b806e" />
            <rect x="265" y="312" width="18" height="14" fill="#9ab1a1" stroke="#526b59" strokeWidth="2" />
          </svg>
          <div className="landscape-caption">ALPINE refuge · EST. 1,860 m</div>
          <div className="landscape-index">
            46° 03' N<br />
            07° 45' E
          </div>
        </div>
      </section>
    </div>
  );
}
