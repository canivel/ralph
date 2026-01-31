import { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronUp,
  Home,
  HardDrive,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isRalphProject: boolean;
}

interface BrowseResponse {
  currentPath: string;
  parentPath: string | null;
  entries: DirectoryEntry[];
  roots: { name: string; path: string }[];
}

interface FolderBrowserProps {
  onSelect: (path: string) => void;
  initialPath?: string;
  className?: string;
}

export function FolderBrowser({
  onSelect,
  initialPath,
  className,
}: FolderBrowserProps) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [roots, setRoots] = useState<{ name: string; path: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState('');

  // Fetch directory contents
  const browse = async (path?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = path
        ? `/api/filesystem/browse?path=${encodeURIComponent(path)}`
        : '/api/filesystem/browse';

      const response = await fetch(url);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to browse directory');
      }

      const data: BrowseResponse = await response.json();
      setCurrentPath(data.currentPath);
      setParentPath(data.parentPath);
      setEntries(data.entries);
      setRoots(data.roots);
      setPathInput(data.currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    browse(initialPath);
  }, [initialPath]);

  // Handle path input submission
  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathInput.trim()) {
      browse(pathInput.trim());
    }
  };

  // Navigate to a directory
  const navigateTo = (path: string) => {
    browse(path);
  };

  // Go to parent directory
  const goUp = () => {
    if (parentPath) {
      browse(parentPath);
    }
  };

  // Go to home directory
  const goHome = async () => {
    try {
      const response = await fetch('/api/filesystem/home');
      const data = await response.json();
      browse(data.path);
    } catch {
      // Fall back to current path
    }
  };

  // Select current directory
  const selectCurrent = () => {
    onSelect(currentPath);
  };

  // Select a specific directory
  const selectDirectory = (entry: DirectoryEntry) => {
    if (entry.isRalphProject) {
      onSelect(entry.path);
    } else {
      navigateTo(entry.path);
    }
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Path input */}
      <form onSubmit={handlePathSubmit} className="flex gap-2">
        <Input
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          placeholder="Enter path..."
          className="flex-1 font-mono text-sm"
        />
        <Button type="submit" variant="outline" size="sm">
          Go
        </Button>
      </form>

      {/* Navigation buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={goUp}
          disabled={!parentPath || isLoading}
        >
          <ChevronUp className="mr-1 h-4 w-4" />
          Up
        </Button>
        <Button variant="outline" size="sm" onClick={goHome} disabled={isLoading}>
          <Home className="mr-1 h-4 w-4" />
          Home
        </Button>
        {/* Root drives */}
        {roots.map((root) => (
          <Button
            key={root.path}
            variant="outline"
            size="sm"
            onClick={() => navigateTo(root.path)}
            disabled={isLoading}
          >
            <HardDrive className="mr-1 h-4 w-4" />
            {root.name}
          </Button>
        ))}
      </div>

      {/* Current path display */}
      <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
        <code className="text-sm truncate flex-1">{currentPath}</code>
        <Button
          size="sm"
          variant="ghost"
          onClick={selectCurrent}
          disabled={isLoading}
          className="ml-2 shrink-0"
        >
          Select This Folder
        </Button>
      </div>

      {/* Directory listing */}
      <ScrollArea className="h-[280px] rounded-md border">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full p-4">
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-full p-4">
            <p className="text-sm text-muted-foreground">No subdirectories</p>
          </div>
        ) : (
          <div className="p-2">
            {entries.map((entry) => (
              <button
                key={entry.path}
                onClick={() => selectDirectory(entry)}
                onDoubleClick={() => navigateTo(entry.path)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  entry.isRalphProject &&
                    'bg-primary/5 hover:bg-primary/10 border border-primary/20'
                )}
              >
                {entry.isRalphProject ? (
                  <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="truncate flex-1">{entry.name}</span>
                {entry.isRalphProject ? (
                  <span className="flex items-center gap-1 text-xs text-primary shrink-0">
                    <CheckCircle2 className="h-3 w-3" />
                    Ralph Project
                  </span>
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Help text */}
      <p className="text-xs text-muted-foreground">
        Click a folder to navigate, or click a{' '}
        <span className="text-primary">Ralph project</span> to select it.
        Double-click to navigate into any folder.
      </p>
    </div>
  );
}
