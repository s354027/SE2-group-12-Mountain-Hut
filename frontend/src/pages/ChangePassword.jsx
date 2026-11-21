import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import AuthLandscape from "../components/AuthLandscape.jsx";
import PasswordInput from "../components/PasswordInput.jsx";

const MIN_PASSWORD_LENGTH = 6;

// MH-07: hikers whose account was created by an employee receive a random
// password and must replace it at their first login. Any logged user can
// also use this page to change their password.
export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const mustChange = Boolean(user?.mustChangePassword);

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
    if (newPassword === currentPassword) {
      setError("The new password must be different from the current one");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate("/", { replace: true, state: { passwordChanged: true } });
    } catch (err) {
      setError(err.status === 401 ? "The current password is not correct" : err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="field-guide-search auth-page">
      <section className="field-guide-hero">
        <section className="auth-card">
          <span className="field-guide-kicker">
            <span aria-hidden="true" /> ACCOUNT SECURITY
          </span>
          <h1>Change password</h1>
          {mustChange ? (
            <div role="status" className="auth-notice">
              <i className="bi bi-shield-lock" aria-hidden="true" />
              <div>
                <strong>Choose your own password</strong>
                Your account was created by the hut staff with a temporary password.
                Set a new one to continue using the site.
              </div>
            </div>
          ) : (
            <p className="auth-lede">Enter your current password, then choose a new one.</p>
          )}
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="currentPassword">
                {mustChange ? "Temporary password" : "Current password"}
              </label>
              <PasswordInput
                id="currentPassword"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
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
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Saving..." : "Change password"}
            </button>
          </form>
          <p className="auth-footer">
            {mustChange ? (
              <>
                Not you?{" "}
                <button type="button" className="auth-link auth-text-button" onClick={logout}>
                  Log out
                </button>
              </>
            ) : (
              <Link className="auth-link" to="/">Back to home</Link>
            )}
          </p>
        </section>

        <AuthLandscape gradientId="authSkyChangePassword" />
      </section>
    </div>
  );
}
