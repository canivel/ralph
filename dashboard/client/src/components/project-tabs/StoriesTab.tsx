import { useState, useEffect, useMemo } from 'react';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';
import {
  Circle,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  FileText,
  List,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Project, Story, StoryStatus } from '@/stores/projectStore';

interface StoriesTabProps {
  project: Project;
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
 * Format completion time (duration from started to completed)
 */
function formatCompletionTime(startedAt: string, completedAt: string): string {
  const seconds = differenceInSeconds(
    new Date(completedAt),
    new Date(startedAt)
  );
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
 * Check if a story is blocked (has unmet dependencies)
 */
function isStoryBlocked(story: Story, allStories: Story[]): boolean {
  if (!story.dependsOn || story.dependsOn.length === 0) {
    return false;
  }

  return story.dependsOn.some((depId) => {
    const dep = allStories.find((s) => s.id === depId);
    return !dep || dep.status !== 'done';
  });
}

/**
 * Get unmet dependencies for a story
 */
function getUnmetDependencies(story: Story, allStories: Story[]): string[] {
  if (!story.dependsOn || story.dependsOn.length === 0) {
    return [];
  }

  return story.dependsOn.filter((depId) => {
    const dep = allStories.find((s) => s.id === depId);
    return !dep || dep.status !== 'done';
  });
}

/**
 * Sort stories by ID (numerically if possible)
 */
function sortStoriesById(stories: Story[]): Story[] {
  return [...stories].sort((a, b) => {
    // Extract numeric part from IDs like "US-001"
    const numA = parseInt(a.id.replace(/\D/g, ''), 10);
    const numB = parseInt(b.id.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Group stories by status
 */
function groupStoriesByStatus(
  stories: Story[] | undefined
): Record<StoryStatus, Story[]> {
  const grouped: Record<StoryStatus, Story[]> = {
    open: [],
    in_progress: [],
    done: [],
  };

  if (!stories) return grouped;

  for (const story of stories) {
    const status = story.status as StoryStatus;
    if (grouped[status]) {
      grouped[status].push(story);
    } else {
      // Default to 'open' if status is unrecognized
      grouped.open.push(story);
    }
  }

  // Sort each column by ID
  grouped.open = sortStoriesById(grouped.open);
  grouped.in_progress = sortStoriesById(grouped.in_progress);
  grouped.done = sortStoriesById(grouped.done);

  return grouped;
}

// ============================================================================
// StoryCard Component
// ============================================================================

interface StoryCardProps {
  story: Story;
  allStories: Story[];
  onClick: () => void;
}

function StoryCard({ story, allStories, onClick }: StoryCardProps) {
  const [elapsedTime, setElapsedTime] = useState<string>('');
  const blocked = isStoryBlocked(story, allStories);
  const unmetDeps = getUnmetDependencies(story, allStories);

  // Update elapsed time every second for in_progress stories
  useEffect(() => {
    if (story.status !== 'in_progress' || !story.startedAt) return;

    setElapsedTime(formatElapsedTime(story.startedAt));

    const interval = setInterval(() => {
      setElapsedTime(formatElapsedTime(story.startedAt!));
    }, 1000);

    return () => clearInterval(interval);
  }, [story.status, story.startedAt]);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        story.status === 'open' && 'border-l-4 border-l-gray-400',
        story.status === 'in_progress' &&
          'border-l-4 border-l-blue-500 bg-blue-500/5',
        story.status === 'done' &&
          'border-l-4 border-l-green-500 bg-green-500/5'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-2">
          {/* ID and blocked indicator */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-medium text-primary">
              {story.id}
            </span>
            {blocked && (
              <span className="flex items-center gap-1 text-xs text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                Blocked
              </span>
            )}
          </div>

          {/* Title */}
          <p className="text-sm font-medium leading-tight line-clamp-2">
            {story.title}
          </p>

          {/* Blocked dependencies */}
          {blocked && unmetDeps.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Waiting on: {unmetDeps.join(', ')}
            </p>
          )}

          {/* In Progress: elapsed time */}
          {story.status === 'in_progress' && story.startedAt && (
            <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
              <Clock className="h-3.5 w-3.5 animate-pulse" />
              <span className="font-mono tabular-nums">
                {elapsedTime || '0s'}
              </span>
            </div>
          )}

          {/* Done: completion time */}
          {story.status === 'done' && story.startedAt && story.completedAt && (
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="font-mono">
                {formatCompletionTime(story.startedAt, story.completedAt)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// KanbanColumn Component
// ============================================================================

interface KanbanColumnProps {
  title: string;
  status: StoryStatus;
  stories: Story[];
  allStories: Story[];
  onStoryClick: (story: Story) => void;
  icon: React.ReactNode;
  headerClassName?: string;
}

function KanbanColumn({
  title,
  stories,
  allStories,
  onStoryClick,
  icon,
  headerClassName,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-h-[400px]">
      {/* Column header */}
      <div
        className={cn(
          'flex items-center gap-2 p-3 rounded-t-lg border-b',
          headerClassName
        )}
      >
        {icon}
        <span className="font-medium">{title}</span>
        <span className="ml-auto bg-muted rounded-full px-2 py-0.5 text-xs font-medium">
          {stories.length}
        </span>
      </div>

      {/* Column content */}
      <div className="flex-1 bg-muted/30 rounded-b-lg p-3 space-y-3 overflow-y-auto">
        {stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Circle className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              No stories in {title.toLowerCase()}
            </p>
          </div>
        ) : (
          stories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              allStories={allStories}
              onClick={() => onStoryClick(story)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// StoryDetailModal Component
// ============================================================================

interface StoryDetailModalProps {
  story: Story | null;
  allStories: Story[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StoryDetailModal({
  story,
  allStories,
  open,
  onOpenChange,
}: StoryDetailModalProps) {
  if (!story) return null;

  const blocked = isStoryBlocked(story, allStories);
  const unmetDeps = getUnmetDependencies(story, allStories);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {story.status === 'open' && (
              <Circle className="h-5 w-5 text-gray-500" />
            )}
            {story.status === 'in_progress' && (
              <PlayCircle className="h-5 w-5 text-blue-500" />
            )}
            {story.status === 'done' && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-primary">{story.id}</span>
              <span className="font-normal text-muted-foreground">|</span>
              <span>{story.title}</span>
            </DialogTitle>
          </div>
          <DialogDescription>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                story.status === 'open' && 'bg-gray-500/10 text-gray-600',
                story.status === 'in_progress' && 'bg-blue-500/10 text-blue-600',
                story.status === 'done' && 'bg-green-500/10 text-green-600'
              )}
            >
              {story.status === 'open' && 'Open'}
              {story.status === 'in_progress' && 'In Progress'}
              {story.status === 'done' && 'Done'}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Blocked indicator */}
          {blocked && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  This story is blocked
                </p>
                <p className="text-sm text-muted-foreground">
                  Waiting on: {unmetDeps.join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Description</h4>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {story.description || 'No description provided'}
            </p>
          </div>

          {/* Acceptance Criteria */}
          {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <List className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Acceptance Criteria</h4>
              </div>
              <ul className="space-y-2">
                {story.acceptanceCriteria.map((criterion, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="text-muted-foreground/50 mt-0.5">-</span>
                    <span>{criterion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Dependencies */}
          {story.dependsOn && story.dependsOn.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Dependencies</h4>
              <div className="flex flex-wrap gap-2">
                {story.dependsOn.map((depId) => {
                  const dep = allStories.find((s) => s.id === depId);
                  const isDone = dep?.status === 'done';
                  return (
                    <span
                      key={depId}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono',
                        isDone
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Circle className="h-3 w-3" />
                      )}
                      {depId}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Timestamps</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {story.startedAt && (
                <div>
                  <span className="text-muted-foreground">Started:</span>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(story.startedAt), {
                      addSuffix: true,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(story.startedAt).toLocaleString()}
                  </p>
                </div>
              )}
              {story.completedAt && (
                <div>
                  <span className="text-muted-foreground">Completed:</span>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(story.completedAt), {
                      addSuffix: true,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(story.completedAt).toLocaleString()}
                  </p>
                </div>
              )}
              {story.startedAt && story.completedAt && (
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <p className="font-medium font-mono">
                    {formatCompletionTime(story.startedAt, story.completedAt)}
                  </p>
                </div>
              )}
              {story.updatedAt && (
                <div>
                  <span className="text-muted-foreground">Last Updated:</span>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(story.updatedAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// StoriesTab Component
// ============================================================================

export function StoriesTab({ project }: StoriesTabProps) {
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const stories = project.prd?.stories ?? [];
  const groupedStories = useMemo(
    () => groupStoriesByStatus(stories),
    [stories]
  );

  const handleStoryClick = (story: Story) => {
    setSelectedStory(story);
    setModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setSelectedStory(null);
    }
  };

  if (!project.prd || stories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Circle className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              No stories found in the PRD
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Open Column */}
        <KanbanColumn
          title="Open"
          status="open"
          stories={groupedStories.open}
          allStories={stories}
          onStoryClick={handleStoryClick}
          icon={<Circle className="h-4 w-4 text-gray-500" />}
          headerClassName="bg-gray-500/10"
        />

        {/* In Progress Column */}
        <KanbanColumn
          title="In Progress"
          status="in_progress"
          stories={groupedStories.in_progress}
          allStories={stories}
          onStoryClick={handleStoryClick}
          icon={<PlayCircle className="h-4 w-4 text-blue-500" />}
          headerClassName="bg-blue-500/10"
        />

        {/* Done Column */}
        <KanbanColumn
          title="Done"
          status="done"
          stories={groupedStories.done}
          allStories={stories}
          onStoryClick={handleStoryClick}
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          headerClassName="bg-green-500/10"
        />
      </div>

      {/* Story Detail Modal */}
      <StoryDetailModal
        story={selectedStory}
        allStories={stories}
        open={modalOpen}
        onOpenChange={handleModalClose}
      />
    </>
  );
}
