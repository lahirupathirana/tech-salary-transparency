import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import SearchPage from './pages/SearchPage.jsx';
import SubmitPage from './pages/SubmitPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import LandingPage from './pages/LandingPage.jsx';

function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const link = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive ? 'text-ink-900 bg-ink-100' : 'text-ink-600 hover:text-ink-900 hover:bg-ink-50'
    }`;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-white/75 border-b border-ink-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-white font-display font-bold">P</div>
          <span className="font-display font-bold text-lg text-ink-900 tracking-tight">
            Pay<span className="text-brand-600">Floor</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/search" className={link}>Explore</NavLink>
          <NavLink to="/stats"  className={link}>Insights</NavLink>
          <NavLink to="/submit" className={link}>Contribute</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden sm:inline text-sm text-ink-600">
                {user.displayName || 'Anonymous'}
              </span>
              <button className="btn-ghost" onClick={() => { logout(); nav('/'); }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login"  className="btn-ghost">Log in</Link>
              <Link to="/signup" className="btn-accent">Join free</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink-100 mt-24">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="font-display font-bold text-ink-900">PayFloor</div>
          <p className="text-sm text-ink-500 mt-1">
            Tech salary transparency, powered by the community.
          </p>
        </div>
        <p className="text-xs text-ink-400">
          Submissions are anonymised on request. Salary records are never linked to user emails.
        </p>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/"       element={<LandingPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/stats"  element={<StatsPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
