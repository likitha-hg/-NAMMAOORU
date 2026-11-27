import { useEffect, useState } from 'react';

interface GoogleMapsKeyState {
  apiKey: string;
  loading: boolean;
  configError: string;
  authFailed: boolean;
}

const MAPS_AUTH_FAILURE_EVENT = 'nammaooru-gmaps-auth-failure';

let cachedRuntimeKey: string | null = null;
let inflightKeyPromise: Promise<string> | null = null;
let authListenerInstalled = false;
let globalAuthFailed = false;

function installGlobalAuthFailureListener(): void {
  if (typeof window === 'undefined' || authListenerInstalled) return;
  authListenerInstalled = true;

  const win = window as unknown as { gm_authFailure?: () => void };
  const prevHandler = win.gm_authFailure;

  win.gm_authFailure = () => {
    globalAuthFailed = true;
    window.dispatchEvent(new CustomEvent(MAPS_AUTH_FAILURE_EVENT));
    if (typeof prevHandler === 'function') {
      try {
        prevHandler();
      } catch {
        // Ignore errors from chained handler
      }
    }
  };
}

function getBuildTimeMapsKey(): string {
  const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  if (envKey && envKey !== 'MY_GOOGLE_MAPS_API_KEY') {
    return envKey;
  }
  return '';
}

async function fetchRuntimeMapsKey(): Promise<string> {
  if (cachedRuntimeKey !== null) {
    return cachedRuntimeKey;
  }
  if (!inflightKeyPromise) {
    inflightKeyPromise = fetch('/api/maps/client-config', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
      .then(async (resp) => {
        if (!resp.ok) {
          throw new Error(`Unable to read Google Maps configuration (status ${resp.status}).`);
        }
        const data = (await resp.json()) as { apiKey?: string };
        const resolved = typeof data.apiKey === 'string' ? data.apiKey.trim() : '';
        cachedRuntimeKey = resolved;
        return resolved;
      })
      .finally(() => {
        inflightKeyPromise = null;
      });
  }
  return inflightKeyPromise;
}

/**
 * Resolves the configured Google Maps API key from either build-time Vite env
 * (GOOGLE_MAPS_API_KEY / VITE_GOOGLE_MAPS_API_KEY) or the Express runtime
 * config endpoint, and listens for Google Maps JavaScript API auth failures.
 */
export function useGoogleMapsApiKey(): GoogleMapsKeyState {
  const initialKey = getBuildTimeMapsKey() || cachedRuntimeKey || '';
  const [apiKey, setApiKey] = useState<string>(initialKey);
  const [loading, setLoading] = useState<boolean>(!initialKey);
  const [configError, setConfigError] = useState<string>('');
  const [authFailed, setAuthFailed] = useState<boolean>(globalAuthFailed);

  useEffect(() => {
    installGlobalAuthFailureListener();

    const handleAuthFailure = () => {
      setAuthFailed(true);
    };
    window.addEventListener(MAPS_AUTH_FAILURE_EVENT, handleAuthFailure);
    return () => {
      window.removeEventListener(MAPS_AUTH_FAILURE_EVENT, handleAuthFailure);
    };
  }, []);

  useEffect(() => {
    if (apiKey) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setConfigError('');

    fetchRuntimeMapsKey()
      .then((key) => {
        if (!cancelled) {
          setApiKey(key);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setConfigError(
            err instanceof Error
              ? err.message
              : 'Unable to load Google Maps configuration right now.'
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return { apiKey, loading, configError, authFailed };
}
