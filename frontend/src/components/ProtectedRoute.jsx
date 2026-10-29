import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

// Wrap routes that need a login and (optionally) a specific role.
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return null; // still checking the session
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
