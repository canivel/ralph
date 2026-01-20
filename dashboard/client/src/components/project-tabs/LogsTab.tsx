import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Project } from '@/stores/projectStore';

interface LogsTabProps {
  project: Project;
}

export function LogsTab({ project }: LogsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Logs viewer for <span className="font-medium">{project.name}</span> will be implemented in US-018.
        </p>
      </CardContent>
    </Card>
  );
}
