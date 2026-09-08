import React from 'react';

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


const defaultLoadingEntry: Omit<AppLoadingEntry, 'id' | 'startedAt'> = {
  detail: 'Preparing your enterprise workspace',
  message: 'Syncing secure operational data',
  scope: 'app',
  title: 'Loading Synzapp'
};

const AppLoadingContext = React.createContext<AppLoadingContextValue | null>(null);

/**
 * Progress is reported by the screens themselves, not by an overlay.
 *
 * A card used to cover the whole window saying "Loading RCA workspace". Pages
 * come back fast enough that it appeared and vanished, which reads as a flicker
 * rather than as progress — and while it was up it covered the very thing
 * somebody had just asked for.
 *
 * The context is deliberately kept. Twenty-two places across LSW, RAILS, RCA
 * and the shell call `beginLoading`, and they still do: `isLoading` and
 * `loadingCount` stay true and correct for any screen that wants its own quiet
 * indicator. Only the overlay is gone.
 */
export function AppLoadingProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<AppLoadingEntry[]>([]);
  const nextIdRef = React.useRef(1);

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

