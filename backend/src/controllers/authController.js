import { verifyPassword, hashPassword } from '../services/authService.js';

export function createAuthController({ User }) {
  async function register(req, res) {
    const { firstName, lastName, email, password, phone, notes, emergencyContact } = req.body ?? {};

    if (!firstName || !lastName || !email || !password || !phone) {
      return res.status(400).json({ error: 'First name, surname, email, password and mobile are mandatory' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must contain at least 6 characters' });
    }

    try {
      const existingUser = await User.findOne({ where: { email: email.trim().toLowerCase() } });
      if (existingUser) {
        return res.status(409).json({ error: 'A user with this email is already registered' });
      }

      const passwordHash = await hashPassword(password);

      const user = await User.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        notes: notes?.trim() || null,
        emergencyContact: emergencyContact?.trim() || null,
        passwordHash,
        role: 'HIKER'
      });

      req.session.user = { id: user.id, role: user.role };

      return res.status(201).json({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      });
    } catch (err) {
      console.error('Registration error:', err);
      return res.status(500).json({ error: 'Internal error while registering user' });
    }
  }

  async function login(req, res) {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ where: { email } });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = { id: user.id, role: user.role };

    return res.status(200).json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    });
  }

  function logout(req, res) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Could not log out' });
      }
      res.clearCookie('connect.sid');
      return res.status(204).send();
    });
  }
  
  // Returns the req.session.user object if present.
  function getMe(req, res) {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }
    return res.status(200).json(req.session.user);
  }

  return { register, login, logout, getMe };
}