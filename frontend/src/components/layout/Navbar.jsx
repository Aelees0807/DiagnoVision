import { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Menu, X, Activity, LogIn, UserPlus, ChevronDown, User, History, LogOut, Shield, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_LINKS } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Top navigation bar with glassmorphism on scroll.
 * Collapses to hamburger on mobile (<768px).
 * Auth-aware: shows Login/Register when logged out, user menu when logged in.
 * @see docs/frontend/components.md — Navbar
 */
export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const navigate = useNavigate();

  const { isAuthenticated, profile, signOut, isAdmin, isMedicalStaff, loading } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setIsMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
    await signOut();
    navigate('/');
  };

  // Get display name — first name or full name
  const displayName = profile?.full_name
    ? profile.full_name.split(' ')[0]
    : 'User';

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'glass-strong shadow-md'
          : 'bg-white/40 backdrop-blur-sm'
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group" aria-label="DiagnoVision home">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-info flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="absolute inset-0 rounded-lg bg-primary/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-xl font-bold gradient-text">
              DiagnoVision
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'text-primary bg-primary-light'
                      : 'text-secondary hover:text-foreground hover:bg-surface-hover'
                  )
                }
              >
                {label}
              </NavLink>
            ))}

            {/* Auth section — desktop */}
            {!loading && (
              <>
                {isAuthenticated ? (
                  /* ── User Menu Dropdown ── */
                  <div className="relative ml-2" ref={userMenuRef}>
                    <button
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                        isUserMenuOpen
                          ? 'text-primary bg-primary-light'
                          : 'text-secondary hover:text-foreground hover:bg-surface-hover'
                      )}
                      aria-expanded={isUserMenuOpen}
                      aria-haspopup="true"
                      id="user-menu-button"
                    >
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-info flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="max-w-[100px] truncate">{displayName}</span>
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', isUserMenuOpen && 'rotate-180')} />
                    </button>

                    {/* Dropdown */}
                    {isUserMenuOpen && (
                      <div
                        className="absolute right-0 mt-2 w-56 glass-panel-elevated rounded-xl border border-border/50 shadow-xl animate-scale-in origin-top-right py-1.5"
                        role="menu"
                        aria-labelledby="user-menu-button"
                      >
                        {/* User info */}
                        <div className="px-4 py-3 border-b border-border/50">
                          <p className="text-sm font-semibold text-foreground truncate">{profile?.full_name || 'User'}</p>
                          <p className="text-xs text-muted truncate mt-0.5">{profile?.role === 'medical_staff' ? 'Medical Staff' : profile?.role === 'admin' ? 'Admin' : 'General User'}</p>
                        </div>

                        {/* Links */}
                        <div className="py-1">
                          <Link
                            to="/history"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
                            role="menuitem"
                          >
                            <History className="h-4 w-4" />
                            History
                          </Link>
                          <Link
                            to="/profile"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
                            role="menuitem"
                          >
                            <User className="h-4 w-4" />
                            Profile
                          </Link>
                          {(isMedicalStaff || isAdmin) && (
                            <Link
                              to="/staff"
                              onClick={() => setIsUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
                              role="menuitem"
                            >
                              <Stethoscope className="h-4 w-4" />
                              Staff Dashboard
                            </Link>
                          )}
                          {isAdmin && (
                            <Link
                              to="/admin"
                              onClick={() => setIsUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
                              role="menuitem"
                            >
                              <Shield className="h-4 w-4" />
                              Admin
                            </Link>
                          )}
                        </div>

                        {/* Sign out */}
                        <div className="border-t border-border/50 pt-1">
                          <button
                            onClick={handleSignOut}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-error hover:bg-error-bg transition-colors cursor-pointer"
                            role="menuitem"
                          >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Login / Register Buttons ── */
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      onClick={() => navigate('/login')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-surface-hover transition-all duration-200 cursor-pointer"
                    >
                      <LogIn className="h-4 w-4" />
                      Sign In
                    </button>
                    <button
                      onClick={() => navigate('/register')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-primary to-primary-hover text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
                      style={{ color: 'white' }}
                    >
                      <UserPlus className="h-4 w-4" />
                      Register
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div
        className={cn(
          'md:hidden overflow-hidden transition-all duration-300 ease-in-out',
          isMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="glass-strong border-t border-border/50 px-4 py-3 space-y-1">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'block px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'text-primary bg-primary-light'
                    : 'text-secondary hover:text-foreground hover:bg-surface-hover'
                )
              }
            >
              {label}
            </NavLink>
          ))}

          {/* Auth section — mobile */}
          {!loading && (
            <>
              <div className="border-t border-border/50 my-2" />

              {isAuthenticated ? (
                <>
                  {/* User info */}
                  <div className="px-4 py-2">
                    <p className="text-sm font-semibold text-foreground">{profile?.full_name || 'User'}</p>
                    <p className="text-xs text-muted">{profile?.role === 'medical_staff' ? 'Medical Staff' : profile?.role === 'admin' ? 'Admin' : 'General User'}</p>
                  </div>

                  <Link
                    to="/history"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-surface-hover transition-all duration-200"
                  >
                    <History className="h-4 w-4" />
                    History
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-surface-hover transition-all duration-200"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                  {(isMedicalStaff || isAdmin) && (
                    <Link
                      to="/staff"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-surface-hover transition-all duration-200"
                    >
                      <Stethoscope className="h-4 w-4" />
                      Staff Dashboard
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-surface-hover transition-all duration-200"
                    >
                      <Shield className="h-4 w-4" />
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-error hover:bg-error-bg transition-all duration-200 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 px-4 py-2">
                  <button
                    onClick={() => { setIsMenuOpen(false); navigate('/login'); }}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border-2 border-primary text-primary hover:bg-primary-light transition-all duration-200 cursor-pointer"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </button>
                  <button
                    onClick={() => { setIsMenuOpen(false); navigate('/register'); }}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-gradient-to-r from-primary to-primary-hover text-white shadow-md transition-all duration-200 cursor-pointer"
                    style={{ color: 'white' }}
                  >
                    <UserPlus className="h-4 w-4" />
                    Register
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
