import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const isStaff = user && ['EMPLOYEE', 'WARDEN'].includes(user.role);

  return (
    <>
      <header className="navbar">
        <strong>Mountain Hut</strong>
        <nav>
          <NavLink to="/">Home</NavLink>
          <NavLink to="/search">Availability</NavLink>
          {user?.role === 'HIKER' && <NavLink to="/booking">Book a table</NavLink>}
          {isStaff && <NavLink to="/staff/slots">Slots</NavLink>}
        </nav>
        <div>
          {user ? (
            <button onClick={logout}>Logout</button>
          ) : (
            <NavLink to="/login">Login</NavLink>
          )}
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </>
  );
}
