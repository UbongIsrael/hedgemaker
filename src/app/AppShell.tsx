import {Menu, ShieldCheck, X} from 'lucide-react';
import {useState} from 'react';
import {Link, NavLink, Outlet, useLocation} from 'react-router-dom';
import {Button} from '@/components/ui';
import {useAuth} from '@/integrations/privy/AuthProvider';
import {PageNavigation} from '@/components/PageNavigation';
import {BrandLogo} from '@/components/BrandLogo';

const publicLinks = [
  {to: '/market', label: 'Market'},
  {to: '/learn', label: 'How it works'},
  {to: '/market-makers', label: 'For market makers'},
  {to: '/terms', label: 'Risks'},
];

const appLinks = [
  {to: '/app', label: 'Overview'},
  {to: '/app/positions', label: 'Positions'},
  {to: '/app/wallet', label: 'Wallet'},
];

function navigationClass({isActive}: {isActive: boolean}) {
  return `site-nav__link${isActive ? ' site-nav__link--active' : ''}`;
}

export function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const inApp = location.pathname.startsWith('/app');
  const links = inApp ? appLinks : publicLinks;

  return (
    <div className="app-frame">
      <PageNavigation />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="environment-strip" role="status">
        <span className="environment-strip__dot" aria-hidden="true" />
        Demo mode
        <span aria-hidden="true">•</span>
        Sample exchange rates
        <span className="environment-strip__detail">No real money or currency exchange</span>
      </div>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="HedgeMaker home">
          <BrandLogo />
        </Link>

        <button
          type="button"
          className="site-header__menu"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setMenuOpen((open) => !open)}
          onKeyDown={(event) => { if (event.key === 'Escape') setMenuOpen(false); }}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        <nav
          id="primary-navigation"
          aria-label="Primary navigation"
          className={`site-nav${menuOpen ? ' site-nav--open' : ''}`}
          onKeyDown={(event) => { if (event.key === 'Escape') setMenuOpen(false); }}
        >
          {links.map((link) => (
            <NavLink key={link.to} className={navigationClass} to={link.to} onClick={() => setMenuOpen(false)} end={link.to === '/app'}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className={`site-header__actions${inApp ? ' site-header__actions--app' : ''}`}>
          {auth.authenticated ? (
            <>
              {!inApp && <Link className="hm-button hm-button--secondary hm-button--sm" to="/app">Overview</Link>}
              <span className="wallet-chip" title={auth.walletAddress}>
                <ShieldCheck size={15} aria-hidden="true" />
                {auth.walletAddress ?? 'Loading wallet…'}
              </span>
              <Button variant="ghost" size="sm" onClick={auth.logout}>Sign out</Button>
            </>
          ) : (
            <Button size="sm" onClick={auth.login} disabled={!auth.ready}>
              {auth.mode === 'privy' ? 'Sign in' : 'Enter demo'}
            </Button>
          )}
        </div>
      </header>

      {auth.mode === 'local_preview' && (
        <div className="preview-notice">
          You're exploring a demo with sample data. Trading, deposits, and withdrawals are unavailable.
        </div>
      )}

      <main id="main-content">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div>
          <Link className="brand brand--footer" to="/" aria-label="HedgeMaker home">
            <BrandLogo dark />
          </Link>
          <p>Explore protection against changes in the dollar–naira exchange rate.</p>
        </div>
        <div className="site-footer__links">
          <Link to="/market">Explore the market</Link>
          <Link to="/learn">How it works</Link>
          <Link to="/market-makers">Market makers</Link>
          <Link to="/terms">Risk disclosures</Link>
        </div>
        <p className="site-footer__legal">Demo on Monad testnet. Sample rates and test tokens only.</p>
      </footer>
    </div>
  );
}
