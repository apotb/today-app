import { Link, NavLink, Outlet } from 'react-router-dom'
import logo from '../assets/logo.png'
import { NavigationHintsProvider, useNavigationHints } from './NavigationHintsContext'

function IconHome(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCalendar(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 3v4M16 3v4M3.5 10h17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M8 14h2M12 14h2M8 17h2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconSettings(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M19.4 15a1.5 1.5 0 0 0 .3 1.7l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4V21a2 2 0 0 1-4 0v-.1a1.5 1.5 0 0 0-1-.9 1.5 1.5 0 0 0-1.7.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9H3a2 2 0 0 1 0-4h.1A1.5 1.5 0 0 0 4.5 9a1.5 1.5 0 0 0-.3-1.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.5 1.5 0 0 0 1.7.3H9a1.5 1.5 0 0 0 .9-1V3a2 2 0 0 1 4 0v.1a1.5 1.5 0 0 0 .9 1 1.5 1.5 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9H21a2 2 0 0 1 0 4h-.1a1.5 1.5 0 0 0-1.4.9Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function bottomNavClass({ isActive }: { isActive: boolean }) {
  return ['bottom-nav-link', isActive ? 'active' : ''].filter(Boolean).join(' ')
}

function LayoutShell() {
  const { pulseEventsTab, firstLikeMessage, dismissFirstLikeMessage } = useNavigationHints()

  return (
    <div className="app-shell">
      <header className="app-top-brand">
        <Link to="/" className="brand">
          <img src={logo} alt="" width={38} height={38} />
          <span>Today</span>
        </Link>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      {firstLikeMessage ? (
        <div className="nav-hint-toast" role="status">
          <span>{firstLikeMessage}</span>
          <button
            type="button"
            className="nav-hint-dismiss"
            onClick={dismissFirstLikeMessage}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}
      <nav className="bottom-nav" aria-label="Main navigation">
        <NavLink to="/" end className={bottomNavClass}>
          <IconHome />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/my-events"
          className={({ isActive }) =>
            [bottomNavClass({ isActive }), pulseEventsTab ? 'bottom-nav-pulse' : '']
              .filter(Boolean)
              .join(' ')
          }
        >
          <IconCalendar />
          <span>Events</span>
        </NavLink>
        <NavLink to="/settings" className={bottomNavClass}>
          <IconSettings />
          <span>Settings</span>
        </NavLink>
      </nav>
    </div>
  )
}

export function Layout() {
  return (
    <NavigationHintsProvider>
      <LayoutShell />
    </NavigationHintsProvider>
  )
}
