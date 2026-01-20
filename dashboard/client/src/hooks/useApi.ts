/**
 * Custom React hooks for data fetching with loading and error states.
 * Integrates with the Zustand store and WebSocket for real-time updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectStore, type Project } from '@/stores/projectStore';
import { useWebSocket } from './useWebSocket';
import {
  api,
  type RunMeta,
  type RunsResponse,
  type ActivityResponse,
  type ErrorsResponse,
  type LogType,
  ApiError,
} from '@/lib/api';

// ============================================================================
// Types
// ============================================================================

/**
 * Common state for async operations
 */
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * State for paginated data
 */
export interface PaginatedState<T> extends AsyncState<T[]> {
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  } | null;
  loadMore: () => Promise<void>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract user-friendly error message from various error types
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

// ============================================================================
// useProjects Hook
// ============================================================================

/**
 * Hook to fetch and manage all projects.
 * Integrates with the Zustand store and WebSocket for real-time updates.
 *
 * @returns AsyncState with projects array
 *
 * @example
 * ```tsx
 * const { data: projects, isLoading, error, refetch } = useProjects();
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error} />;
 * return <ProjectList projects={projects} />;
 * ```
 */
export function useProjects(): AsyncState<Project[]> {
  const projects = useProjectStore((state) => state.projects);
  const setProjects = useProjectStore((state) => state.setProjects);
  const updateProject = useProjectStore((state) => state.updateProject);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.getProjects();
      if (isMounted.current) {
        setProjects(data);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(getErrorMessage(err));
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [setProjects]);

  // Handle WebSocket file changes to refresh project data
  const handleFileChange = useCallback(
    (message: { projectId: string; fileType: string }) => {
      // Refresh the specific project when its files change
      const refreshProject = async () => {
        try {
          const updated = await api.getProject(message.projectId);
          if (isMounted.current) {
            updateProject(message.projectId, updated);
          }
        } catch {
          // Silently ignore - project may have been deleted
        }
      };

      // Only refresh for PRD changes that might affect project status
      if (message.fileType === 'prd' || message.fileType === 'activity') {
        refreshProject();
      }
    },
    [updateProject]
  );

  // Connect to WebSocket
  useWebSocket({
    onFileChange: handleFileChange,
  });

  // Fetch projects on mount
  useEffect(() => {
    isMounted.current = true;
    fetchProjects();

    return () => {
      isMounted.current = false;
    };
  }, [fetchProjects]);

  return {
    data: projects.length > 0 ? projects : null,
    isLoading,
    error,
    refetch: fetchProjects,
  };
}

// ============================================================================
// useProject Hook
// ============================================================================

/**
 * Hook to fetch and manage a single project by ID.
 * Integrates with WebSocket for real-time updates.
 *
 * @param id - Project ID to fetch
 * @returns AsyncState with project data
 *
 * @example
 * ```tsx
 * const { data: project, isLoading, error, refetch } = useProject('abc123');
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error} />;
 * return <ProjectDetail project={project} />;
 * ```
 */
export function useProject(id: string | null): AsyncState<Project> {
  const [data, setData] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const updateProject = useProjectStore((state) => state.updateProject);
  const setSelectedProject = useProjectStore((state) => state.setSelectedProject);

  const fetchProject = useCallback(async () => {
    if (!id) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const project = await api.getProject(id);
      if (isMounted.current) {
        setData(project);
        // Also update in the store
        updateProject(id, project);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(getErrorMessage(err));
        setData(null);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [id, updateProject]);

  // Handle WebSocket file changes to refresh project data
  const handleFileChange = useCallback(
    (message: { projectId: string; fileType: string }) => {
      if (message.projectId !== id) return;

      // Refresh project data when relevant files change
      if (
        message.fileType === 'prd' ||
        message.fileType === 'activity' ||
        message.fileType === 'progress' ||
        message.fileType === 'guardrails'
      ) {
        fetchProject();
      }
    },
    [id, fetchProject]
  );

  // Connect to WebSocket and subscribe to this project
  const { subscribe } = useWebSocket({
    onFileChange: handleFileChange,
  });

  // Fetch project on mount or when ID changes
  useEffect(() => {
    isMounted.current = true;

    if (id) {
      setSelectedProject(id);
      fetchProject();
      // Subscribe to this project's updates
      subscribe([id]);
    }

    return () => {
      isMounted.current = false;
    };
  }, [id, fetchProject, setSelectedProject, subscribe]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchProject,
  };
}

// ============================================================================
// useRuns Hook
// ============================================================================

/**
 * Hook to fetch run history for a project.
 * Supports pagination with loadMore functionality.
 *
 * @param projectId - Project ID to fetch runs for
 * @param options - Optional limit and initial offset
 * @returns PaginatedState with runs array
 *
 * @example
 * ```tsx
 * const { data: runs, isLoading, error, pagination, loadMore } = useRuns('abc123');
 * ```
 */
export function useRuns(
  projectId: string | null,
  options?: { limit?: number }
): PaginatedState<RunMeta> {
  const [data, setData] = useState<RunMeta[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginatedState<RunMeta>['pagination']>(null);
  const isMounted = useRef(true);

  const limit = options?.limit ?? 50;

  const fetchRuns = useCallback(
    async (offset = 0, append = false) => {
      if (!projectId) {
        setData(null);
        setIsLoading(false);
        setError(null);
        setPagination(null);
        return;
      }

      setIsLoading(true);
      if (!append) {
        setError(null);
      }

      try {
        const response: RunsResponse = await api.getRuns(projectId, {
          limit,
          offset,
        });

        if (isMounted.current) {
          if (append && data) {
            setData([...data, ...response.runs]);
          } else {
            setData(response.runs);
          }
          setPagination(response.pagination);
        }
      } catch (err) {
        if (isMounted.current) {
          setError(getErrorMessage(err));
          if (!append) {
            setData(null);
            setPagination(null);
          }
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    },
    [projectId, limit, data]
  );

  const loadMore = useCallback(async () => {
    if (!pagination?.hasMore || isLoading) return;
    await fetchRuns(pagination.offset + pagination.limit, true);
  }, [pagination, isLoading, fetchRuns]);

  const refetch = useCallback(async () => {
    await fetchRuns(0, false);
  }, [fetchRuns]);

  // Handle WebSocket file changes to refresh runs
  const handleFileChange = useCallback(
    (message: { projectId: string; fileType: string }) => {
      if (message.projectId !== projectId) return;

      // Refresh runs when run files change
      if (message.fileType === 'run') {
        refetch();
      }
    },
    [projectId, refetch]
  );

  useWebSocket({
    onFileChange: handleFileChange,
  });

  // Fetch runs on mount or when projectId changes
  useEffect(() => {
    isMounted.current = true;
    fetchRuns(0, false);

    return () => {
      isMounted.current = false;
    };
    // Only re-fetch when projectId or limit changes, not on every fetchRuns change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, limit]);

  return {
    data,
    isLoading,
    error,
    pagination,
    refetch,
    loadMore,
  };
}

// ============================================================================
// useLogs Hook
// ============================================================================

/**
 * Hook to fetch logs for a project.
 * Supports both activity and error logs with pagination.
 *
 * @param projectId - Project ID to fetch logs for
 * @param type - Log type: 'activity' or 'errors'
 * @param options - Optional limit and initial offset
 * @returns PaginatedState with events/errors array
 *
 * @example
 * ```tsx
 * const { data: events, isLoading, error, pagination, loadMore } = useLogs('abc123', 'activity');
 * ```
 */
export function useLogs(
  projectId: string | null,
  type: LogType,
  options?: { limit?: number }
): PaginatedState<ActivityResponse['events'][0] | ErrorsResponse['errors'][0]> {
  const [data, setData] = useState<(ActivityResponse['events'][0] | ErrorsResponse['errors'][0])[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginatedState<unknown>['pagination']>(null);
  const isMounted = useRef(true);

  const limit = options?.limit ?? 100;

  const fetchLogs = useCallback(
    async (offset = 0, append = false) => {
      if (!projectId) {
        setData(null);
        setIsLoading(false);
        setError(null);
        setPagination(null);
        return;
      }

      setIsLoading(true);
      if (!append) {
        setError(null);
      }

      try {
        const response = await api.getLogs(projectId, type, { limit, offset });

        if (isMounted.current) {
          const items = type === 'activity'
            ? (response as ActivityResponse).events
            : (response as ErrorsResponse).errors;

          if (append && data) {
            setData([...data, ...items]);
          } else {
            setData(items);
          }
          setPagination(response.pagination);
        }
      } catch (err) {
        if (isMounted.current) {
          setError(getErrorMessage(err));
          if (!append) {
            setData(null);
            setPagination(null);
          }
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    },
    [projectId, type, limit, data]
  );

  const loadMore = useCallback(async () => {
    if (!pagination?.hasMore || isLoading) return;
    await fetchLogs(pagination.offset + pagination.limit, true);
  }, [pagination, isLoading, fetchLogs]);

  const refetch = useCallback(async () => {
    await fetchLogs(0, false);
  }, [fetchLogs]);

  // Handle WebSocket file changes to refresh logs
  const handleFileChange = useCallback(
    (message: { projectId: string; fileType: string }) => {
      if (message.projectId !== projectId) return;

      // Refresh logs when relevant log files change
      if (
        (type === 'activity' && message.fileType === 'activity') ||
        (type === 'errors' && message.fileType === 'errors')
      ) {
        refetch();
      }
    },
    [projectId, type, refetch]
  );

  useWebSocket({
    onFileChange: handleFileChange,
  });

  // Fetch logs on mount or when projectId/type changes
  useEffect(() => {
    isMounted.current = true;
    fetchLogs(0, false);

    return () => {
      isMounted.current = false;
    };
    // Only re-fetch when key dependencies change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, type, limit]);

  return {
    data,
    isLoading,
    error,
    pagination,
    refetch,
    loadMore,
  };
}

// ============================================================================
// Re-export API functions for convenience
// ============================================================================

export { api, ApiError } from '@/lib/api';
export type {
  RunMeta,
  ActivityEvent,
  ErrorEntry,
  LogType,
  ProgressData,
  GuardrailsData,
  MetricsData,
} from '@/lib/api';
