import { useState } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { useProjectStore } from '@/stores/projectStore';

interface AddProjectDialogProps {
  onSuccess?: () => void;
}

export function AddProjectDialog({ onSuccess }: AddProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addProject = useProjectStore((state) => state.addProject);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!path.trim()) {
      setError('Path is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const project = await api.registerProject(
        path.trim(),
        name.trim() || undefined
      );
      addProject(project);
      setOpen(false);
      setPath('');
      setName('');
      onSuccess?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.userMessage);
      } else {
        setError('Failed to register project. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when dialog closes
      setPath('');
      setName('');
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <FolderPlus className="mr-2 h-4 w-4" />
          Add Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
            <DialogDescription>
              Register a project directory to monitor. The directory must contain
              a .ralph/ folder.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="path">Project Path</Label>
              <Input
                id="path"
                placeholder="/path/to/your/project"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                disabled={isLoading}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter the absolute path to a directory containing .ralph/
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Display Name (optional)</Label>
              <Input
                id="name"
                placeholder="My Project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                A friendly name for the project. Defaults to the directory name.
              </p>
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Adding...' : 'Add Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
