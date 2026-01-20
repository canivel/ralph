import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  GitCommit,
  FileCode,
  Filter,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Circle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRuns, type RunMeta } from '@/hooks/useApi';
import type { Project } from '@/stores/projectStore';

interface RunsTabProps {
  project: Project;
}

/**
 * Status filter options
 */
type StatusFilter = 'all' | 'success' | 'failed' | 'running';

/**
 * Format duration in seconds to human-readable format
 */
function formatDuration(seconds: number): string {
  if (seconds === 0) return '-';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Parse run ID to extract date/time components for display
 * Run IDs are formatted as: YYYYMMDD-HHMMSS-random
 */
function parseRunDate(runId: string): Date | null {
  const match = runId.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, min, sec] = match;
  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(min, 10),
    parseInt(sec, 10)
  );
}

/**
 * Format run date to user-friendly string
 */
function formatRunDate(runId: string): string {
  const date = parseRunDate(runId);
  if (!date) return runId;

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: RunMeta['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        status === 'success' && 'bg-green-500/10 text-green-600 dark:text-green-400',
        status === 'failed' && 'bg-red-500/10 text-red-600 dark:text-red-400',
        status === 'running' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
      )}
    >
      {status === 'success' && <CheckCircle2 className="h-3 w-3" />}
      {status === 'failed' && <XCircle className="h-3 w-3" />}
      {status === 'running' && <PlayCircle className="h-3 w-3 animate-pulse" />}
      <span className="capitalize">{status}</span>
    </span>
  );
}

/**
 * Filter dropdown component
 */
function StatusFilterDropdown({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
}) {
  const [open, setOpen] = useState(false);

  const options: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'success', label: 'Success' },
    { value: 'failed', label: 'Failed' },
    { value: 'running', label: 'Running' },
  ];

  const currentLabel = options.find((o) => o.value === value)?.label || 'All';

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(!open)}
      >
        <Filter className="h-4 w-4" />
        {currentLabel}
        <ChevronDown className="h-3 w-3" />
      </Button>

      {open && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded-md border bg-popover p-1 shadow-md">
            {options.map((option) => (
              <button
                key={option.value}
                className={cn(
                  'w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                  value === option.value && 'bg-accent'
                )}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Expandable row details component
 */
function RunDetails({ run }: { run: RunMeta }) {
  const runDate = parseRunDate(run.runId);

  return (
    <div className="p-4 bg-muted/30 border-t space-y-4">
      {/* Timestamps */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        {runDate && (
          <div>
            <span className="text-muted-foreground">Started:</span>
            <p className="font-medium">{runDate.toLocaleString()}</p>
          </div>
        )}
        {run.duration > 0 && (
          <div>
            <span className="text-muted-foreground">Duration:</span>
            <p className="font-medium font-mono">{formatDuration(run.duration)}</p>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Iteration:</span>
          <p className="font-medium">{run.iteration}</p>
        </div>
      </div>

      {/* Commits */}
      {run.commits && run.commits.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <GitCommit className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Commits</span>
          </div>
          <ul className="space-y-1">
            {run.commits.map((commit, index) => (
              <li
                key={index}
                className="text-sm font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1"
              >
                {commit}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Changed Files */}
      {run.changedFiles && run.changedFiles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileCode className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Changed Files</span>
            <span className="text-xs text-muted-foreground">
              ({run.changedFiles.length})
            </span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {run.changedFiles.map((file, index) => (
              <li
                key={index}
                className="text-xs font-mono text-muted-foreground truncate"
                title={file}
              >
                {file}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No additional details message */}
      {(!run.commits || run.commits.length === 0) &&
        (!run.changedFiles || run.changedFiles.length === 0) && (
          <p className="text-sm text-muted-foreground italic">
            No additional details available for this run.
          </p>
        )}
    </div>
  );
}

/**
 * Single run row component
 */
function RunRow({
  run,
  isExpanded,
  onToggle,
}: {
  run: RunMeta;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isRunning = run.status === 'running';

  return (
    <div
      className={cn(
        'border-b last:border-b-0',
        isRunning && 'bg-blue-500/5'
      )}
    >
      {/* Main row - clickable */}
      <div
        className={cn(
          'grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors',
          isExpanded && 'bg-muted/30'
        )}
        onClick={onToggle}
      >
        {/* Expand/collapse icon */}
        <div className="text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>

        {/* Run ID and Date */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isRunning && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            )}
            <span className="font-mono text-sm truncate" title={run.runId}>
              {run.runId.slice(0, 15)}...
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatRunDate(run.runId)}
          </span>
        </div>

        {/* Iteration */}
        <div className="text-center hidden sm:block">
          <span className="text-sm font-medium">{run.iteration}</span>
        </div>

        {/* Story */}
        <div className="min-w-0 max-w-[200px] hidden md:block">
          <span className="font-mono text-sm text-primary">{run.storyId}</span>
          <p className="text-xs text-muted-foreground truncate" title={run.storyTitle}>
            {run.storyTitle || '-'}
          </p>
        </div>

        {/* Duration */}
        <div className="text-right hidden sm:block">
          <span className="font-mono text-sm">{formatDuration(run.duration)}</span>
        </div>

        {/* Status */}
        <div>
          <StatusBadge status={run.status} />
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && <RunDetails run={run} />}
    </div>
  );
}

/**
 * Running iteration banner
 */
function RunningIterationBanner({ runs }: { runs: RunMeta[] }) {
  const runningRun = runs.find((r) => r.status === 'running');

  if (!runningRun) return null;

  return (
    <div className="mb-4 p-4 rounded-lg border border-blue-500/30 bg-blue-500/10">
      <div className="flex items-center gap-3">
        {/* Pulse indicator */}
        <div className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-blue-600 dark:text-blue-400">
              Running: Iteration {runningRun.iteration}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="font-mono text-sm">{runningRun.storyId}</span>
          </div>
          {runningRun.storyTitle && (
            <p className="text-sm text-muted-foreground truncate">
              {runningRun.storyTitle}
            </p>
          )}
        </div>

        {/* Clock icon */}
        <Clock className="h-5 w-5 text-blue-500 animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Table header component
 */
function TableHeader() {
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 p-4 border-b bg-muted/50 text-sm font-medium text-muted-foreground">
      <div className="w-4" /> {/* Expand icon column */}
      <div>Run ID</div>
      <div className="text-center hidden sm:block">Iter</div>
      <div className="hidden md:block">Story</div>
      <div className="text-right hidden sm:block">Duration</div>
      <div>Status</div>
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState({ filter }: { filter: StatusFilter }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Circle className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <p className="text-muted-foreground">
        {filter === 'all'
          ? 'No runs found for this project'
          : `No ${filter} runs found`}
      </p>
    </div>
  );
}

/**
 * Loading skeleton component
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-16 bg-muted/50 rounded animate-pulse"
        />
      ))}
    </div>
  );
}

/**
 * RunsTab component - displays run history as a table with expandable rows
 */
export function RunsTab({ project }: RunsTabProps) {
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: runs, isLoading, error } = useRuns(project.id);

  // Filter runs by status
  const filteredRuns = useMemo(() => {
    if (!runs) return [];

    let filtered = [...runs];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    // Sort by date descending (newest first) - runId contains timestamp
    filtered.sort((a, b) => b.runId.localeCompare(a.runId));

    return filtered;
  }, [runs, statusFilter]);

  // Move running runs to top
  const sortedRuns = useMemo(() => {
    const running = filteredRuns.filter((r) => r.status === 'running');
    const notRunning = filteredRuns.filter((r) => r.status !== 'running');
    return [...running, ...notRunning];
  }, [filteredRuns]);

  const toggleExpanded = (runId: string) => {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  // Show error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <XCircle className="h-12 w-12 text-red-500/50 mb-4" />
            <p className="text-muted-foreground">
              Error loading runs: {error}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Running iteration banner */}
      {runs && <RunningIterationBanner runs={runs} />}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            Runs
            {runs && (
              <span className="text-sm font-normal text-muted-foreground">
                ({filteredRuns.length}
                {statusFilter !== 'all' ? ` ${statusFilter}` : ''})
              </span>
            )}
          </CardTitle>
          <StatusFilterDropdown value={statusFilter} onChange={setStatusFilter} />
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSkeleton />
          ) : sortedRuns.length === 0 ? (
            <EmptyState filter={statusFilter} />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <TableHeader />
              <div className="divide-y">
                {sortedRuns.map((run) => (
                  <RunRow
                    key={`${run.runId}-iter-${run.iteration}`}
                    run={run}
                    isExpanded={expandedRuns.has(`${run.runId}-iter-${run.iteration}`)}
                    onToggle={() => toggleExpanded(`${run.runId}-iter-${run.iteration}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
