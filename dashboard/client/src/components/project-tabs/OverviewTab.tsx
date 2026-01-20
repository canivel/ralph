import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Project } from '@/stores/projectStore';

interface OverviewTabProps {
  project: Project;
}

export function OverviewTab({ project }: OverviewTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Project overview for <span className="font-medium">{project.name}</span> will be implemented in US-015.
        </p>
      </CardContent>
    </Card>
  );
}
