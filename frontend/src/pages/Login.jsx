import { useState } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import AuthLandscape from "../components/AuthLandscape.jsx";
import PasswordInput from "../components/PasswordInput.jsx";

export default function Login() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const location = useLocation(); // get the current location to determine where to redirect after login

  if (loading) return null; // still checking for an existing session

  if (user) {
    if (user.mustChangePassword) {
      return <Navigate to="/change-password" replace />;
    }
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
              <div className="field-label-row">
                <label htmlFor="password">Password</label>
                <Link className="auth-link" to="/forgot-password">Forgot password?</Link>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
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
          <p className="auth-footer">
            Don't have an account? <Link className="auth-link" to="/register">Sign up here</Link>
          </p>
        </section>

        <AuthLandscape gradientId="authSkyLogin" />
      </section>
    </div>
  );
}
