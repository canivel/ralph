import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function StoryCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-14" />
          </div>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanColumnSkeleton() {
  return (
    <div className="flex flex-col min-h-[400px]">
      {/* Column header */}
      <div className="flex items-center gap-2 p-3 rounded-t-lg border-b bg-muted/30">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-5 w-24" />
        <div className="ml-auto">
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
      </div>
      {/* Column content */}
      <div className="flex-1 bg-muted/30 rounded-b-lg p-3 space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <StoryCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function StoryBoardSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <KanbanColumnSkeleton />
      <KanbanColumnSkeleton />
      <KanbanColumnSkeleton />
    </div>
  );
}
