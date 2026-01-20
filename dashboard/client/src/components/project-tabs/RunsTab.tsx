import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Project } from '@/stores/projectStore';

interface RunsTabProps {
  project: Project;
}

export function RunsTab({ project }: RunsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Runs</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Runs timeline for <span className="font-medium">{project.name}</span> will be implemented in US-017.
        </p>
      </CardContent>
    </Card>
  );
}
