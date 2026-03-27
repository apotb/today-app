import { Link, NavLink, Outlet } from 'react-router-dom'
import logo from '../assets/logo.png'

export function Layout() {
  return (
    <div className="app-shell">
      <header className="top-nav">
        <Link to="/" className="brand">
          <img src={logo} alt="Today logo" />
          <span>Today</span>
        </Link>
        <nav>
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/my-events">My Events</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
