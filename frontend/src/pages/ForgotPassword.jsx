import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import AuthLandscape from "../components/AuthLandscape.jsx";

// MH-07: password recovery via email. The backend always answers 200,
// so the page shows the same generic message whether the account exists or not.
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
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
          <span className="field-guide-kicker">
            <span aria-hidden="true" /> PASSWORD RECOVERY
          </span>
          <h1>Forgot password</h1>
          {sent ? (
            <div className="auth-result">
              <span className="auth-result-icon" aria-hidden="true">
                <i className="bi bi-envelope-check" />
              </span>
              <h2>Check your inbox</h2>
              <p role="status">
                If an account exists for <strong>{email.trim()}</strong>, we have sent you
                a link to reset your password. The link is valid for 24 hours.
              </p>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: "100%" }}
                onClick={() => setSent(false)}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <p className="auth-lede">
                Enter the email of your account and we will send you a link to choose a
                new password.
              </p>
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p role="alert" className="form-error">
                    {error}
                  </p>
                )}
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Sending..." : "Send reset link"}
                </button>
              </form>
            </>
          )}
          <p className="auth-footer">
            Remembered it? <Link className="auth-link" to="/login">Back to login</Link>
          </p>
        </section>

        <AuthLandscape gradientId="authSkyForgotPassword" />
      </section>
    </div>
  );
}
