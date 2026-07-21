import React from 'react';
import { createPortal } from 'react-dom';

type AppLoadingScope = 'app' | 'lsw' | 'rca' | 'rails';

type AppLoadingOptions = {
  detail?: string;
  message?: string;
  scope?: AppLoadingScope;
  title?: string;
};

type AppLoadingEntry = Required<Omit<AppLoadingOptions, 'detail'>> & {
  detail: string;
  id: number;
  startedAt: number;
};

type AppLoadingContextValue = {
  beginLoading: (options?: AppLoadingOptions) => () => void;
  isLoading: boolean;
  loadingCount: number;
  withLoading: <T>(operation: Promise<T> | (() => Promise<T>), options?: AppLoadingOptions) => Promise<T>;
};

const APP_LOADING_SHOW_DELAY_MS = 180;
const APP_LOADING_MIN_VISIBLE_MS = 520;

const defaultLoadingEntry: Omit<AppLoadingEntry, 'id' | 'startedAt'> = {
  detail: 'Preparing your enterprise workspace',
  message: 'Syncing secure operational data',
  scope: 'app',
  title: 'Loading Synzapp'
};

const AppLoadingContext = React.createContext<AppLoadingContextValue | null>(null);

export function AppLoadingProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<AppLoadingEntry[]>([]);
  const [visibleEntry, setVisibleEntry] = React.useState<AppLoadingEntry | null>(null);
  const [isOverlayVisible, setIsOverlayVisible] = React.useState(false);
  const nextIdRef = React.useRef(1);
  const visibleSinceRef = React.useRef(0);
  const showTimerRef = React.useRef<number | null>(null);
  const hideTimerRef = React.useRef<number | null>(null);
  const latestEntry = entries[entries.length - 1] || null;

  React.useEffect(() => {
    if (latestEntry) {
      setVisibleEntry(latestEntry);

      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      if (!isOverlayVisible && showTimerRef.current === null) {
        showTimerRef.current = window.setTimeout(() => {
          showTimerRef.current = null;
          visibleSinceRef.current = window.performance.now();
          setIsOverlayVisible(true);
        }, APP_LOADING_SHOW_DELAY_MS);
      }

      return;
    }

    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    if (!isOverlayVisible) {
      setVisibleEntry(null);
      return;
    }

    const elapsedVisibleMs = window.performance.now() - visibleSinceRef.current;
    const remainingMs = Math.max(0, APP_LOADING_MIN_VISIBLE_MS - elapsedVisibleMs);

    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      setIsOverlayVisible(false);
      setVisibleEntry(null);
    }, remainingMs);
  }, [isOverlayVisible, latestEntry]);

  React.useEffect(() => () => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
    }

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
  }, []);

  const beginLoading = React.useCallback((options: AppLoadingOptions = {}) => {
    const id = nextIdRef.current;
    nextIdRef.current += 1;

    const entry: AppLoadingEntry = {
      ...defaultLoadingEntry,
      ...options,
      detail: options.detail || defaultLoadingEntry.detail,
      message: options.message || defaultLoadingEntry.message,
      scope: options.scope || defaultLoadingEntry.scope,
      title: options.title || defaultLoadingEntry.title,
      id,
      startedAt: window.performance.now()
    };

    setEntries((currentEntries) => [...currentEntries, entry]);

    return () => {
      setEntries((currentEntries) => currentEntries.filter((currentEntry) => currentEntry.id !== id));
    };
  }, []);

  const withLoading = React.useCallback(async <T,>(
    operation: Promise<T> | (() => Promise<T>),
    options: AppLoadingOptions = {}
  ): Promise<T> => {
    const endLoading = beginLoading(options);

    try {
      return await (typeof operation === 'function' ? operation() : operation);
    } finally {
      endLoading();
    }
  }, [beginLoading]);

  const value = React.useMemo<AppLoadingContextValue>(() => ({
    beginLoading,
    isLoading: entries.length > 0,
    loadingCount: entries.length,
    withLoading
  }), [beginLoading, entries.length, withLoading]);

  return (
    <AppLoadingContext.Provider value={value}>
      {children}
      <AppLoadingOverlay entry={visibleEntry} isVisible={isOverlayVisible} loadingCount={entries.length} />
    </AppLoadingContext.Provider>
  );
}

export function useAppLoading(): AppLoadingContextValue {
  const context = React.useContext(AppLoadingContext);

  if (!context) {
    throw new Error('useAppLoading must be used within AppLoadingProvider.');
  }

  return context;
}

function AppLoadingOverlay({
  entry,
  isVisible,
  loadingCount
}: {
  entry: AppLoadingEntry | null;
  isVisible: boolean;
  loadingCount: number;
}) {
  if (!isVisible || !entry) {
    return null;
  }

  return createPortal((
    <div className="app-loading-overlay" role="status" aria-live="polite" aria-label={entry.title}>
      <div className="app-loading-card">
        <div className="app-loading-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
          <i />
        </div>
        <div className="app-loading-copy">
          <span>{getScopeLabel(entry.scope)}</span>
          <h2>{entry.title}</h2>
          <p>{entry.message}</p>
          <small>{entry.detail}</small>
        </div>
        <div className="app-loading-progress" aria-hidden="true">
          <span />
        </div>
        {loadingCount > 1 ? <em>{loadingCount} secure syncs active</em> : null}
      </div>
    </div>
  ), document.body);
}

function getScopeLabel(scope: AppLoadingScope): string {
  if (scope === 'lsw') {
    return 'LSW';
  }

  if (scope === 'rca') {
    return 'RCA';
  }

  if (scope === 'rails') {
    return 'RAILS';
  }

  return 'Synzapp';
}
