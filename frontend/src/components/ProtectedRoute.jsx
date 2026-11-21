import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

// Wrap routes that need a login and (optionally) a specific role.
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null; // still checking the session
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  // Accounts created by an employee must replace the generated password first (MH-07)
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
