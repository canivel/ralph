import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Project } from '@/stores/projectStore';

interface StoriesTabProps {
  project: Project;
}

export function StoriesTab({ project }: StoriesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stories</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Stories kanban board for <span className="font-medium">{project.name}</span> will be implemented in US-016.
        </p>
      </CardContent>
    </Card>
  );
}
