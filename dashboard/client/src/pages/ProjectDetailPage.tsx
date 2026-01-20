import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, RefreshCw, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useProject, useRuns } from '@/hooks/useApi';
import {
  OverviewTab,
  StoriesTab,
  RunsTab,
  LogsTab,
  ProgressTab,
  GuardrailsTab,
} from '@/components/project-tabs';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'stories', label: 'Stories' },
  { value: 'runs', label: 'Runs' },
  { value: 'logs', label: 'Logs' },
  { value: 'progress', label: 'Progress' },
  { value: 'guardrails', label: 'Guardrails' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

const DEFAULT_TAB: TabValue = 'overview';

function isValidTab(tab: string | null): tab is TabValue {
  return tab !== null && TABS.some((t) => t.value === tab);
}

function StatusBadge({ isRunning }: { isRunning: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        isRunning
          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
          : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
      )}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
        )}
      />
      {isRunning ? 'Running' : 'Idle'}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading project...</p>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Not Found</h1>
        </div>
      </div>
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader className="flex flex-col items-center justify-center py-10 text-center">
          <AlertCircle className="h-12 w-12 text-destructive/50 mb-4" />
          <CardTitle className="text-lg text-destructive">404 - Project not found</CardTitle>
          <p className="max-w-sm mt-2 text-muted-foreground">
            The project you're looking for doesn't exist or may have been removed.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link to="/">Return to Projects</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Error</h1>
        </div>
      </div>
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader className="flex flex-col items-center justify-center py-10 text-center">
          <AlertCircle className="h-12 w-12 text-destructive/50 mb-4" />
          <CardTitle className="text-lg text-destructive">Failed to load project</CardTitle>
          <p className="max-w-sm mt-2 text-muted-foreground">{message}</p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
            <Button asChild>
              <Link to="/">Return to Projects</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: project, isLoading, error, refetch } = useProject(id ?? null);
  const { data: runs } = useRuns(id ?? null);

  // Get current tab from URL or default
  const tabParam = searchParams.get('tab');
  const currentTab: TabValue = isValidTab(tabParam) ? tabParam : DEFAULT_TAB;

  // Handle tab change - update URL
  const handleTabChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === DEFAULT_TAB) {
      newParams.delete('tab');
    } else {
      newParams.set('tab', value);
    }
    setSearchParams(newParams, { replace: true });
  };

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // 404 - Check if error is a 404 or if project is null after loading
  if (error?.includes('not found') || error?.includes('404') || (!isLoading && !project && !error)) {
    return <NotFoundState />;
  }

  // Error state
  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  // Should not reach here, but just in case
  if (!project) {
    return <NotFoundState />;
  }

  // Compute stats
  const storyCount = project.storyCount ?? project.prd?.stories?.length ?? 0;
  const doneCount = project.doneCount ?? project.prd?.stories?.filter((s) => s.status === 'done').length ?? 0;
  const isRunning = project.isRunning ?? (project.inProgressCount ?? 0) > 0;
  const runCount = runs?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="mt-1">
          <Link to="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <FolderOpen className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight truncate">{project.name}</h1>
            <StatusBadge isRunning={isRunning} />
          </div>
          <p className="text-sm text-muted-foreground font-mono truncate mt-1">
            {project.path}
          </p>
          {/* Quick stats */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Stories:</span>
              <span className="text-sm font-medium">{doneCount}/{storyCount}</span>
              <Progress value={doneCount} max={storyCount || 1} className="w-20 h-2" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Runs:</span>
              <span className="text-sm font-medium">{runCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab project={project} />
        </TabsContent>

        <TabsContent value="stories">
          <StoriesTab project={project} />
        </TabsContent>

        <TabsContent value="runs">
          <RunsTab project={project} />
        </TabsContent>

        <TabsContent value="logs">
          <LogsTab project={project} />
        </TabsContent>

        <TabsContent value="progress">
          <ProgressTab project={project} />
        </TabsContent>

        <TabsContent value="guardrails">
          <GuardrailsTab project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
