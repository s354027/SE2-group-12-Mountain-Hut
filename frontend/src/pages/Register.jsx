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
    phone: '',
    notes: '',
    emergencyContact: ''
  });

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
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
          <input
            id="password"
            name="password"
            type="password"
            minLength={6}
            value={formData.password}
            onChange={handleChange}
            required
          />
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