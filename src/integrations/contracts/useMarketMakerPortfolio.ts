import {useCallback, useEffect, useRef, useState} from 'react';
import {
  loadMarketMakerPortfolio,
  type MarketMakerPortfolioSnapshot,
} from './marketMakerPortfolio';
import {ProtocolReadConfigurationError} from './orderBook';

const REFRESH_INTERVAL_MS = 30_000;

function publicPortfolioError(error: unknown) {
  if (error instanceof ProtocolReadConfigurationError) {
    return `Missing ${error.missing.join(', ')}.`;
  }
  if (error instanceof Error && error.message === 'Enter a valid EVM wallet address.') {
    return error.message;
  }
  return 'The Monad RPC did not return a complete account snapshot. Try again shortly.';
}

export function useMarketMakerPortfolio(owner?: string) {
  const [data, setData] = useState<MarketMakerPortfolioSnapshot>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const dataRef = useRef<MarketMakerPortfolioSnapshot | undefined>(undefined);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    if (!owner) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      if (dataRef.current?.owner.toLowerCase() === owner.toLowerCase()) setRefreshing(true);
      else {
        dataRef.current = undefined;
        setData(undefined);
        setLoading(true);
      }
      setError(undefined);
      try {
        const next = await loadMarketMakerPortfolio(owner);
        if (!cancelled) {
          dataRef.current = next;
          setData(next);
        }
      } catch (readError) {
        if (!cancelled) {
          setError(publicPortfolioError(readError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void run();
    const interval = window.setInterval(run, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [owner, refreshKey]);

  return {
    data: owner ? data : undefined,
    error: owner ? error : undefined,
    loading: owner ? loading : false,
    refreshing: owner ? refreshing : false,
    refresh,
  };
}
