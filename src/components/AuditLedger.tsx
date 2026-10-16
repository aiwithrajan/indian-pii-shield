import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchLedger, LedgerEntry } from '../lib/api';

interface AuditLedgerProps {
  autoRefreshIntervalMs?: number;
}

export const AuditLedger: React.FC<AuditLedgerProps> = ({ autoRefreshIntervalMs = 8000 }) => {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(50);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);

  // Request race condition guards
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const loadLedger = useCallback(async (requestedLimit: number) => {
    // 1. Cancel previous in-flight request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentRequestId = ++activeRequestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchLedger(requestedLimit, controller.signal);

      // 2. Race condition check: Ensure this response belongs to the latest request
      if (!isMountedRef.current || currentRequestId !== activeRequestIdRef.current) {
        return;
      }

      setEntries(data);
      setIsLoading(false);
    } catch (err: any) {
      // 3. AbortError must never overwrite state or trigger error banners
      if (err.name === 'AbortError' || !isMountedRef.current) {
        return;
      }

      if (currentRequestId === activeRequestIdRef.current) {
        setError(err.message || 'Failed to load ledger records');
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadLedger(limit);

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [limit, loadLedger]);

  // Periodic polling guard
  useEffect(() => {
    if (!isAutoRefresh || autoRefreshIntervalMs <= 0) return;

    const intervalId = setInterval(() => {
      loadLedger(limit);
    }, autoRefreshIntervalMs);

    return () => clearInterval(intervalId);
  }, [isAutoRefresh, autoRefreshIntervalMs, limit, loadLedger]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm text-slate-100">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>📜</span> Redaction Audit Ledger
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Zero Raw PII Persistence • Audited Metadata &amp; Masked Counters Only
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isAutoRefresh}
              onChange={(e) => setIsAutoRefresh(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-0"
            />
            <span>Live Sync</span>
          </label>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-slate-800 text-slate-200 text-xs rounded border border-slate-700 px-2.5 py-1 focus:outline-none focus:border-indigo-500"
          >
            <option value={20}>20 entries</option>
            <option value={50}>50 entries</option>
            <option value={100}>100 entries</option>
          </select>

          <button
            onClick={() => loadLedger(limit)}
            disabled={isLoading}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-200 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Untrusted Data Notice */}
      <div className="mb-4 p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg text-amber-200/90 text-xs">
        <span className="font-semibold text-amber-300">Security Boundary Notice:</span> Masked samples below are treated as untrusted text. Backend guarantees must prevent raw PII persistence at the storage layer; frontend masking does not establish compliance or data isolation.
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-200 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => loadLedger(limit)}
            className="underline hover:text-rose-100 font-semibold ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table / List */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3 font-semibold">Timestamp</th>
              <th className="py-2.5 px-3 font-semibold">Masked Prompt Snippet</th>
              <th className="py-2.5 px-3 font-semibold">Entities Stripped</th>
              <th className="py-2.5 px-3 font-semibold">Latency</th>
              <th className="py-2.5 px-3 font-semibold">Model</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading && entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  Loading verified ledger entries...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  No audit entries recorded yet. Send prompts to the proxy to populate.
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const countEntries = Object.entries(entry.pii_counts);
                return (
                  <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {entry.timestamp}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-200 max-w-xs truncate">
                      {/* Untrusted content rendered safely via text node, strictly escaped */}
                      {entry.masked_sample || <span className="text-slate-600 italic">No text logged</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      {countEntries.length === 0 ? (
                        <span className="text-slate-500">0</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {countEntries.map(([type, count]) => (
                            <span
                              key={type}
                              className="px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 text-[10px] font-mono font-medium"
                            >
                              {type}:{count}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-400">
                      {entry.latency_ms.toFixed(1)}ms
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 text-[11px]">
                      {entry.model_version}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
