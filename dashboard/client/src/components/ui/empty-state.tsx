import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Consistent empty state component for displaying when no data is available.
 * Used across all tabs and views for a unified look.
 */
export function EmptyState({ message, icon, className }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 text-center',
      className
    )}>
      {icon || <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />}
      {!icon && <div className="mb-4" />}
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
