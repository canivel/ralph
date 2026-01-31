/**
 * Filesystem API routes
 * Handles directory browsing for the folder picker UI
 */

import { Router, Request, Response } from 'express';
import { join, dirname, resolve } from 'path';
import { existsSync, statSync } from 'fs';
import { readdir } from 'fs/promises';
import { homedir } from 'os';

const router = Router();

/**
 * Directory entry returned by the browse endpoint
 */
interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isRalphProject: boolean;
}

/**
 * Browse response with current path and entries
 */
interface BrowseResponse {
  currentPath: string;
  parentPath: string | null;
  entries: DirectoryEntry[];
  roots: { name: string; path: string }[];
}

/**
 * Get system root paths (drives on Windows, / on Unix)
 */
function getSystemRoots(): { name: string; path: string }[] {
  if (process.platform === 'win32') {
    // On Windows, check common drive letters
    const drives: { name: string; path: string }[] = [];
    for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
      const drivePath = `${letter}:\\`;
      if (existsSync(drivePath)) {
        drives.push({ name: `${letter}:`, path: drivePath });
      }
    }
    return drives;
  } else {
    // On Unix, root is /
    return [{ name: '/', path: '/' }];
  }
}

/**
 * Check if a directory is a Ralph project (contains .ralph/)
 */
function isRalphProject(dirPath: string): boolean {
  try {
    const ralphPath = join(dirPath, '.ralph');
    return existsSync(ralphPath) && statSync(ralphPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Safely resolve and validate a path
 * Prevents path traversal attacks
 */
function safePath(inputPath: string): string | null {
  try {
    const resolved = resolve(inputPath);
    // Ensure the path exists
    if (!existsSync(resolved)) {
      return null;
    }
    return resolved;
  } catch {
    return null;
  }
}

/**
 * GET /api/filesystem/browse
 * Browse a directory and list its contents
 * Query params:
 *   - path: Directory path to browse (default: home directory)
 */
router.get('/browse', async (req: Request, res: Response) => {
  try {
    const requestedPath = (req.query.path as string) || homedir();

    // Validate and resolve the path
    const currentPath = safePath(requestedPath);
    if (!currentPath) {
      res.status(400).json({ error: 'Invalid or non-existent path' });
      return;
    }

    // Ensure it's a directory
    try {
      const stats = statSync(currentPath);
      if (!stats.isDirectory()) {
        res.status(400).json({ error: 'Path is not a directory' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Cannot access path' });
      return;
    }

    // Get parent path
    const parentPath = dirname(currentPath);
    const hasParent = parentPath !== currentPath; // Root has no parent

    // Read directory contents
    let dirEntries: string[];
    try {
      dirEntries = await readdir(currentPath);
    } catch (err) {
      res.status(403).json({ error: 'Permission denied reading directory' });
      return;
    }

    // Filter and map entries
    const entries: DirectoryEntry[] = [];
    for (const name of dirEntries) {
      // Skip hidden files/folders (starting with .)
      if (name.startsWith('.')) {
        continue;
      }

      const entryPath = join(currentPath, name);
      try {
        const stats = statSync(entryPath);
        if (stats.isDirectory()) {
          entries.push({
            name,
            path: entryPath,
            isDirectory: true,
            isRalphProject: isRalphProject(entryPath),
          });
        }
        // Skip files - we only show directories for folder selection
      } catch {
        // Skip entries we can't stat (permission issues, etc.)
      }
    }

    // Sort: Ralph projects first, then alphabetically
    entries.sort((a, b) => {
      if (a.isRalphProject && !b.isRalphProject) return -1;
      if (!a.isRalphProject && b.isRalphProject) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    const response: BrowseResponse = {
      currentPath,
      parentPath: hasParent ? parentPath : null,
      entries,
      roots: getSystemRoots(),
    };

    res.json(response);
  } catch (error) {
    console.error('Error browsing filesystem:', error);
    res.status(500).json({ error: 'Failed to browse filesystem' });
  }
});

/**
 * GET /api/filesystem/validate
 * Validate if a path is a valid Ralph project
 * Query params:
 *   - path: Path to validate
 */
router.get('/validate', async (req: Request, res: Response) => {
  try {
    const requestedPath = req.query.path as string;

    if (!requestedPath) {
      res.status(400).json({ error: 'Missing path parameter' });
      return;
    }

    const validPath = safePath(requestedPath);
    if (!validPath) {
      res.json({ valid: false, error: 'Path does not exist' });
      return;
    }

    try {
      const stats = statSync(validPath);
      if (!stats.isDirectory()) {
        res.json({ valid: false, error: 'Path is not a directory' });
        return;
      }
    } catch {
      res.json({ valid: false, error: 'Cannot access path' });
      return;
    }

    const isProject = isRalphProject(validPath);
    res.json({
      valid: isProject,
      path: validPath,
      error: isProject ? null : 'Directory does not contain .ralph/',
    });
  } catch (error) {
    console.error('Error validating path:', error);
    res.status(500).json({ error: 'Failed to validate path' });
  }
});

/**
 * GET /api/filesystem/home
 * Get the user's home directory path
 */
router.get('/home', (_req: Request, res: Response) => {
  res.json({ path: homedir() });
});

export default router;
