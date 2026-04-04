import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { SplashScreen } from '@/components/layout/SplashScreen';
import { FeedScreen } from '@/screens/FeedScreen';
import { EngineDebugScreen } from '@/screens/EngineDebugScreen';
import BotDetailScreen from '@/screens/BotDetailScreen';
import BotsScreen from '@/screens/BotsScreen';
import MarketsScreen from '@/screens/MarketsScreen';
import PortfolioScreen from '@/screens/PortfolioScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import { ScannerLabScreen } from '@/screens/ScannerLabScreen';
import { TradeScreen } from '@/screens/TradeScreen';
import LandingPage from '@/screens/LandingPage';

export default function App() {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setIsLoading(false), 1200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  if (isLoading) return <SplashScreen />;

  return (
    <ErrorBoundary key={location.pathname}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<AppShell />}>
        <Route path="/feed" element={<FeedScreen />} />
        <Route path="/markets" element={<MarketsScreen />} />
        <Route path="/bots" element={<BotsScreen />} />
        <Route path="/bots/:botId" element={<BotDetailScreen />} />
        <Route path="/portfolio" element={<PortfolioScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        {import.meta.env.DEV ? <Route path="/engine-debug" element={<EngineDebugScreen />} /> : null}
        {import.meta.env.DEV ? <Route path="/scanner-lab" element={<ScannerLabScreen />} /> : null}
      </Route>
      <Route path="/trade" element={<TradeScreen />} />
      <Route path="*" element={<Navigate to="/feed" replace />} />
    </Routes>
    </ErrorBoundary>
  );
}
