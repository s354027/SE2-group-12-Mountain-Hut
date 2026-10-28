import { verifyPassword } from '../services/authService.js';

export function createAuthController({ User }) {
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

  return { login, logout, getMe };
}