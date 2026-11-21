import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Backend contract (backend/src/routes/auth.routes.js, cookie session):
//   POST /api/auth/login   { email, password } -> { id, firstName, lastName, role, mustChangePassword }  | 401
//                          (temporary hikers created by an employee always get 401)
//   POST /api/auth/logout  -> 204
//   GET  /api/auth/me      -> { id, role, mustChangePassword? }  | 401 when not logged in
//                          (mustChangePassword: true until the generated password is changed)
//   POST /api/auth/change-password { currentPassword, newPassword } -> 204 | 400 | 401
//   POST /api/auth/forgot-password { email } -> 200 (always, even for unknown emails)
//   POST /api/auth/reset-password  { token, newPassword } -> 204 | 400 invalid/expired link (24h)
// Roles: 'HIKER' | 'EMPLOYEE' | 'WARDEN'. Not logged in => user === null.
// While user.mustChangePassword is true, protected pages redirect to /change-password
// and hiker booking endpoints answer 403 { code: 'PASSWORD_CHANGE_REQUIRED' }.

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check the session

  // On page load, ask the backend if there is already a session cookie.
  useEffect(() => {
    api
      .get('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const loggedUser = await api.post('/auth/login', { email, password });
    setUser(loggedUser);
    return loggedUser;
  }

  async function register(userData) {
    const registeredUser = await api.post('/auth/register', userData);
    setUser(registeredUser);
    return registeredUser;
  }

  async function registerStaff(staffData) {
    return await api.post('/admin/staff', staffData);
  }

  async function changePassword(currentPassword, newPassword) {
    await api.post('/auth/change-password', { currentPassword, newPassword });
    setUser((current) => (current ? { ...current, mustChangePassword: false } : current));
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, registerStaff, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
