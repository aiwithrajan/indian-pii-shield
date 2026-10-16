import React, { useState, useRef, useEffect, useCallback } from 'react';

interface HeaderProps {
  statsTotalPii?: number;
  statsTotalRequests?: number;
  onRefreshAll?: () => void;
  proxyUrl?: string;
}

export const Header: React.FC<HeaderProps> = ({
  statsTotalPii = 0,
  statsTotalRequests = 0,
  onRefreshAll,
  proxyUrl = 'http://127.0.0.1:8080'
}) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [exportStatus, setExportStatus] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle');

  // Timeout cleanup refs to prevent stale timeouts from clearing newer statuses
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Clear timeouts on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      if (exportTimeoutRef.current) {
        clearTimeout(exportTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyProxyUrl = useCallback(async () => {
    // 1. Clear existing timeout before starting a new state lifecycle
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(proxyUrl);
      } else {
        throw new Error('Clipboard API unavailable');
      }

      if (!isMountedRef.current) return;
      setCopyStatus('copied');

      // Schedule status reset, storing the ID in ref
      copyTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setCopyStatus('idle');
        }
      }, 2500);
    } catch {
      if (!isMountedRef.current) return;
      setCopyStatus('error');

      copyTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setCopyStatus('idle');
        }
      }, 3000);
    }
  }, [proxyUrl]);

  const handleExportJson = useCallback(async () => {
    // 1. Clear existing timeout before starting a new export lifecycle
    if (exportTimeoutRef.current) {
      clearTimeout(exportTimeoutRef.current);
      exportTimeoutRef.current = null;
    }

    if (!isMountedRef.current) return;
    setExportStatus('downloading');

    try {
      const response = await fetch(`${proxyUrl}/api/ledger/export/json`);
      if (!response.ok) {
        throw new Error(`Export failed with HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `indian_pii_shield_ledger_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      if (!isMountedRef.current) return;
      setExportStatus('done');

      // Reset to idle after delay
      exportTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setExportStatus('idle');
        }
      }, 3000);
    } catch {
      if (!isMountedRef.current) return;
      setExportStatus('error');

      exportTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setExportStatus('idle');
        }
      }, 4000);
    }
  }, [proxyUrl]);

  return (
    <header className="bg-slate-950 border-b border-slate-800 text-slate-100 px-6 py-4 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white text-lg shadow-indigo-500/20 shadow-lg">
            🇮🇳
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-100">
                Indian-PII Shield
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-semibold">
                ACTIVE • FAIL-CLOSED
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Zero-Leakage On-Premise Gateway for Sovereign Indian Data
            </p>
          </div>
        </div>

        {/* Global Key Metrics */}
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-slate-400">
              PII Elements Stripped
            </span>
            <span className="text-sm font-mono font-bold text-indigo-400">
              {statsTotalPii.toLocaleString()}
            </span>
          </div>

          <div className="text-right hidden sm:block">
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-slate-400">
              Proxied Requests
            </span>
            <span className="text-sm font-mono font-bold text-cyan-400">
              {statsTotalRequests.toLocaleString()}
            </span>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyProxyUrl}
              className="px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-200 transition-colors flex items-center gap-1.5 shadow-sm"
              title="Copy local proxy base URL to clipboard"
            >
              <span>📋</span>
              <span>
                {copyStatus === 'copied'
                  ? 'Copied URL!'
                  : copyStatus === 'error'
                  ? 'Copy Failed'
                  : 'Copy Proxy URL'}
              </span>
            </button>

            <button
              onClick={handleExportJson}
              disabled={exportStatus === 'downloading'}
              className="px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-200 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              title="Export sanitized audit ledger as JSON"
            >
              <span>📥</span>
              <span>
                {exportStatus === 'downloading'
                  ? 'Exporting...'
                  : exportStatus === 'done'
                  ? 'Export Ready'
                  : exportStatus === 'error'
                  ? 'Export Error'
                  : 'Export Ledger'}
              </span>
            </button>

            {onRefreshAll && (
              <button
                onClick={onRefreshAll}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-300 hover:text-white transition-colors"
                title="Refresh dashboard metrics"
              >
                🔄
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
