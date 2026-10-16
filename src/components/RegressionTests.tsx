import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchCorrections,
  submitCorrection,
  CorrectionItem,
  ExpectedSpan,
  ApiError,
  ApiValidationError
} from '../lib/api';

export const RegressionTests: React.FC = () => {
  const [tests, setTests] = useState<CorrectionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [inputText, setInputText] = useState<string>('');
  const [piiType, setPiiType] = useState<string>('AADHAAR');
  const [userNote, setUserNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Request race condition guards
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Form submission abort guard
  const submitAbortControllerRef = useRef<AbortController | null>(null);

  const loadTests = useCallback(async () => {
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
      const data = await fetchCorrections(controller.signal);

      // 2. Race condition check: Ensure this response belongs to the latest request and component is mounted
      if (!isMountedRef.current || currentRequestId !== activeRequestIdRef.current) {
        return;
      }

      setTests(data);
      setIsLoading(false);
    } catch (err: any) {
      // 3. AbortError must never overwrite state or leave loading stuck
      if (err.name === 'AbortError' || !isMountedRef.current) {
        return;
      }

      if (currentRequestId === activeRequestIdRef.current) {
        const message = err instanceof ApiError || err instanceof ApiValidationError
          ? err.message
          : 'Failed to load regression test suite';
        setError(message);
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadTests();

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (submitAbortControllerRef.current) {
        submitAbortControllerRef.current.abort();
      }
    };
  }, [loadTests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (submitAbortControllerRef.current) {
      submitAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    submitAbortControllerRef.current = controller;

    setIsSubmitting(true);
    setError(null);
    setSubmitSuccess(null);

    const expectedSpans: ExpectedSpan[] = [{ pii_type: piiType }];

    try {
      const result = await submitCorrection(
        {
          input_text: inputText.trim(),
          expected_spans: expectedSpans,
          user_note: userNote.trim() || undefined
        },
        controller.signal
      );

      if (!isMountedRef.current) return;

      setSubmitSuccess(`Correction registered as test #${result.test_id}`);
      setInputText('');
      setUserNote('');
      setIsSubmitting(false);

      // Refresh test list safely using the race-guarded loadTests
      loadTests();
    } catch (err: any) {
      if (err.name === 'AbortError' || !isMountedRef.current) {
        return;
      }
      const message = err instanceof ApiError || err instanceof ApiValidationError
        ? err.message
        : 'Failed to record correction';
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>🧪</span> Regression Test Suite
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Turn false positives or negatives into permanent, automated regression assertions
          </p>
        </div>
        <button
          onClick={() => loadTests()}
          disabled={isLoading}
          className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-200 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Syncing...' : 'Reload Suite'}
        </button>
      </div>

      {/* Submission Form */}
      <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-950/70 border border-slate-800 rounded-lg">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
          Record Feedback / Correction
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Sample Prompt Text (with PII pattern to lock down)
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. Mere dada ji ka Aadhaar 1234 5678 9012 hai..."
              rows={2}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-600 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target PII Entity Type</label>
              <select
                value={piiType}
                onChange={(e) => setPiiType(e.target.value)}
                className="w-full bg-slate-900 text-slate-200 text-xs rounded border border-slate-700 p-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="AADHAAR">AADHAAR (Verhoeff Checksum)</option>
                <option value="PAN">PAN (Income Tax Number)</option>
                <option value="GSTIN">GSTIN (Modulo-36)</option>
                <option value="PHONE">PHONE (Indian Mobile/Landline)</option>
                <option value="UPI">UPI (VPA Address)</option>
                <option value="IFSC">IFSC (Bank Code)</option>
                <option value="NAME">NAME (Contextual Indian Name)</option>
                <option value="ADDRESS">ADDRESS (Indian Postal/Landmark)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Context Note / Rationale</label>
              <input
                type="text"
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder="e.g. Spoken Hindi number pattern missed"
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              Saved corrections are locked into local regression tests and cannot regress.
            </span>
            <button
              type="submit"
              disabled={isSubmitting || !inputText.trim()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm"
            >
              {isSubmitting ? 'Saving...' : 'Lock as Regression Test'}
            </button>
          </div>
        </div>

        {submitSuccess && (
          <div className="mt-3 p-2 bg-emerald-950/40 border border-emerald-800/60 rounded text-emerald-300 text-xs">
            ✓ {submitSuccess}
          </div>
        )}
      </form>

      {/* Error state */}
      {error && (
        <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-200 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => loadTests()}
            className="underline hover:text-rose-100 font-semibold ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Test cases list */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Locked Regression Test Cases ({tests.length})
        </h3>

        {isLoading && tests.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            Loading locked regression suite...
          </div>
        ) : tests.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs bg-slate-950/30 rounded-lg border border-slate-800/50">
            No custom regression tests recorded yet. Submit edge cases above to build the test suite.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {tests.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-950/50 border border-slate-800/70 rounded-lg hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                      {item.id}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {item.timestamp}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {item.expected_spans.map((span, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 text-[10px] font-mono font-medium"
                      >
                        {span.pii_type}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="font-mono text-xs text-slate-200 bg-slate-900/90 p-2 rounded border border-slate-800">
                  {/* Safely escaped via standard text node */}
                  {item.input_text}
                </div>

                {item.user_note && (
                  <p className="text-[11px] text-slate-400 mt-1.5 italic">
                    Note: {item.user_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
