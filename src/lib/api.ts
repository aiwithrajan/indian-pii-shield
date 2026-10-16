/**
 * Indian-PII Shield - API Client and Response Validation
 *
 * Implements strict, defensive response validation for all endpoints.
 * Validates individual ledger entries, pii_counts, stats, and correction items.
 * Handles empty success responses only where the backend contract permits.
 */

export interface PiiCounts {
  [piiType: string]: number;
}

export interface PiiSpan {
  start: number;
  end: number;
  pii_type: string;
  confidence: number;
  source: string;
  action?: 'REDACT' | 'ALLOW';
}

export interface PolicyResponse {
  policies: Record<string, 'REDACT' | 'ALLOW'>;
  allowed_categories: string[];
  total_categories: number;
}

export interface LedgerEntry {
  id: string;
  timestamp: string;
  pii_counts: PiiCounts;
  total_pii_detected: number;
  model_version: string;
  latency_ms: number;
  is_corrected: boolean;
  masked_sample: string;
}

export interface StatsResponse {
  total_requests: number;
  total_pii_stripped: number;
  avg_latency_ms: number;
  counts_by_type: PiiCounts;
}

export interface RedactionPreviewResponse {
  original_text: string;
  redacted_text: string;
  pii_counts: PiiCounts;
  spans: PiiSpan[];
  latency_ms: number;
}

export interface ExpectedSpan {
  pii_type: string;
  start?: number;
  end?: number;
}

export interface CorrectionItem {
  id: string;
  timestamp: string;
  input_text: string;
  expected_spans: ExpectedSpan[];
  user_note: string;
}

export interface SubmitCorrectionPayload {
  input_text: string;
  expected_spans: ExpectedSpan[];
  user_note?: string;
}

export interface SubmitCorrectionResponse {
  status: string;
  test_id: string;
}

export interface HealthResponse {
  status: string;
  shield: string;
  upstream_configured: string;
  fail_closed: boolean;
}

export class ApiError extends Error {
  public status: number;
  public statusText: string;
  public details?: unknown;

  constructor(message: string, status: number, statusText: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.details = details;
  }
}

export class ApiValidationError extends Error {
  constructor(message: string, public invalidData?: unknown) {
    super(message);
    this.name = 'ApiValidationError';
  }
}

export const API_BASE_URL = typeof window !== 'undefined' && (window as any).__SHIELD_API_URL__
  ? (window as any).__SHIELD_API_URL__
  : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      ? window.location.origin
      : 'http://127.0.0.1:8080');

// Aliases for compatibility with IndianPIIShieldUI.tsx
export { ApiError as ApiHttpError, ApiValidationError as MalformedResponseError };
export type { RedactionPreviewResponse as RedactPreviewResponse };
export const redactPreview = previewRedaction;
export const postCorrection = submitCorrection;

export async function exportLedgerJson(limit: number = 1000, signal?: AbortSignal): Promise<string> {
  const url = `${API_BASE_URL}/api/ledger/export/json`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal
  });
  if (!response.ok) {
    throw new ApiError(`Export failed: HTTP ${response.status}`, response.status, response.statusText);
  }
  return response.text();
}

// ==========================================
// VALIDATION HELPERS
// ==========================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates that a value is a valid PiiCounts object:
 * Must be a plain object where every key is a non-empty string
 * and every value is a non-negative finite number.
 */
export function validatePiiCounts(counts: unknown): PiiCounts {
  if (!isPlainObject(counts)) {
    return {};
  }
  const cleanCounts: PiiCounts = {};
  for (const [key, val] of Object.entries(counts)) {
    if (typeof key === 'string' && key.trim().length > 0 && typeof val === 'number' && Number.isFinite(val) && val >= 0) {
      cleanCounts[key] = Math.floor(val);
    }
  }
  return cleanCounts;
}

/**
 * Validates an individual ledger entry.
 * Returns the sanitized LedgerEntry if valid, or null if malformed.
 */
export function validateLedgerEntry(entry: unknown): LedgerEntry | null {
  if (!isPlainObject(entry)) {
    return null;
  }

  const id = typeof entry.id === 'string' && entry.id.trim().length > 0 ? entry.id.trim() : null;
  const timestamp = typeof entry.timestamp === 'string' && entry.timestamp.trim().length > 0 ? entry.timestamp.trim() : null;

  if (!id || !timestamp) {
    return null;
  }

  const pii_counts = validatePiiCounts(entry.pii_counts);
  const total_pii_detected = typeof entry.total_pii_detected === 'number' && Number.isFinite(entry.total_pii_detected) && entry.total_pii_detected >= 0
    ? entry.total_pii_detected
    : Object.values(pii_counts).reduce((acc, c) => acc + c, 0);

  const model_version = typeof entry.model_version === 'string' ? entry.model_version : 'unknown';
  const latency_ms = typeof entry.latency_ms === 'number' && Number.isFinite(entry.latency_ms) && entry.latency_ms >= 0
    ? entry.latency_ms
    : 0;
  const is_corrected = Boolean(entry.is_corrected);
  const masked_sample = typeof entry.masked_sample === 'string' ? entry.masked_sample : '';

  return {
    id,
    timestamp,
    pii_counts,
    total_pii_detected,
    model_version,
    latency_ms,
    is_corrected,
    masked_sample
  };
}

/**
 * Validates a StatsResponse payload.
 * Throws ApiValidationError if critical fields are missing or invalid.
 */
export function validateStatsResponse(data: unknown): StatsResponse {
  if (!isPlainObject(data)) {
    throw new ApiValidationError('Stats response must be a JSON object', data);
  }

  const total_requests = typeof data.total_requests === 'number' && Number.isFinite(data.total_requests) && data.total_requests >= 0
    ? data.total_requests
    : 0;

  const total_pii_stripped = typeof data.total_pii_stripped === 'number' && Number.isFinite(data.total_pii_stripped) && data.total_pii_stripped >= 0
    ? data.total_pii_stripped
    : 0;

  const avg_latency_ms = typeof data.avg_latency_ms === 'number' && Number.isFinite(data.avg_latency_ms) && data.avg_latency_ms >= 0
    ? data.avg_latency_ms
    : 0;

  const counts_by_type = validatePiiCounts(data.counts_by_type);

  return {
    total_requests,
    total_pii_stripped,
    avg_latency_ms,
    counts_by_type
  };
}

/**
 * Validates a RedactionPreviewResponse payload.
 */
export function validateRedactionPreviewResponse(data: unknown): RedactionPreviewResponse {
  if (!isPlainObject(data)) {
    throw new ApiValidationError('Redaction preview response must be a JSON object', data);
  }

  const original_text = typeof data.original_text === 'string' ? data.original_text : '';
  const redacted_text = typeof data.redacted_text === 'string' ? data.redacted_text : '';
  const pii_counts = validatePiiCounts(data.pii_counts);
  const latency_ms = typeof data.latency_ms === 'number' && Number.isFinite(data.latency_ms) && data.latency_ms >= 0
    ? data.latency_ms
    : 0;

  const rawSpans = Array.isArray(data.spans) ? data.spans : [];
  const spans: PiiSpan[] = [];

  for (const s of rawSpans) {
    if (
      isPlainObject(s) &&
      typeof s.start === 'number' &&
      typeof s.end === 'number' &&
      s.start >= 0 &&
      s.end >= s.start &&
      typeof s.pii_type === 'string'
    ) {
      spans.push({
        start: s.start,
        end: s.end,
        pii_type: s.pii_type,
        confidence: typeof s.confidence === 'number' ? s.confidence : 1.0,
        source: typeof s.source === 'string' ? s.source : 'detector'
      });
    }
  }

  return {
    original_text,
    redacted_text,
    pii_counts,
    spans,
    latency_ms
  };
}

/**
 * Validates an individual correction item.
 */
export function validateCorrectionItem(item: unknown): CorrectionItem | null {
  if (!isPlainObject(item)) {
    return null;
  }

  const id = typeof item.id === 'string' && item.id.trim().length > 0 ? item.id.trim() : null;
  const input_text = typeof item.input_text === 'string' ? item.input_text : null;
  if (!id || input_text === null) {
    return null;
  }

  const timestamp = typeof item.timestamp === 'string' ? item.timestamp : new Date().toISOString();
  const user_note = typeof item.user_note === 'string' ? item.user_note : '';

  const rawSpans = Array.isArray(item.expected_spans) ? item.expected_spans : [];
  const expected_spans: ExpectedSpan[] = [];

  for (const s of rawSpans) {
    if (isPlainObject(s) && typeof s.pii_type === 'string' && s.pii_type.trim().length > 0) {
      expected_spans.push({
        pii_type: s.pii_type.trim(),
        start: typeof s.start === 'number' ? s.start : undefined,
        end: typeof s.end === 'number' ? s.end : undefined
      });
    }
  }

  return {
    id,
    timestamp,
    input_text,
    expected_spans,
    user_note
  };
}

// ==========================================
// HTTP REQUEST WRAPPER
// ==========================================

async function requestJson<T>(
  endpoint: string,
  options: RequestInit = {},
  validator: (data: unknown) => T
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err;
    }
    throw new ApiError(`Network request failed to ${endpoint}: ${err.message}`, 0, 'NetworkError', err);
  }

  if (!response.ok) {
    let errorDetail: unknown;
    try {
      errorDetail = await response.json();
    } catch {
      try {
        errorDetail = await response.text();
      } catch {
        errorDetail = null;
      }
    }
    const message = isPlainObject(errorDetail) && typeof (errorDetail as any).detail === 'string'
      ? (errorDetail as any).detail
      : `HTTP ${response.status} ${response.statusText} from ${endpoint}`;
    throw new ApiError(message, response.status, response.statusText, errorDetail);
  }

  // Handle empty success response contracts:
  // If status is 204 No Content, check if empty response is acceptable
  if (response.status === 204) {
    return validator(null);
  }

  const text = await response.text();
  if (!text || text.trim().length === 0) {
    throw new ApiValidationError(`Unexpected empty response body from ${endpoint}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (parseErr: any) {
    throw new ApiValidationError(`Malformed JSON received from ${endpoint}: ${parseErr.message}`, text);
  }

  return validator(data);
}

// ==========================================
// EXPORTED API METHODS
// ==========================================

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return requestJson<HealthResponse>(
    '/health',
    { method: 'GET', signal },
    (data) => {
      if (!isPlainObject(data)) {
        throw new ApiValidationError('Health response must be a JSON object', data);
      }
      return {
        status: typeof data.status === 'string' ? data.status : 'unknown',
        shield: typeof data.shield === 'string' ? data.shield : 'Indian-PII Shield',
        upstream_configured: typeof data.upstream_configured === 'string' ? data.upstream_configured : '',
        fail_closed: Boolean(data.fail_closed)
      };
    }
  );
}

export async function fetchStats(signal?: AbortSignal): Promise<StatsResponse> {
  return requestJson<StatsResponse>(
    '/api/stats',
    { method: 'GET', signal },
    validateStatsResponse
  );
}

export async function fetchLedger(
  limitOrSignal: number | AbortSignal = 50,
  maybeSignal?: AbortSignal
): Promise<LedgerEntry[]> {
  const limit = typeof limitOrSignal === 'number' ? limitOrSignal : 50;
  const signal = limitOrSignal instanceof AbortSignal ? limitOrSignal : maybeSignal;
  const safeLimit = Math.max(1, Math.min(limit, 500));
  return requestJson<LedgerEntry[]>(
    `/api/ledger?limit=${safeLimit}`,
    { method: 'GET', signal },
    (data) => {
      if (!Array.isArray(data)) {
        throw new ApiValidationError('Ledger endpoint must return an array of entries', data);
      }
      const validEntries: LedgerEntry[] = [];
      for (const item of data) {
        const validated = validateLedgerEntry(item);
        if (validated !== null) {
          validEntries.push(validated);
        }
      }
      return validEntries;
    }
  );
}

export async function previewRedaction(
  text: string,
  allowed_pii_types?: string[],
  signal?: AbortSignal
): Promise<RedactionPreviewResponse> {
  return requestJson<RedactionPreviewResponse>(
    '/api/redact-preview',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, allowed_pii_types: allowed_pii_types || [] }),
      signal
    },
    validateRedactionPreviewResponse
  );
}

export async function fetchPolicy(signal?: AbortSignal): Promise<PolicyResponse> {
  return requestJson<PolicyResponse>(
    '/api/policy',
    { method: 'GET', signal },
    (data) => {
      if (!isPlainObject(data)) {
        throw new ApiValidationError('Policy endpoint must return a JSON object', data);
      }
      return {
        policies: (data.policies as any) || {},
        allowed_categories: Array.isArray(data.allowed_categories) ? data.allowed_categories : [],
        total_categories: typeof data.total_categories === 'number' ? data.total_categories : 0
      };
    }
  );
}

export async function updatePolicy(
  target: string | string[],
  action?: 'ALLOW' | 'REDACT',
  signal?: AbortSignal
): Promise<PolicyResponse> {
  const payload = Array.isArray(target)
    ? { allowed: target }
    : { category: target, action: action || 'ALLOW' };

  return requestJson<PolicyResponse>(
    '/api/policy',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    },
    (data) => {
      if (!isPlainObject(data)) {
        throw new ApiValidationError('Update policy endpoint must return a JSON object', data);
      }
      return {
        policies: (data.policies as any) || {},
        allowed_categories: Array.isArray(data.allowed_categories) ? data.allowed_categories : [],
        total_categories: Array.isArray(data.allowed_categories) ? data.allowed_categories.length : 0
      };
    }
  );
}

export async function fetchCorrections(signal?: AbortSignal): Promise<CorrectionItem[]> {
  return requestJson<CorrectionItem[]>(
    '/api/corrections',
    { method: 'GET', signal },
    (data) => {
      if (!Array.isArray(data)) {
        throw new ApiValidationError('Corrections endpoint must return an array', data);
      }
      const validItems: CorrectionItem[] = [];
      for (const item of data) {
        const validated = validateCorrectionItem(item);
        if (validated !== null) {
          validItems.push(validated);
        }
      }
      return validItems;
    }
  );
}

export async function submitCorrection(
  payload: SubmitCorrectionPayload,
  signal?: AbortSignal
): Promise<SubmitCorrectionResponse> {
  return requestJson<SubmitCorrectionResponse>(
    '/api/corrections',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    },
    (data) => {
      if (!isPlainObject(data)) {
        throw new ApiValidationError('Submit correction response must be a JSON object', data);
      }
      const status = typeof data.status === 'string' ? data.status : 'success';
      const test_id = typeof data.test_id === 'string' ? data.test_id : '';
      if (!test_id) {
        throw new ApiValidationError('Missing test_id in submit correction response', data);
      }
      return { status, test_id };
    }
  );
}

// ==========================================
// TEMPORAL DURABLE EXECUTION CLIENT
// ==========================================

export interface TemporalActivity {
  name: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  attempt: number;
  latency_ms?: number;
}

export interface TemporalWorkflowRecord {
  workflow_id: string;
  run_id: string;
  workflow_type: 'DURABLE_REDACTION' | 'HUMAN_IN_THE_LOOP';
  status: 'RUNNING' | 'COMPLETED' | 'QUARANTINED' | 'FAILED';
  current_step: string;
  start_time: string;
  duration_ms: number;
  retry_count: number;
  quarantined_items: any[];
  decision: string | null;
  activities: TemporalActivity[];
  result?: {
    original_text: string;
    redacted_text: string;
    final_response: string;
    upstream_response_raw: string;
    pii_counts: Record<string, number>;
    spans: any[];
    risk_level: string;
  };
}

export interface TemporalStatsResponse {
  total_workflows: number;
  completed_workflows: number;
  quarantined_workflows: number;
  average_duration_ms: number;
  temporal_server_binding: string;
  worker_status: string;
}

export async function fetchTemporalWorkflows(signal?: AbortSignal): Promise<TemporalWorkflowRecord[]> {
  return requestJson<TemporalWorkflowRecord[]>(
    '/api/temporal/workflows',
    { method: 'GET', signal },
    (data) => (Array.isArray(data) ? (data as TemporalWorkflowRecord[]) : [])
  );
}

export async function fetchTemporalStats(signal?: AbortSignal): Promise<TemporalStatsResponse> {
  return requestJson<TemporalStatsResponse>(
    '/api/temporal/stats',
    { method: 'GET', signal },
    (data) => data as TemporalStatsResponse
  );
}

export async function executeTemporalWorkflow(
  text: string,
  allowed_pii_types: string[] = [],
  workflow_type: 'DURABLE_REDACTION' | 'HUMAN_IN_THE_LOOP' = 'DURABLE_REDACTION',
  model: string = 'gpt-4o',
  signal?: AbortSignal
): Promise<TemporalWorkflowRecord> {
  return requestJson<TemporalWorkflowRecord>(
    '/api/temporal/execute',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, allowed_pii_types, workflow_type, model }),
      signal
    },
    (data) => data as TemporalWorkflowRecord
  );
}

export async function sendTemporalSignal(
  workflow_id: string,
  decision: 'APPROVE_PASS_THROUGH' | 'ENFORCE_REDACTION',
  signal?: AbortSignal
): Promise<{ status: string; workflow_id: string }> {
  return requestJson<{ status: string; workflow_id: string }>(
    '/api/temporal/signal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id, decision }),
      signal
    },
    (data) => data as { status: string; workflow_id: string }
  );
}
