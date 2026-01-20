import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Project } from '@/stores/projectStore';

interface ProgressTabProps {
  project: Project;
}

export function ProgressTab({ project }: ProgressTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Progress log for <span className="font-medium">{project.name}</span> will be implemented in US-019.
        </p>
      </CardContent>
    </Card>
  );
}
