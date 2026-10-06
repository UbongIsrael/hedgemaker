import { Menu, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui";
import { useAuth } from "@/integrations/privy/AuthProvider";
import { PageNavigation } from "@/components/PageNavigation";
import { BrandLogo } from "@/components/BrandLogo";

const publicLinks = [
  { to: "/market", label: "Market" },
  { to: "/learn", label: "How it works" },
  { to: "/market-makers", label: "For market makers" },
  { to: "/terms", label: "Risks" },
];
const appLinks = [
  { to: "/app", label: "Overview" },
  { to: "/app/positions", label: "Positions" },
  { to: "/app/wallet", label: "Wallet" },
];

function AuthActions({
  inApp,
  onAction,
}: {
  inApp: boolean;
  onAction: () => void;
}) {
  const auth = useAuth();
  if (!auth.authenticated)
    return (
      <Button
        size="sm"
        onClick={() => {
          onAction();
          auth.login();
        }}
        disabled={!auth.ready}
      >
        {auth.mode === "privy" ? "Sign in" : "Enter demo"}
      </Button>
    );
  return (
    <>
      {!inApp && (
        <Link
          className="hm-button hm-button--secondary hm-button--sm"
          to="/app"
          onClick={onAction}
        >
          Overview
        </Link>
      )}
      <span className="wallet-chip" title={auth.walletAddress}>
        <ShieldCheck size={15} aria-hidden="true" />
        {auth.walletAddress ?? "Loading wallet…"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onAction();
          auth.logout();
        }}
      >
        Sign out
      </Button>
    </>
  );
}

export function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const [menuRoute, setMenuRoute] = useState<string | null>(null);
  const menuOpen = menuRoute === location.pathname + location.search;
  const menuButton = useRef<HTMLButtonElement>(null);
  const inApp = location.pathname.startsWith("/app");
  const links = inApp ? appLinks : publicLinks;
  const closeMenu = () => setMenuRoute(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 901px)");
    const closeAtDesktop = () => {
      if (media.matches) setMenuRoute(null);
    };
    const closeOnHistoryChange = () => setMenuRoute(null);
    media.addEventListener("change", closeAtDesktop);
    window.addEventListener("popstate", closeOnHistoryChange);
    return () => {
      media.removeEventListener("change", closeAtDesktop);
      window.removeEventListener("popstate", closeOnHistoryChange);
    };
  }, []);

  return (
    <div className="app-frame">
      <PageNavigation />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="environment-strip" role="status">
        <span className="environment-strip__dot" aria-hidden="true" />
        Demo mode<span aria-hidden="true">•</span>Sample exchange rates
        <span className="environment-strip__detail">
          No real money or currency exchange
        </span>
      </div>
      <header
        className={`site-header${menuOpen ? " site-header--menu-open" : ""}`}
        onKeyDown={(event) => {
          if (menuOpen && event.key === "Escape") {
            closeMenu();
            menuButton.current?.focus();
          }
        }}
      >
        <Link
          className="brand"
          to="/"
          aria-label="HedgeMaker home"
          onClick={closeMenu}
        >
          <BrandLogo />
        </Link>
        <button
          ref={menuButton}
          type="button"
          className="site-header__menu"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          onClick={() =>
            setMenuRoute(menuOpen ? null : location.pathname + location.search)
          }
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav
          id="primary-navigation"
          aria-label="Primary navigation"
          className={`site-nav${menuOpen ? " site-nav--open" : ""}`}
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              className={({ isActive }) =>
                `site-nav__link${isActive ? " site-nav__link--active" : ""}`
              }
              to={link.to}
              onClick={closeMenu}
              end={link.to === "/app"}
            >
              {link.label}
            </NavLink>
          ))}
          <div className="mobile-nav-actions">
            <AuthActions inApp={inApp} onAction={closeMenu} />
          </div>
        </nav>
        <div
          className={`site-header__actions${inApp ? " site-header__actions--app" : ""}`}
        >
          <AuthActions inApp={inApp} onAction={closeMenu} />
        </div>
      </header>
      {auth.mode === "local_preview" && (
        <div className="preview-notice">
          You're exploring a demo with sample data. Trading, deposits, and
          withdrawals are unavailable.
        </div>
      )}
      <main id="main-content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div>
          <Link
            className="brand brand--footer"
            to="/"
            aria-label="HedgeMaker home"
          >
            <BrandLogo dark />
          </Link>
          <p>
            Explore a new way to manage exchange-rate risk, starting with
            USD/NGN.
          </p>
          <p className="site-footer__mission">
            Building accessible hedging infrastructure.
          </p>
        </div>
        <div className="site-footer__links">
          <Link to="/market">Explore the market</Link>
          <Link to="/learn">How it works</Link>
          <Link to="/market-makers">Market makers</Link>
          <Link to="/terms">Risk disclosures</Link>
        </div>
        <p className="site-footer__legal">
          Demo on Monad testnet. Sample rates and test tokens only.
        </p>
      </footer>
    </div>
  );
}
