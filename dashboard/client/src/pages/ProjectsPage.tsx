import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">
          Monitor your Ralph agent projects in real-time.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardHeader>
            <CardTitle className="text-lg">No projects registered</CardTitle>
            <CardDescription>
              Register a project to start monitoring. Projects with a .ralph/
              directory can be added for real-time updates.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
