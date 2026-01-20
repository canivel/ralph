/**
 * API client for Ralph Dashboard
 * Provides typed functions for all REST API endpoints
 */

import type { Project, Prd, Story } from '@/stores/projectStore';

// ============================================================================
// Types
// ============================================================================

/**
 * Activity event from the activity log
 */
export interface ActivityEvent {
  timestamp: string;
  message: string;
  type: 'iteration_start' | 'iteration_end' | 'other';
}

/**
 * Error entry from the errors log
 */
export interface ErrorEntry {
  timestamp: string;
  message: string;
  iteration?: number;
}

/**
 * Run metadata from .ralph/runs/
 */
export interface RunMeta {
  runId: string;
  iteration: number;
  storyId: string;
  storyTitle: string;
  duration: number;
  status: 'success' | 'failed' | 'running';
  commits?: string[];
  changedFiles?: string[];
}

/**
 * Pagination info returned by paginated endpoints
 */
export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  pagination: Pagination;
  [key: string]: T[] | Pagination;
}

/**
 * Runs list response
 */
export interface RunsResponse {
  runs: RunMeta[];
  pagination: Pagination;
}

/**
 * Activity events response
 */
export interface ActivityResponse {
  events: ActivityEvent[];
  pagination: Pagination;
}

/**
 * Errors response
 */
export interface ErrorsResponse {
  errors: ErrorEntry[];
  pagination: Pagination;
}

/**
 * Log content response (raw mode)
 */
export interface LogContentResponse {
  content: string;
  lines: string[];
  pagination: Pagination;
  truncated: boolean;
  truncatedMessage?: string;
}

/**
 * Progress data structure
 */
export interface ProgressData {
  content: string;
  patterns: string[];
  stories: Array<{
    id: string;
    title: string;
    summary: string;
  }>;
}

/**
 * Guardrails data structure
 */
export interface GuardrailsData {
  content: string;
  signs: Array<{
    title: string;
    description: string;
  }>;
}

/**
 * Metrics data
 */
export interface MetricsData {
  storyCount: number;
  doneCount: number;
  openCount: number;
  inProgressCount: number;
  totalIterations: number;
  runningIterations: number;
}

/**
 * API error with user-friendly message
 */
export class ApiError extends Error {
  status: number;
  statusText: string;
  userMessage: string;

  constructor(status: number, statusText: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.userMessage = getErrorMessage(status, message);
  }
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Map HTTP status codes and error messages to user-friendly messages
 */
function getErrorMessage(status: number, serverMessage: string): string {
  switch (status) {
    case 400:
      return serverMessage || 'Invalid request. Please check your input.';
    case 404:
      return serverMessage || 'The requested resource was not found.';
    case 409:
      return serverMessage || 'This resource already exists.';
    case 500:
      return 'An unexpected server error occurred. Please try again.';
    case 502:
    case 503:
    case 504:
      return 'The server is temporarily unavailable. Please try again later.';
    default:
      if (status >= 400 && status < 500) {
        return serverMessage || 'There was a problem with your request.';
      }
      if (status >= 500) {
        return 'A server error occurred. Please try again later.';
      }
      return serverMessage || 'An unexpected error occurred.';
  }
}

/**
 * Parse error response from API
 */
async function parseError(response: Response): Promise<ApiError> {
  let message = response.statusText;
  try {
    const data = await response.json();
    message = data.error || data.message || message;
  } catch {
    // Response may not be JSON
  }
  return new ApiError(response.status, response.statusText, message);
}

// ============================================================================
// Base API Functions
// ============================================================================

/**
 * Get the API base URL
 * In development with Vite proxy, use relative paths
 * In production, the API is served from the same origin
 */
function getBaseUrl(): string {
  // Use relative paths - Vite proxy handles routing to backend in dev
  return '/api';
}

/**
 * Make a GET request to the API
 */
async function get<T>(path: string): Promise<T> {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}${path}`);

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.json();
}

/**
 * Make a POST request to the API
 */
async function post<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.json();
}

/**
 * Make a DELETE request to the API
 */
async function del(path: string): Promise<void> {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw await parseError(response);
  }
}

// ============================================================================
// Projects API
// ============================================================================

/**
 * Fetch all registered projects with computed status fields
 */
export async function getProjects(): Promise<Project[]> {
  return get<Project[]>('/projects');
}

/**
 * Fetch a single project by ID with full PRD data
 */
export async function getProject(id: string): Promise<Project> {
  return get<Project>(`/projects/${encodeURIComponent(id)}`);
}

/**
 * Register a new project
 */
export async function registerProject(
  path: string,
  name?: string
): Promise<Project> {
  return post<Project>('/projects', { path, name });
}

/**
 * Unregister a project
 */
export async function deleteProject(id: string): Promise<void> {
  return del(`/projects/${encodeURIComponent(id)}`);
}

/**
 * Fetch PRD data for a project
 */
export async function getPrd(projectId: string): Promise<Prd> {
  return get<Prd>(`/projects/${encodeURIComponent(projectId)}/prd`);
}

/**
 * Fetch stories for a project
 */
export async function getStories(projectId: string): Promise<Story[]> {
  return get<Story[]>(`/projects/${encodeURIComponent(projectId)}/stories`);
}

/**
 * Fetch progress.md data for a project
 */
export async function getProgress(projectId: string): Promise<ProgressData> {
  return get<ProgressData>(`/projects/${encodeURIComponent(projectId)}/progress`);
}

/**
 * Fetch guardrails.md data for a project
 */
export async function getGuardrails(projectId: string): Promise<GuardrailsData> {
  return get<GuardrailsData>(
    `/projects/${encodeURIComponent(projectId)}/guardrails`
  );
}

/**
 * Fetch metrics for a project
 */
export async function getMetrics(projectId: string): Promise<MetricsData> {
  return get<MetricsData>(`/projects/${encodeURIComponent(projectId)}/metrics`);
}

// ============================================================================
// Runs API
// ============================================================================

/**
 * Fetch run history for a project
 */
export async function getRuns(
  projectId: string,
  options?: { limit?: number; offset?: number }
): Promise<RunsResponse> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  if (options?.offset !== undefined) {
    params.set('offset', String(options.offset));
  }

  const query = params.toString();
  const path = `/projects/${encodeURIComponent(projectId)}/runs${query ? `?${query}` : ''}`;
  return get<RunsResponse>(path);
}

/**
 * Fetch a specific run by ID
 */
export async function getRun(
  projectId: string,
  runId: string
): Promise<RunMeta> {
  return get<RunMeta>(
    `/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(runId)}`
  );
}

/**
 * Fetch run log content
 */
export async function getRunLog(
  projectId: string,
  runId: string,
  options?: { limit?: number; offset?: number }
): Promise<LogContentResponse> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  if (options?.offset !== undefined) {
    params.set('offset', String(options.offset));
  }

  const query = params.toString();
  const path = `/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(runId)}/log${query ? `?${query}` : ''}`;
  return get<LogContentResponse>(path);
}

// ============================================================================
// Logs API
// ============================================================================

/**
 * Log type for the getLogs function
 */
export type LogType = 'activity' | 'errors';

/**
 * Fetch activity log events for a project
 */
export async function getActivityLogs(
  projectId: string,
  options?: { limit?: number; offset?: number }
): Promise<ActivityResponse> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  if (options?.offset !== undefined) {
    params.set('offset', String(options.offset));
  }

  const query = params.toString();
  const path = `/projects/${encodeURIComponent(projectId)}/logs/activity${query ? `?${query}` : ''}`;
  return get<ActivityResponse>(path);
}

/**
 * Fetch errors log for a project
 */
export async function getErrorLogs(
  projectId: string,
  options?: { limit?: number; offset?: number }
): Promise<ErrorsResponse> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  if (options?.offset !== undefined) {
    params.set('offset', String(options.offset));
  }

  const query = params.toString();
  const path = `/projects/${encodeURIComponent(projectId)}/logs/errors${query ? `?${query}` : ''}`;
  return get<ErrorsResponse>(path);
}

/**
 * Fetch raw log content for a project
 */
export async function getRawLogs(
  projectId: string,
  type: LogType,
  options?: { limit?: number; offset?: number }
): Promise<LogContentResponse> {
  const params = new URLSearchParams();
  params.set('raw', 'true');
  if (options?.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  if (options?.offset !== undefined) {
    params.set('offset', String(options.offset));
  }

  const path = `/projects/${encodeURIComponent(projectId)}/logs/${type}?${params.toString()}`;
  return get<LogContentResponse>(path);
}

/**
 * Generic getLogs function that fetches either activity or error logs
 * Returns union type of ActivityResponse | ErrorsResponse
 */
export async function getLogs(
  projectId: string,
  type: LogType,
  options?: { limit?: number; offset?: number }
): Promise<ActivityResponse | ErrorsResponse> {
  if (type === 'activity') {
    return getActivityLogs(projectId, options);
  }
  return getErrorLogs(projectId, options);
}

// ============================================================================
// API Object Export (for convenience)
// ============================================================================

export const api = {
  // Projects
  getProjects,
  getProject,
  registerProject,
  deleteProject,
  getPrd,
  getStories,
  getProgress,
  getGuardrails,
  getMetrics,
  // Runs
  getRuns,
  getRun,
  getRunLog,
  // Logs
  getActivityLogs,
  getErrorLogs,
  getRawLogs,
  getLogs,
};

export default api;
