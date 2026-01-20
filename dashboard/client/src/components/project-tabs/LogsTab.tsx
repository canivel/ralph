import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  Clock,
  ChevronDown,
  ChevronRight,
  ScrollText,
  AlertTriangle,
  FileText,
  Settings2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  api,
  type ActivityEvent,
  type ErrorEntry,
  type RunMeta,
  type LogContentResponse,
} from '@/lib/api';
import type { Project } from '@/stores/projectStore';

interface LogsTabProps {
  project: Project;
}

type LogSubTab = 'activity' | 'errors' | 'run-logs';

/**
 * Format timestamp to relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString();
}

/**
 * Format timestamp to absolute time
 */
function formatAbsoluteTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Check if text contains code block indicators
 */
function hasCodeBlock(text: string): boolean {
  return text.includes('```') || text.includes('    ') || text.match(/^\s{4,}/m) !== null;
}

/**
 * Truncation threshold for long entries (characters)
 */
const TRUNCATE_LENGTH = 300;

/**
 * Log entry component with expand/collapse for long entries
 */
function LogEntry({
  timestamp,
  message,
  type,
  useRelativeTime,
  searchTerm,
}: {
  timestamp: string;
  message: string;
  type?: 'iteration_start' | 'iteration_end' | 'other' | 'error';
  useRelativeTime: boolean;
  searchTerm: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isTruncated = message.length > TRUNCATE_LENGTH;
  const displayMessage = isExpanded || !isTruncated
    ? message
    : message.slice(0, TRUNCATE_LENGTH) + '...';

  // Highlight search term in message
  const highlightedMessage = useMemo(() => {
    if (!searchTerm) return displayMessage;

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = displayMessage.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-300 dark:bg-yellow-700 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  }, [displayMessage, searchTerm]);

  const isError = type === 'error';
  const isIterationStart = type === 'iteration_start';
  const isIterationEnd = type === 'iteration_end';

  return (
    <div
      className={cn(
        'group border-b last:border-b-0 py-2 px-3',
        isError && 'bg-red-500/5 border-l-2 border-l-red-500',
        isIterationStart && 'bg-blue-500/5 border-l-2 border-l-blue-500',
        isIterationEnd && 'bg-green-500/5 border-l-2 border-l-green-500'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Timestamp */}
        <span
          className="text-xs text-muted-foreground whitespace-nowrap shrink-0 font-mono pt-0.5"
          title={formatAbsoluteTime(timestamp)}
        >
          {useRelativeTime ? formatRelativeTime(timestamp) : formatAbsoluteTime(timestamp)}
        </span>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-sm break-words',
              hasCodeBlock(message) && 'font-mono text-xs bg-muted/50 p-2 rounded',
              isError && 'text-red-600 dark:text-red-400'
            )}
          >
            {typeof highlightedMessage === 'string' ? (
              <pre className="whitespace-pre-wrap">{highlightedMessage}</pre>
            ) : (
              <pre className="whitespace-pre-wrap">{highlightedMessage}</pre>
            )}
          </div>

          {/* Expand/Collapse button */}
          {isTruncated && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 text-xs text-primary hover:underline flex items-center gap-1"
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronRight className="h-3 w-3" />
                  Show more
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Loading skeleton component
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-4 w-16 bg-muted/50 rounded animate-pulse" />
          <div className="flex-1 h-4 bg-muted/50 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/**
 * Controls bar component
 */
function LogControls({
  searchTerm,
  onSearchChange,
  autoScroll,
  onAutoScrollChange,
  useRelativeTime,
  onUseRelativeTimeChange,
  isRunning,
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  autoScroll: boolean;
  onAutoScrollChange: (value: boolean) => void;
  useRelativeTime: boolean;
  onUseRelativeTimeChange: (value: boolean) => void;
  isRunning?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
      {/* Search input */}
      <div className="relative flex-1 w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter logs..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Settings */}
      <div className="flex items-center gap-4 text-sm">
        {/* Auto-scroll toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => onAutoScrollChange(e.target.checked)}
            className="rounded border-input"
          />
          <span className="text-muted-foreground">Auto-scroll</span>
          {isRunning && autoScroll && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          )}
        </label>

        {/* Relative time toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useRelativeTime}
            onChange={(e) => onUseRelativeTimeChange(e.target.checked)}
            className="rounded border-input"
          />
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Relative</span>
        </label>
      </div>
    </div>
  );
}

/**
 * Activity Log View component
 */
function ActivityLogView({
  projectId,
  searchTerm,
  autoScroll,
  useRelativeTime,
  isRunning,
}: {
  projectId: string;
  searchTerm: string;
  autoScroll: boolean;
  useRelativeTime: boolean;
  isRunning: boolean;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.getActivityLogs(projectId, { limit: 500 });
      setEvents(response.events);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity logs');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // WebSocket for real-time updates
  useWebSocket({
    onFileChange: (message) => {
      if (message.projectId === projectId && message.fileType === 'activity') {
        fetchLogs();
      }
    },
  });

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  // Filter events by search term
  const filteredEvents = useMemo(() => {
    if (!searchTerm) return events;
    const term = searchTerm.toLowerCase();
    return events.filter(
      (e) => e.message.toLowerCase().includes(term) || e.timestamp.toLowerCase().includes(term)
    );
  }, [events, searchTerm]);

  // Reverse order to show newest at bottom (for auto-scroll behavior)
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].reverse();
  }, [filteredEvents]);

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (sortedEvents.length === 0) {
    return (
      <EmptyState
        message={searchTerm ? 'No matching entries found' : 'No activity logged yet'}
      />
    );
  }

  return (
    <div
      ref={scrollRef}
      className="border rounded-lg max-h-[600px] overflow-y-auto"
    >
      {sortedEvents.map((event, index) => (
        <LogEntry
          key={`${event.timestamp}-${index}`}
          timestamp={event.timestamp}
          message={event.message}
          type={event.type}
          useRelativeTime={useRelativeTime}
          searchTerm={searchTerm}
        />
      ))}
      {isRunning && autoScroll && (
        <div className="p-2 text-center text-xs text-muted-foreground border-t animate-pulse">
          Watching for new entries...
        </div>
      )}
    </div>
  );
}

/**
 * Errors Log View component
 */
function ErrorsLogView({
  projectId,
  searchTerm,
  autoScroll,
  useRelativeTime,
  isRunning,
}: {
  projectId: string;
  searchTerm: string;
  autoScroll: boolean;
  useRelativeTime: boolean;
  isRunning: boolean;
}) {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.getErrorLogs(projectId, { limit: 500 });
      setErrors(response.errors);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load error logs');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // WebSocket for real-time updates
  useWebSocket({
    onFileChange: (message) => {
      if (message.projectId === projectId && message.fileType === 'errors') {
        fetchLogs();
      }
    },
  });

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [errors, autoScroll]);

  // Filter errors by search term
  const filteredErrors = useMemo(() => {
    if (!searchTerm) return errors;
    const term = searchTerm.toLowerCase();
    return errors.filter(
      (e) => e.message.toLowerCase().includes(term) || e.timestamp.toLowerCase().includes(term)
    );
  }, [errors, searchTerm]);

  // Reverse order to show newest at bottom (for auto-scroll behavior)
  const sortedErrors = useMemo(() => {
    return [...filteredErrors].reverse();
  }, [filteredErrors]);

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (sortedErrors.length === 0) {
    return (
      <EmptyState
        message={searchTerm ? 'No matching errors found' : 'No errors logged'}
      />
    );
  }

  return (
    <div
      ref={scrollRef}
      className="border rounded-lg max-h-[600px] overflow-y-auto"
    >
      {sortedErrors.map((entry, index) => (
        <LogEntry
          key={`${entry.timestamp}-${index}`}
          timestamp={entry.timestamp}
          message={entry.message}
          type="error"
          useRelativeTime={useRelativeTime}
          searchTerm={searchTerm}
        />
      ))}
      {isRunning && autoScroll && (
        <div className="p-2 text-center text-xs text-muted-foreground border-t animate-pulse">
          Watching for new entries...
        </div>
      )}
    </div>
  );
}

/**
 * Run Logs View component
 */
function RunLogsView({
  projectId,
  searchTerm,
  autoScroll,
  useRelativeTime,
  isRunning,
}: {
  projectId: string;
  searchTerm: string;
  autoScroll: boolean;
  useRelativeTime: boolean;
  isRunning: boolean;
}) {
  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<LogContentResponse | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [isLoadingLog, setIsLoadingLog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch available runs
  const fetchRuns = useCallback(async () => {
    try {
      setIsLoadingRuns(true);
      const response = await api.getRuns(projectId, { limit: 100 });
      setRuns(response.runs);

      // Auto-select the most recent run (or currently running run)
      if (response.runs.length > 0 && !selectedRunId) {
        const runningRun = response.runs.find((r) => r.status === 'running');
        const firstRun = runningRun || response.runs[0];
        setSelectedRunId(`${firstRun.runId}-iter-${firstRun.iteration}`);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
    } finally {
      setIsLoadingRuns(false);
    }
  }, [projectId, selectedRunId]);

  // Fetch log content for selected run
  const fetchLog = useCallback(async () => {
    if (!selectedRunId) return;

    // Extract runId and iteration from combined id
    const match = selectedRunId.match(/^(.+)-iter-(\d+)$/);
    if (!match) return;

    const [, runId] = match;

    try {
      setIsLoadingLog(true);
      const response = await api.getRunLog(projectId, runId, { limit: 2000 });
      setLogContent(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load log content');
      setLogContent(null);
    } finally {
      setIsLoadingLog(false);
    }
  }, [projectId, selectedRunId]);

  // Initial fetch
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Fetch log when run is selected
  useEffect(() => {
    if (selectedRunId) {
      fetchLog();
    }
  }, [selectedRunId, fetchLog]);

  // WebSocket for real-time updates
  useWebSocket({
    onFileChange: (message) => {
      if (message.projectId === projectId && message.fileType === 'run') {
        fetchRuns();
        // Also refresh current log if it's the active run
        if (selectedRunId) {
          const match = selectedRunId.match(/^(.+)-iter-(\d+)$/);
          if (match && message.path.includes(match[1])) {
            fetchLog();
          }
        }
      }
    },
  });

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll && scrollRef.current && logContent) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logContent, autoScroll]);

  // Filter log lines by search term
  const filteredLines = useMemo(() => {
    if (!logContent?.lines) return [];
    if (!searchTerm) return logContent.lines;
    const term = searchTerm.toLowerCase();
    return logContent.lines.filter((line) => line.toLowerCase().includes(term));
  }, [logContent, searchTerm]);

  // Get selected run info
  const selectedRun = useMemo(() => {
    if (!selectedRunId || runs.length === 0) return null;
    const match = selectedRunId.match(/^(.+)-iter-(\d+)$/);
    if (!match) return null;
    const [, runId, iteration] = match;
    return runs.find((r) => r.runId === runId && r.iteration === parseInt(iteration, 10));
  }, [selectedRunId, runs]);

  const isSelectedRunActive = selectedRun?.status === 'running';

  // Silence unused variable warning - useRelativeTime is available for future enhancements
  void useRelativeTime;
  void isRunning;

  if (error && !logContent) {
    return (
      <div className="text-center py-8 text-red-500">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Run selector dropdown */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Select run:</span>
        <div className="relative flex-1 max-w-md">
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={isLoadingRuns}
          >
            {isLoadingRuns ? (
              'Loading runs...'
            ) : selectedRun ? (
              <span className="flex items-center gap-2 truncate">
                {selectedRun.status === 'running' && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                )}
                <span className="font-mono">{selectedRun.runId.slice(0, 15)}...</span>
                <span className="text-muted-foreground">Iter {selectedRun.iteration}</span>
                <span className="text-muted-foreground">({selectedRun.storyId})</span>
              </span>
            ) : (
              'Select a run'
            )}
            <ChevronDown className="h-4 w-4 shrink-0" />
          </Button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md">
                {runs.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No runs found</div>
                ) : (
                  runs.map((run) => {
                    const runKey = `${run.runId}-iter-${run.iteration}`;
                    return (
                      <button
                        key={runKey}
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2',
                          selectedRunId === runKey && 'bg-accent'
                        )}
                        onClick={() => {
                          setSelectedRunId(runKey);
                          setDropdownOpen(false);
                        }}
                      >
                        {run.status === 'running' && (
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                          </span>
                        )}
                        {run.status === 'success' && (
                          <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                        )}
                        {run.status === 'failed' && (
                          <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                        )}
                        <span className="font-mono truncate">{run.runId.slice(0, 15)}...</span>
                        <span className="text-muted-foreground shrink-0">Iter {run.iteration}</span>
                        <span className="text-primary font-mono shrink-0">{run.storyId}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Log content */}
      {isLoadingLog ? (
        <LoadingSkeleton />
      ) : !logContent || filteredLines.length === 0 ? (
        <EmptyState
          message={
            searchTerm
              ? 'No matching lines found'
              : selectedRunId
              ? 'No log content available'
              : 'Select a run to view its log'
          }
        />
      ) : (
        <div
          ref={scrollRef}
          className="border rounded-lg max-h-[600px] overflow-y-auto font-mono text-xs bg-muted/30"
        >
          {logContent.truncated && (
            <div className="sticky top-0 bg-yellow-500/10 border-b border-yellow-500/30 px-3 py-1.5 text-yellow-600 dark:text-yellow-400 text-xs">
              {logContent.truncatedMessage}
            </div>
          )}
          <pre className="p-3 whitespace-pre-wrap break-words">
            {searchTerm
              ? filteredLines.map((line, i) => {
                  const regex = new RegExp(
                    `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
                    'gi'
                  );
                  const parts = line.split(regex);
                  return (
                    <div key={i}>
                      {parts.map((part, j) =>
                        regex.test(part) ? (
                          <mark key={j} className="bg-yellow-300 dark:bg-yellow-700 px-0.5 rounded">
                            {part}
                          </mark>
                        ) : (
                          part
                        )
                      )}
                      {'\n'}
                    </div>
                  );
                })
              : logContent.content}
          </pre>
          {isSelectedRunActive && autoScroll && (
            <div className="sticky bottom-0 p-2 text-center text-xs text-muted-foreground bg-muted/50 border-t animate-pulse">
              Run in progress - watching for updates...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * LogsTab component - displays logs with sub-tabs for Activity, Errors, and Run Logs
 */
export function LogsTab({ project }: LogsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<LogSubTab>('activity');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [useRelativeTime, setUseRelativeTime] = useState(true);

  const isRunning = project.isRunning ?? false;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Logs
            {isRunning && (
              <span className="relative flex h-2 w-2 ml-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Controls */}
          <LogControls
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            autoScroll={autoScroll}
            onAutoScrollChange={setAutoScroll}
            useRelativeTime={useRelativeTime}
            onUseRelativeTimeChange={setUseRelativeTime}
            isRunning={isRunning}
          />

          {/* Sub-tabs */}
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as LogSubTab)}>
            <TabsList className="mb-4">
              <TabsTrigger value="activity" className="gap-2">
                <FileText className="h-4 w-4" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="errors" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Errors
              </TabsTrigger>
              <TabsTrigger value="run-logs" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Run Logs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              <ActivityLogView
                projectId={project.id}
                searchTerm={searchTerm}
                autoScroll={autoScroll}
                useRelativeTime={useRelativeTime}
                isRunning={isRunning}
              />
            </TabsContent>

            <TabsContent value="errors">
              <ErrorsLogView
                projectId={project.id}
                searchTerm={searchTerm}
                autoScroll={autoScroll}
                useRelativeTime={useRelativeTime}
                isRunning={isRunning}
              />
            </TabsContent>

            <TabsContent value="run-logs">
              <RunLogsView
                projectId={project.id}
                searchTerm={searchTerm}
                autoScroll={autoScroll}
                useRelativeTime={useRelativeTime}
                isRunning={isRunning}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
