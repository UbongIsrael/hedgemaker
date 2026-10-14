import {Menu, ShieldCheck, X} from 'lucide-react';
import {useState} from 'react';
import {Link, NavLink, Outlet, useLocation} from 'react-router-dom';
import {Button} from '@/components/ui';
import {useAuth} from '@/integrations/privy/AuthProvider';
import {PageNavigation} from '@/components/PageNavigation';

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
  const liveSurface = inApp || location.pathname === '/' || location.pathname === '/market' || location.pathname === '/market-makers/integration';
  const links = inApp ? appLinks : publicLinks;

  return (
    <div className="app-frame">
      <PageNavigation />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="environment-strip" role="status">
        <span className="environment-strip__dot" aria-hidden="true" />
        {liveSurface ? 'Monad testnet' : 'Public preview'}
        <span aria-hidden="true">•</span>
        {liveSurface ? 'Live onchain data' : 'Illustrative exchange rates'}
        <span className="environment-strip__detail">Test tokens only · no currency exchange</span>
      </div>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="HedgeMaker home">
          <span className="brand__mark" aria-hidden="true">H</span>
          <span className="brand__wordmark">HedgeMaker</span>
        </Link>

        <button
          type="button"
          className="site-header__menu"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        <nav
          id="primary-navigation"
          aria-label="Primary navigation"
          className={`site-nav${menuOpen ? ' site-nav--open' : ''}`}
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
              {auth.mode === 'privy' ? 'Sign in' : 'Sign-in unavailable'}
            </Button>
          )}
        </div>
      </header>

      {auth.mode === 'unconfigured' && (
        <div className="preview-notice">
          Privy sign-in is not configured. Public preview pages remain available; account routes require a real wallet.
        </div>
      )}

      <main id="main-content">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div>
          <Link className="brand brand--footer" to="/">
            <span className="brand__mark" aria-hidden="true">H</span>
            <span className="brand__wordmark">HedgeMaker</span>
          </Link>
          <p>Explore protection against changes in the dollar–naira exchange rate.</p>
        </div>
        <div className="site-footer__links">
          <Link to="/market-makers">Market makers</Link>
          <Link to="/terms">Risk disclosures</Link>
        </div>
        <p className="site-footer__legal">{liveSurface ? 'Live contract reads on Monad testnet. Test tokens only.' : 'Public preview on Monad testnet. Illustrative rates and test tokens only.'}</p>
      </footer>
    </div>
  );
}
