import { FolderOpen, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProjectCard } from '@/components/ProjectCard';
import { AddProjectDialog } from '@/components/AddProjectDialog';
import { useProjects } from '@/hooks/useApi';

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-col items-center justify-center py-10 text-center">
        <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <CardTitle className="text-lg">No projects registered</CardTitle>
        <CardDescription className="max-w-sm mt-2">
          Register a project to start monitoring. Projects with a .ralph/
          directory can be added for real-time updates.
        </CardDescription>
        <div className="mt-6">
          <AddProjectDialog />
        </div>
      </CardHeader>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading projects...</p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="flex flex-col items-center justify-center py-10 text-center">
        <AlertCircle className="h-12 w-12 text-destructive/50 mb-4" />
        <CardTitle className="text-lg text-destructive">Failed to load projects</CardTitle>
        <CardDescription className="max-w-sm mt-2">
          {message}
        </CardDescription>
        <div className="mt-6">
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

export function ProjectsPage() {
  const { data: projects, isLoading, error, refetch } = useProjects();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Monitor your Ralph agent projects in real-time.
          </p>
        </div>
        {projects && projects.length > 0 && <AddProjectDialog />}
      </div>

      {isLoading && <LoadingState />}

      {error && !isLoading && <ErrorState message={error} onRetry={refetch} />}

      {!isLoading && !error && (!projects || projects.length === 0) && (
        <EmptyState />
      )}

      {!isLoading && !error && projects && projects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
