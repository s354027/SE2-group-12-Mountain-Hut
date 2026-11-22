import { Op } from 'sequelize';
import {
  verifyPassword,
  hashPassword,
  generateResetToken,
  hashToken,
  RESET_TOKEN_TTL_MS,
  MIN_PASSWORD_LENGTH
} from '../services/authService.js';
import { sendPasswordResetEmail } from '../services/emailService.js';

function isValidNewPassword(password) {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

export function createAuthController({ User, PasswordResetToken }) {
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

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ where: { email: normalizedEmail } });

    // Temporary hikers created by an employee are not entitled to log in (MH-07)
    if (!user || user.isTemporary || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const mustChangePassword = Boolean(user.mustChangePassword);

    req.session.user = {
      id: user.id,
      role: user.role,
      ...(mustChangePassword ? { mustChangePassword: true } : {})
    };

    return res.status(200).json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      mustChangePassword
    });
  }

  // Changes the password of the logged user. Mandatory after the first
  // login of a hiker account created by an employee (MH-07).
  async function changePassword(req, res) {
    const { currentPassword, newPassword } = req.body ?? {};

    if (typeof currentPassword !== 'string' || !currentPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }

    if (!isValidNewPassword(newPassword)) {
      return res.status(400).json({ error: `Password must contain at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ error: 'The new password must be different from the current one' });
    }

    try {
      const user = await User.findByPk(req.session.user.id);

      if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      await user.update({
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false
      });

      req.session.user = { id: user.id, role: user.role };

      return res.status(204).send();
    } catch (err) {
      console.error('Change password error:', err);
      return res.status(500).json({ error: 'Internal error while changing password' });
    }
  }

  // Sends a password recovery link valid for 24 hours (MH-07).
  // Always answers 200 so that registered emails cannot be discovered.
  async function forgotPassword(req, res) {
    const { email } = req.body ?? {};

    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const genericResponse = {
      message: 'If an account exists for this email, a password reset link has been sent'
    };

    try {
      const user = await User.findOne({ where: { email: email.trim().toLowerCase() } });

      if (!user || user.isTemporary) {
        return res.status(200).json(genericResponse);
      }

      // Only the most recent link is valid
      await PasswordResetToken.destroy({ where: { userId: user.id, usedAt: null } });

      const token = generateResetToken();

      await PasswordResetToken.create({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS)
      });

      const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
      const resetLink = `${frontendOrigin}/reset-password?token=${encodeURIComponent(token)}`;

      const sent = await sendPasswordResetEmail(
        user.email,
        `${user.firstName} ${user.lastName}`.trim(),
        resetLink
      );

      if (!sent) {
        console.error(`Password reset email for user ${user.id} could not be sent`);
      }

      return res.status(200).json(genericResponse);
    } catch (err) {
      console.error('Forgot password error:', err);
      return res.status(500).json({ error: 'Internal error while requesting password reset' });
    }
  }

  // Sets a new password using a valid, unused and not expired reset token.
  // The token is invalidated upon its use (NIST SP 800-63A §3.8).
  async function resetPassword(req, res) {
    const { token, newPassword } = req.body ?? {};

    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'Reset token is required' });
    }

    if (!isValidNewPassword(newPassword)) {
      return res.status(400).json({ error: `Password must contain at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    try {
      const resetToken = await PasswordResetToken.findOne({
        where: {
          tokenHash: hashToken(token.trim()),
          usedAt: null,
          expiresAt: { [Op.gt]: new Date() }
        }
      });

      if (!resetToken) {
        return res.status(400).json({ error: 'Invalid or expired reset link' });
      }

      const user = await User.findByPk(resetToken.userId);

      if (!user || user.isTemporary) {
        return res.status(400).json({ error: 'Invalid or expired reset link' });
      }

      await user.update({
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false
      });

      await resetToken.update({ usedAt: new Date() });

      return res.status(204).send();
    } catch (err) {
      console.error('Reset password error:', err);
      return res.status(500).json({ error: 'Internal error while resetting password' });
    }
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

  return { register, login, logout, getMe, changePassword, forgotPassword, resetPassword };
}