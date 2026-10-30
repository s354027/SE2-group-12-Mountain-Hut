import { hashPassword } from '../services/authService.js';

export function createAdminController({ User }) {
  async function createStaffUser(req, res) {
    const { firstName, lastName, email, password, phone, role } = req.body ?? {};

    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ error: 'All required fields (first name, last name, email, password, role) must be provided' });
    }

    if (!['EMPLOYEE', 'WARDEN'].includes(role)) {
      return res.status(400).json({ error: 'The specified role must be EMPLOYEE or WARDEN' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    try {
      const existingUser = await User.findOne({ where: { email: email.trim().toLowerCase() } });
      if (existingUser) {
        return res.status(409).json({ error: 'A user with this email is already registered' });
      }

      const passwordHash = await hashPassword(password);

      const staffUser = await User.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        passwordHash,
        role
      });

      return res.status(201).json({
        id: staffUser.id,
        firstName: staffUser.firstName,
        lastName: staffUser.lastName,
        email: staffUser.email,
        role: staffUser.role
      });
    } catch (err) {
      console.error('Error creating staff user:', err);
      return res.status(500).json({ error: 'Error creating staff member' });
    }
  }

  return { createStaffUser };
}