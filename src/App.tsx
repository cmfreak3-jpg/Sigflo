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
import { PlaceholderScreen } from '@/screens/PlaceholderScreen';
import { ScannerLabScreen } from '@/screens/ScannerLabScreen';
import { TradeScreen } from '@/screens/TradeScreen';

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
      <Route path="/" element={<Navigate to="/feed" replace />} />
      <Route element={<AppShell />}>
        <Route path="/feed" element={<FeedScreen />} />
        <Route path="/markets" element={<MarketsScreen />} />
        <Route path="/bots" element={<BotsScreen />} />
        <Route path="/bots/:botId" element={<BotDetailScreen />} />
        <Route path="/portfolio" element={<PortfolioScreen />} />
        <Route path="/profile" element={<PlaceholderScreen title="Profile" subtitle="Account and preferences — mock shell." />} />
        {import.meta.env.DEV ? <Route path="/engine-debug" element={<EngineDebugScreen />} /> : null}
        {import.meta.env.DEV ? <Route path="/scanner-lab" element={<ScannerLabScreen />} /> : null}
      </Route>
      <Route path="/trade" element={<TradeScreen />} />
      <Route path="*" element={<Navigate to="/feed" replace />} />
    </Routes>
    </ErrorBoundary>
  );
}
