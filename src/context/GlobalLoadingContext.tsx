import BrandLoader from '../components/BrandLoader';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface GlobalLoadingContextValue {
  count: number;
  start: () => void;
  stop: () => void;
  withLoading: <T>(fn: () => Promise<T>) => Promise<T>;
}

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | undefined>(undefined);

export const GlobalLoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);

  const start = useCallback(() => {
    setCount(c => c + 1);
  }, []);
  const stop = useCallback(() => {
    setCount(c => Math.max(0, c - 1));
  }, []);

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      start();
      try {
        return await fn();
      } finally {
        stop();
      }
    },
    [start, stop]
  );

  // Avoid flashes for fast requests; never keep a completed operation loading.
  useEffect(() => {
    if (count === 0) { setVisible(false); return; }
    const timer = setTimeout(() => setVisible(true), 180);
    return () => clearTimeout(timer);
  }, [count]);

  useRegisterGlobalLoading({ count, start, stop, withLoading });

  return (
    <GlobalLoadingContext.Provider value={{ count, start, stop, withLoading }}>
      {children}
      {visible && count > 0 && <div className="gc-loading-overlay"><BrandLoader compact label="Mise à jour de vos courriers…"/></div>}
    </GlobalLoadingContext.Provider>
  );
};

export const useGlobalLoading = (): GlobalLoadingContextValue => {
  const ctx = useContext(GlobalLoadingContext);
  if (!ctx) {
    throw new Error('useGlobalLoading must be used within GlobalLoadingProvider');
  }
  return ctx;
};

// Helpers utilisables dans les services (hors React)
let externalStart: (() => void) | null = null;
let externalStop: (() => void) | null = null;
let externalWithLoading: (<T>(fn: () => Promise<T>) => Promise<T>) | null = null;

export const registerGlobalLoading = (api: GlobalLoadingContextValue) => {
  externalStart = api.start;
  externalStop = api.stop;
  externalWithLoading = api.withLoading;
};

// Auto-enregistrement quand le provider est monté
export const useRegisterGlobalLoading = (value: GlobalLoadingContextValue) => {
  React.useEffect(() => {
    registerGlobalLoading(value);
  }, [value]);
};

export const globalLoading = {
  start: () => externalStart?.(),
  stop: () => externalStop?.(),
  withLoading: async <T,>(fn: () => Promise<T>) =>
    externalWithLoading ? externalWithLoading(fn) : fn(),
};
