import {Navigate, Route, Routes, useLocation} from 'react-router-dom';
import type {ReactNode} from 'react';
import {AppShell} from './AppShell';
import {LandingPage} from '@/pages/LandingPage';
import {MarketPage} from '@/pages/MarketPage';
import {LearnPage} from '@/pages/LearnPage';
import {TermsPage} from '@/pages/TermsPage';
import {DashboardPage} from '@/pages/app/DashboardPage';
import {WalletPage} from '@/pages/app/WalletPage';
import {PositionsPage} from '@/pages/app/PositionsPage';
import {PositionDetailPage} from '@/pages/app/PositionDetailPage';
import {NotFoundPage} from '@/pages/NotFoundPage';
import {MarketMakersPage} from '@/pages/MarketMakersPage';
import {MarketMakerGuidePage} from '@/pages/MarketMakerGuidePage';
import {useAuth} from '@/integrations/privy/AuthProvider';

function RequireAuth({children}: {children: ReactNode}) {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.ready) {
    return <div className="page-shell content-page"><p>Getting sign-in ready…</p></div>;
  }
  if (!auth.authenticated) {
    return <Navigate to="/market" state={{from: location.pathname}} replace />;
  }
  return children;
}

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<LandingPage />} />
        <Route path="market" element={<MarketPage />} />
        <Route path="learn" element={<LearnPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="market-makers" element={<MarketMakersPage />} />
        <Route path="market-makers/guide" element={<MarketMakerGuidePage />} />
        <Route path="app" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="app/wallet" element={<RequireAuth><WalletPage /></RequireAuth>} />
        <Route path="app/positions" element={<RequireAuth><PositionsPage /></RequireAuth>} />
        <Route path="app/positions/:positionId" element={<RequireAuth><PositionDetailPage /></RequireAuth>} />
        <Route path="app/orders/new" element={<Navigate to="/market" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
