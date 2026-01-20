import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { FolderOpen, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Project } from '@/stores/projectStore';

interface ProjectCardProps {
  project: Project;
}

function StatusBadge({ isRunning }: { isRunning: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        isRunning
          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
          : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
        )}
      />
      {isRunning ? 'Running' : 'Idle'}
    </span>
  );
}

function getCurrentStory(project: Project): string | null {
  if (!project.prd?.stories) return null;
  const inProgressStory = project.prd.stories.find(
    (story) => story.status === 'in_progress'
  );
  return inProgressStory ? inProgressStory.id : null;
}

function getLastActivityTime(project: Project): string | null {
  // Try to get the last activity from the PRD's updatedAt timestamp
  // or from stories' updatedAt timestamps
  if (project.prd?.stories) {
    const latestUpdatedAt = project.prd.stories
      .map((s) => s.updatedAt)
      .filter((d): d is string => d !== null && d !== undefined)
      .sort()
      .reverse()[0];
    if (latestUpdatedAt) {
      return latestUpdatedAt;
    }
  }
  // Fall back to addedAt
  return project.addedAt;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const storyCount = project.storyCount ?? project.prd?.stories?.length ?? 0;
  const doneCount = project.doneCount ?? project.prd?.stories?.filter((s) => s.status === 'done').length ?? 0;
  const isRunning = project.isRunning ?? (project.inProgressCount ?? 0) > 0;
  const currentStory = getCurrentStory(project);
  const lastActivity = getLastActivityTime(project);

  return (
    <Link to={`/projects/${encodeURIComponent(project.id)}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">{project.name}</CardTitle>
            </div>
            <StatusBadge isRunning={isRunning} />
          </div>
          <CardDescription className="truncate font-mono text-xs">
            {project.path}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">
                {doneCount}/{storyCount} stories
              </span>
            </div>
            <Progress value={doneCount} max={storyCount || 1} />
          </div>

          {/* Current story if running */}
          {isRunning && currentStory && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Current:</span>
              <span className="font-medium text-primary">{currentStory}</span>
            </div>
          )}

          {/* Last activity */}
          {lastActivity && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {formatDistanceToNow(new Date(lastActivity), { addSuffix: true })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
