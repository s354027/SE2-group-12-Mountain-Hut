import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Register() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    notes: '',
    emergencyContact: ''
  });

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      await register(formData);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Error while registering');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card" style={{ maxWidth: '440px' }}>
      <h1>Hiker Registration</h1>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="firstName">Name *</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            value={formData.firstName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="lastName">Last name *</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            value={formData.lastName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="email">Email *</label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password *</label>
          <div style={{ position: "relative" }}>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            minLength={6}
            value={formData.password}
            onChange={handleChange}
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

        <div className="field">
          <label htmlFor="confirmPassword">Confirm Password *</label>
          <div style={{ position: "relative" }}>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            minLength={6}
            value={formData.confirmPassword}
            onChange={handleChange}
            style={{ width: "100%", paddingRight: 44 }}
            required
          />
            <button type="button" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword((value) => !value)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#244c3d', cursor: 'pointer', padding: 6, display: 'flex' }}>
              {showConfirmPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c5 0 8.7 4 10 7a12 12 0 0 1-3.1 4.2"/><path d="M6.1 6.1A12.5 12.5 0 0 0 2 12c1.3 3 5 7 10 7 1.6 0 3-.4 4.3-1.1"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="phone">Phone number *</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="notes">Notes (optional)</label>
          <input
            id="notes"
            name="notes"
            type="text"
            value={formData.notes}
            onChange={handleChange}
          />
        </div>

        <div className="field">
          <label htmlFor="emergencyContact">Emergency contact (optional)</label>
          <input
            id="emergencyContact"
            name="emergencyContact"
            type="text"
            placeholder="name and phone number"
            value={formData.emergencyContact}
            onChange={handleChange}
          />
        </div>

        {error && <p role="alert" className="form-error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Registration in progress...' : 'Register'}
        </button>
      </form>

      <p style={{ marginTop: '16px', fontSize: '0.875rem', textAlign: 'center' }}>
        Already have an account? <Link to="/login">Login here</Link>
      </p>
    </section>
  );
}