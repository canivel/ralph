import { useState, useEffect } from 'react';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';
import {
  CheckCircle2,
  Circle,
  PlayCircle,
  Shield,
  Activity,
  Timer,
  FileCode,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLogs } from '@/hooks/useApi';
import type { Project, Story } from '@/stores/projectStore';
import type { ActivityEvent } from '@/lib/api';

interface OverviewTabProps {
  project: Project;
}

/**
 * Count stories by status
 */
function countStoriesByStatus(stories: Story[] | undefined) {
  if (!stories) return { open: 0, inProgress: 0, done: 0 };

  return stories.reduce(
    (acc, story) => {
      if (story.status === 'open') acc.open++;
      else if (story.status === 'in_progress') acc.inProgress++;
      else if (story.status === 'done') acc.done++;
      return acc;
    },
    { open: 0, inProgress: 0, done: 0 }
  );
}

/**
 * Get the currently running story
 */
function getCurrentStory(stories: Story[] | undefined): Story | null {
  if (!stories) return null;
  return stories.find((s) => s.status === 'in_progress') || null;
}

/**
 * Format elapsed time since a date
 */
function formatElapsedTime(startedAt: string): string {
  const seconds = differenceInSeconds(new Date(), new Date(startedAt));
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
 * Story Summary Card
 */
function StorySummaryCard({ stories }: { stories: Story[] | undefined }) {
  const counts = countStoriesByStatus(stories);
  const total = (stories?.length ?? 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <FileCode className="h-4 w-4" />
          Story Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
            <Circle className="h-5 w-5 text-gray-500 mb-1" />
            <span className="text-2xl font-bold">{counts.open}</span>
            <span className="text-xs text-muted-foreground">Open</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-blue-500/10 rounded-lg">
            <PlayCircle className="h-5 w-5 text-blue-500 mb-1" />
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {counts.inProgress}
            </span>
            <span className="text-xs text-muted-foreground">In Progress</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-green-500/10 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-500 mb-1" />
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              {counts.done}
            </span>
            <span className="text-xs text-muted-foreground">Done</span>
          </div>
        </div>
        {total > 0 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Total: {total} stories
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Quality Gates Card
 */
function QualityGatesCard({ gates }: { gates: string[] | undefined }) {
  if (!gates || gates.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Quality Gates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No quality gates defined</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Quality Gates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {gates.map((gate, index) => (
            <li
              key={index}
              className="flex items-center gap-2 text-sm font-mono bg-muted/50 px-3 py-2 rounded"
            >
              <code className="text-xs">{gate}</code>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Current Iteration Card - shows when a story is in progress
 */
function CurrentIterationCard({ story }: { story: Story }) {
  const [elapsedTime, setElapsedTime] = useState<string>('');

  useEffect(() => {
    if (!story.startedAt) return;

    // Update immediately
    setElapsedTime(formatElapsedTime(story.startedAt));

    // Update every second
    const interval = setInterval(() => {
      setElapsedTime(formatElapsedTime(story.startedAt!));
    }, 1000);

    return () => clearInterval(interval);
  }, [story.startedAt]);

  return (
    <Card className="border-blue-500/50 bg-blue-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Timer className="h-4 w-4 text-blue-500 animate-pulse" />
          Current Iteration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-sm text-muted-foreground">Story</span>
              <p className="font-medium text-primary">{story.id}</p>
            </div>
            <div className="text-right">
              <span className="text-sm text-muted-foreground">Elapsed</span>
              <p className="font-mono text-lg font-bold tabular-nums">
                {elapsedTime || '0s'}
              </p>
            </div>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Title</span>
            <p className="text-sm">{story.title}</p>
          </div>
          {story.startedAt && (
            <div>
              <span className="text-sm text-muted-foreground">Started</span>
              <p className="text-sm">
                {formatDistanceToNow(new Date(story.startedAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Activity Feed Card
 */
function ActivityFeedCard({ projectId }: { projectId: string }) {
  const { data: events, isLoading } = useLogs(projectId, 'activity', {
    limit: 10,
  });

  // Type guard for activity events
  const activityEvents = events as ActivityEvent[] | null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
        ) : !activityEvents || activityEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {activityEvents.map((event, index) => (
              <ActivityEventItem key={`${event.timestamp}-${index}`} event={event} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Single activity event item
 */
function ActivityEventItem({ event }: { event: ActivityEvent }) {
  const isIterationStart = event.type === 'iteration_start';
  const isIterationEnd = event.type === 'iteration_end';

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-2 rounded text-sm',
        isIterationStart && 'bg-blue-500/10',
        isIterationEnd && 'bg-green-500/10',
        !isIterationStart && !isIterationEnd && 'bg-muted/30'
      )}
    >
      <div
        className={cn(
          'h-2 w-2 mt-1.5 rounded-full flex-shrink-0',
          isIterationStart && 'bg-blue-500',
          isIterationEnd && 'bg-green-500',
          !isIterationStart && !isIterationEnd && 'bg-gray-400'
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="break-words">{event.message}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

/**
 * Overview Tab Component
 * Shows project summary including story stats, quality gates, activity feed,
 * and current iteration info when running.
 */
export function OverviewTab({ project }: OverviewTabProps) {
  const stories = project.prd?.stories;
  const qualityGates = project.prd?.qualityGates;
  const currentStory = getCurrentStory(stories);
  const isRunning = currentStory !== null;

  return (
    <div className="space-y-6">
      {/* Current Iteration - only shown when running */}
      {isRunning && currentStory && (
        <CurrentIterationCard story={currentStory} />
      )}

      {/* Main Grid: Story Summary and Quality Gates */}
      <div className="grid gap-6 md:grid-cols-2">
        <StorySummaryCard stories={stories} />
        <QualityGatesCard gates={qualityGates} />
      </div>

      {/* Activity Feed */}
      <ActivityFeedCard projectId={project.id} />
    </div>
  );
}
