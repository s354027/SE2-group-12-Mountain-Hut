import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

export default function StaffRegister() {
  const { registerStaff } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    role: 'EMPLOYEE'
  });

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const createdUser = await registerStaff(formData);
      setSuccess(`Staff user ${createdUser.firstName} ${createdUser.lastName} (${createdUser.role}) created successfully!`);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        phone: '',
        role: 'EMPLOYEE'
      });
    } catch (err) {
      setError(err.message || 'Error creating staff');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card" style={{ maxWidth: '460px' }}>
      <h1>Add Staff Member</h1>
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
          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
          />
        </div>

        <div className="field">
          <label htmlFor="role">Role *</label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d3d9df' }}
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="WARDEN">Warden</option>
          </select>
        </div>

        {error && <p role="alert" className="form-error">{error}</p>}
        {success && <p style={{ color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.875rem' }}>{success}</p>}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Creation in progress...' : 'Create Staff User'}
        </button>
      </form>
    </section>
  );
}