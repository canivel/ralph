import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Project } from '@/stores/projectStore';

interface GuardrailsTabProps {
  project: Project;
}

export function GuardrailsTab({ project }: GuardrailsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Guardrails</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Guardrails view for <span className="font-medium">{project.name}</span> will be implemented in US-019.
        </p>
      </CardContent>
    </Card>
  );
}
