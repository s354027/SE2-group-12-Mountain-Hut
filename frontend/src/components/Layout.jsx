import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const isStaff = user && ['EMPLOYEE', 'WARDEN'].includes(user.role);
  const isWarden = user?.role === 'WARDEN';

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="navbar">
        <NavLink className="brand" to="/" aria-label="Mountain Hut home">
          <span className="brand-name ms-2">Mountain <em>Hut</em><small>ALPINE HOSPITALITY</small></span>
        </NavLink>
        <nav aria-label="Main navigation" className="main-nav">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/search">Availability</NavLink>
          {isStaff && <NavLink to="/staff/slots">Manage slots</NavLink>}
          {isWarden && <NavLink to="/admin/staff/new">New staff</NavLink>}
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="nav-role" title={`Signed in as ${user.role}`}>{user.role}</span>
              <button type="button" className="nav-logout me-1" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink className="nav-login" to="/login">Log in</NavLink>
              <NavLink className="nav-register" to="/register">Register</NavLink>
            </>
          )}
        </div>
      </header>
      <main className="content" id="main-content"><Outlet /></main>
      <footer className="site-footer">
        <span>MOUNTAIN HUT <span aria-hidden="true">✳</span> A PLACE TO PAUSE</span>
        <span>MADE FOR THE MOUNTAINS</span>
      </footer>
    </div>
  );
}
