import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function RunRowSkeleton() {
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 p-4 border-b last:border-b-0">
      <Skeleton className="h-4 w-4" />
      <div className="min-w-0">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16 mt-1" />
      </div>
      <Skeleton className="h-4 w-8 hidden sm:block" />
      <div className="hidden md:block">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-24 mt-1" />
      </div>
      <Skeleton className="h-4 w-12 hidden sm:block" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

export function RunsTableSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </CardHeader>
      <CardContent className="p-0">
        <div className="border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 p-4 border-b bg-muted/50">
            <div className="w-4" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-8 hidden sm:block" />
            <Skeleton className="h-4 w-12 hidden md:block" />
            <Skeleton className="h-4 w-16 hidden sm:block" />
            <Skeleton className="h-4 w-12" />
          </div>
          {/* Rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <RunRowSkeleton key={i} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
