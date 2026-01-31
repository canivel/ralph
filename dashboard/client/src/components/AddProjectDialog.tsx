import { useState } from 'react';
import { FolderPlus, Loader2, FolderSearch, Keyboard } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolderBrowser } from '@/components/FolderBrowser';
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
  const [activeTab, setActiveTab] = useState<'browse' | 'manual'>('browse');

  const addProject = useProjectStore((state) => state.addProject);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

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

  const handleBrowseSelect = (selectedPath: string) => {
    setPath(selectedPath);
    setError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when dialog closes
      setPath('');
      setName('');
      setError(null);
      setActiveTab('browse');
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Project</DialogTitle>
          <DialogDescription>
            Register a project directory to monitor. The directory must contain
            a .ralph/ folder.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'browse' | 'manual')}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="browse" className="flex items-center gap-2">
              <FolderSearch className="h-4 w-4" />
              Browse
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Type Path
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="mt-4">
            <FolderBrowser onSelect={handleBrowseSelect} />
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <div className="grid gap-2">
              <Label htmlFor="path">Project Path</Label>
              <Input
                id="path"
                placeholder="/path/to/your/project"
                value={path}
                onChange={(e) => {
                  setPath(e.target.value);
                  setError(null);
                }}
                disabled={isLoading}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter the absolute path to a directory containing .ralph/
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Selected path display */}
        {path && (
          <div className="rounded-md bg-muted px-3 py-2">
            <Label className="text-xs text-muted-foreground">Selected Path</Label>
            <code className="block text-sm mt-1 truncate">{path}</code>
          </div>
        )}

        {/* Optional name input */}
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

        {/* Error display */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={() => handleSubmit()} disabled={isLoading || !path.trim()}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Adding...' : 'Add Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
