import {useCallback, useEffect, useRef, useState} from 'react';
import type {Hex} from 'viem';
import {
  loadLiveOrderBook,
  ProtocolReadConfigurationError,
  type LiveOrderBookSnapshot,
} from './orderBook';
import {protocolReadConfig} from './config';

const REFRESH_INTERVAL_MS = 30_000;

export interface LiveOrderBookState {
  data?: LiveOrderBookSnapshot;
  error?: string;
  loading: boolean;
  refreshing: boolean;
  configured: boolean;
  missingConfiguration: string[];
  selectedSeriesId?: Hex;
  setSelectedSeriesId: (seriesId: Hex) => void;
  refresh: () => void;
}

function publicErrorMessage(error: unknown): string {
  if (error instanceof ProtocolReadConfigurationError) {
    return `Missing ${error.missing.join(', ')}.`;
  }
  return 'The Monad RPC did not return a complete order-book snapshot. Try again shortly.';
}

export function useLiveOrderBook(): LiveOrderBookState {
  const [data, setData] = useState<LiveOrderBookSnapshot>();
  const [error, setError] = useState<string>();
  const [selectedSeriesId, setSelectedSeriesId] = useState<Hex>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(protocolReadConfig.isConfigured);
  const [refreshing, setRefreshing] = useState(false);
  const dataRef = useRef<LiveOrderBookSnapshot | undefined>(undefined);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    if (!protocolReadConfig.isConfigured) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      if (dataRef.current) setRefreshing(true);
      else setLoading(true);
      setError(undefined);
      try {
        const next = await loadLiveOrderBook(selectedSeriesId);
        if (!cancelled) {
          dataRef.current = next;
          setData(next);
        }
      } catch (readError) {
        if (!cancelled) setError(publicErrorMessage(readError));
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
  }, [refreshKey, selectedSeriesId]);

  return {
    data,
    error,
    loading,
    refreshing,
    configured: protocolReadConfig.isConfigured,
    missingConfiguration: protocolReadConfig.missing,
    selectedSeriesId,
    setSelectedSeriesId,
    refresh,
  };
}
