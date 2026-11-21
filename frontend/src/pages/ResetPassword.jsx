import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import AuthLandscape from "../components/AuthLandscape.jsx";
import PasswordInput from "../components/PasswordInput.jsx";

const MIN_PASSWORD_LENGTH = 6;
const EXPIRED_LINK_ERROR = "Invalid or expired reset link";

// MH-07: landing page of the reset link sent by email (/reset-password?token=...).
// The link is single-use and expires after 24 hours (NIST SP 800-63A §3.8).
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must contain at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  let content;
  if (!token) {
    content = (
      <div className="auth-result">
        <span className="auth-result-icon is-warning" aria-hidden="true">
          <i className="bi bi-link-45deg" />
        </span>
        <h2>Link not valid</h2>
        <p role="alert">
          This reset link is not valid. Make sure you opened the full link from the
          email, or request a new one.
        </p>
        <Link className="btn-primary" to="/forgot-password">Request a new link</Link>
      </div>
    );
  } else if (done) {
    content = (
      <div className="auth-result">
        <span className="auth-result-icon" aria-hidden="true">
          <i className="bi bi-check2" />
        </span>
        <h2>Password updated</h2>
        <p role="status">
          Your password has been updated. You can now log in with your new password.
        </p>
        <Link className="btn-primary" to="/login">Go to login</Link>
      </div>
    );
  } else {
    content = (
      <>
        <p className="auth-lede">Choose a new password for your account.</p>
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              aria-describedby="newPasswordHint"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <small id="newPasswordHint">At least {MIN_PASSWORD_LENGTH} characters.</small>
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">Confirm new password</label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
              {error === EXPIRED_LINK_ERROR && (
                <>
                  .<Link className="auth-link" to="/forgot-password">Request a new link</Link>
                </>
              )}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Saving..." : "Set new password"}
          </button>
        </form>
      </>
    );
  }

  return (
    <div className="field-guide-search auth-page">
      <section className="field-guide-hero">
        <section className="auth-card">
          <span className="field-guide-kicker">
            <span aria-hidden="true" /> PASSWORD RECOVERY
          </span>
          <h1>Reset password</h1>
          {content}
          {!done && (
            <p className="auth-footer">
              <Link className="auth-link" to="/login">Back to login</Link>
            </p>
          )}
        </section>

        <AuthLandscape gradientId="authSkyResetPassword" />
      </section>
    </div>
  );
}
