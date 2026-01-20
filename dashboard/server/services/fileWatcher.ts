/**
 * File Watcher Service
 * Uses chokidar to watch Ralph project directories for changes.
 * Emits events when files change with appropriate debouncing.
 */

import chokidar, { type FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { join, relative, normalize } from 'path';

// ============================================================================
// Types
// ============================================================================

/**
 * File type categories for watched files
 */
export type FileType =
  | 'prd'           // .agents/tasks/*.json
  | 'progress'      // .ralph/progress.md
  | 'activity'      // .ralph/activity.log
  | 'errors'        // .ralph/errors.log
  | 'guardrails'    // .ralph/guardrails.md
  | 'run'           // .ralph/runs/*
  | 'unknown';

/**
 * Change event emitted by the file watcher
 */
export interface FileChangeEvent {
  projectId: string;
  fileType: FileType;
  path: string;
  event: 'add' | 'change' | 'unlink';
}

/**
 * Project watcher state
 */
interface ProjectWatcher {
  projectId: string;
  projectPath: string;
  watcher: FSWatcher;
  debounceTimers: Map<string, NodeJS.Timeout>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Watch patterns for Ralph project files
 */
const WATCH_PATTERNS = [
  '.agents/tasks/*.json',
  '.ralph/progress.md',
  '.ralph/activity.log',
  '.ralph/errors.log',
  '.ralph/guardrails.md',
  '.ralph/runs/*',
];

/**
 * Debounce times in milliseconds
 */
const DEBOUNCE_TIMES: Record<FileType, number> = {
  prd: 500,           // Structural files - less frequent updates
  progress: 500,      // Structural files
  guardrails: 500,    // Structural files
  activity: 100,      // Logs - more frequent updates
  errors: 100,        // Logs
  run: 100,           // Run logs
  unknown: 500,       // Default to slower debounce
};

// ============================================================================
// FileWatcher Class
// ============================================================================

/**
 * File watcher service that monitors Ralph project directories
 * and emits events when relevant files change.
 */
export class FileWatcher extends EventEmitter {
  private watchers: Map<string, ProjectWatcher> = new Map();

  /**
   * Create a new FileWatcher instance
   */
  constructor() {
    super();
  }

  /**
   * Start watching a project directory
   * @param projectId - Unique identifier for the project
   * @param projectPath - Absolute path to the project directory
   * @returns true if watching started successfully, false otherwise
   */
  watchProject(projectId: string, projectPath: string): boolean {
    // Check if already watching this project
    if (this.watchers.has(projectId)) {
      return true; // Already watching
    }

    // Validate project path exists
    if (!existsSync(projectPath)) {
      return false;
    }

    // Build absolute watch paths
    const watchPaths = WATCH_PATTERNS.map(pattern =>
      join(projectPath, pattern).replace(/\\/g, '/')
    );

    // Create chokidar watcher with appropriate options
    const watcher = chokidar.watch(watchPaths, {
      persistent: true,
      ignoreInitial: true, // Don't emit events for existing files
      awaitWriteFinish: {
        stabilityThreshold: 50,
        pollInterval: 10,
      },
      usePolling: false, // Use native events when possible
      ignorePermissionErrors: true, // Don't crash on permission errors
    });

    // Create project watcher state
    const projectWatcher: ProjectWatcher = {
      projectId,
      projectPath,
      watcher,
      debounceTimers: new Map(),
    };

    // Set up event handlers
    watcher.on('add', (filePath) => this.handleFileEvent(projectWatcher, filePath, 'add'));
    watcher.on('change', (filePath) => this.handleFileEvent(projectWatcher, filePath, 'change'));
    watcher.on('unlink', (filePath) => this.handleFileEvent(projectWatcher, filePath, 'unlink'));

    // Handle errors gracefully
    watcher.on('error', (error) => {
      this.emit('error', { projectId, error });
    });

    // Handle watcher ready state
    watcher.on('ready', () => {
      this.emit('ready', { projectId });
    });

    // Store the watcher
    this.watchers.set(projectId, projectWatcher);

    return true;
  }

  /**
   * Stop watching a project directory
   * @param projectId - Unique identifier for the project
   * @returns true if unwatched successfully, false if not watching
   */
  async unwatchProject(projectId: string): Promise<boolean> {
    const projectWatcher = this.watchers.get(projectId);
    if (!projectWatcher) {
      return false; // Not watching this project
    }

    // Clear all pending debounce timers
    for (const timer of projectWatcher.debounceTimers.values()) {
      clearTimeout(timer);
    }
    projectWatcher.debounceTimers.clear();

    // Close the watcher
    await projectWatcher.watcher.close();

    // Remove from watchers map
    this.watchers.delete(projectId);

    return true;
  }

  /**
   * Check if a project is currently being watched
   * @param projectId - Unique identifier for the project
   * @returns true if watching, false otherwise
   */
  isWatching(projectId: string): boolean {
    return this.watchers.has(projectId);
  }

  /**
   * Get list of all watched project IDs
   * @returns Array of project IDs
   */
  getWatchedProjects(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Stop watching all projects and clean up
   */
  async close(): Promise<void> {
    const projectIds = Array.from(this.watchers.keys());
    await Promise.all(projectIds.map(id => this.unwatchProject(id)));
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Handle a file system event with debouncing
   */
  private handleFileEvent(
    projectWatcher: ProjectWatcher,
    filePath: string,
    event: 'add' | 'change' | 'unlink'
  ): void {
    const { projectId, projectPath, debounceTimers } = projectWatcher;

    // Normalize the file path
    const normalizedPath = normalize(filePath).replace(/\\/g, '/');

    // Determine file type
    const fileType = this.getFileType(projectPath, normalizedPath);

    // Get debounce time for this file type
    const debounceTime = DEBOUNCE_TIMES[fileType];

    // Clear existing timer for this file if any
    const existingTimer = debounceTimers.get(normalizedPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced timer
    const timer = setTimeout(() => {
      debounceTimers.delete(normalizedPath);

      const changeEvent: FileChangeEvent = {
        projectId,
        fileType,
        path: normalizedPath,
        event,
      };

      this.emit('change', changeEvent);
    }, debounceTime);

    debounceTimers.set(normalizedPath, timer);
  }

  /**
   * Determine the file type based on the path
   */
  private getFileType(projectPath: string, filePath: string): FileType {
    // Get path relative to project
    const relativePath = relative(projectPath, filePath).replace(/\\/g, '/');

    // Check against known patterns
    if (relativePath.startsWith('.agents/tasks/') && relativePath.endsWith('.json')) {
      return 'prd';
    }
    if (relativePath === '.ralph/progress.md') {
      return 'progress';
    }
    if (relativePath === '.ralph/activity.log') {
      return 'activity';
    }
    if (relativePath === '.ralph/errors.log') {
      return 'errors';
    }
    if (relativePath === '.ralph/guardrails.md') {
      return 'guardrails';
    }
    if (relativePath.startsWith('.ralph/runs/')) {
      return 'run';
    }

    return 'unknown';
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default file watcher instance for the dashboard
 */
let defaultInstance: FileWatcher | null = null;

/**
 * Get or create the default file watcher instance
 */
export function getFileWatcher(): FileWatcher {
  if (!defaultInstance) {
    defaultInstance = new FileWatcher();
  }
  return defaultInstance;
}

/**
 * Create a new file watcher instance (useful for testing)
 */
export function createFileWatcher(): FileWatcher {
  return new FileWatcher();
}
