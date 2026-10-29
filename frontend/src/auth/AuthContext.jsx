import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Backend contract (backend/src/routes/auth.routes.js, cookie session):
//   POST /api/auth/login   { email, password } -> { id, firstName, lastName, role }  | 401
//   POST /api/auth/logout  -> 204
//   GET  /api/auth/me      -> { id, role }  | 401 when not logged in
// Roles: 'HIKER' | 'EMPLOYEE' | 'WARDEN'. Not logged in => user === null.

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

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
