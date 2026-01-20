/**
 * Project Manager Service
 * Handles project registration, storage, and retrieval.
 * Projects are stored in ~/.ralph/dashboard.json
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import type { Project } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration file structure for dashboard
 */
interface DashboardConfig {
  version: number;
  projects: Project[];
}

// ============================================================================
// Constants
// ============================================================================

const CONFIG_DIR = join(homedir(), '.ralph');
const CONFIG_FILE = join(CONFIG_DIR, 'dashboard.json');
const CONFIG_VERSION = 1;

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Ensure the config directory exists
 */
async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load the dashboard config from disk
 */
async function loadConfig(): Promise<DashboardConfig> {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return { version: CONFIG_VERSION, projects: [] };
    }
    const content = await readFile(CONFIG_FILE, 'utf-8');
    const data = JSON.parse(content);

    // Validate structure
    if (typeof data.version !== 'number' || !Array.isArray(data.projects)) {
      return { version: CONFIG_VERSION, projects: [] };
    }

    return data as DashboardConfig;
  } catch {
    return { version: CONFIG_VERSION, projects: [] };
  }
}

/**
 * Save the dashboard config to disk
 */
async function saveConfig(config: DashboardConfig): Promise<void> {
  await ensureConfigDir();
  const content = JSON.stringify(config, null, 2);
  await writeFile(CONFIG_FILE, content, 'utf-8');
}

/**
 * Validate that a path exists and contains a .ralph/ directory
 */
function validateProjectPath(projectPath: string): { valid: boolean; error?: string } {
  // Check if path exists
  if (!existsSync(projectPath)) {
    return { valid: false, error: `Path does not exist: ${projectPath}` };
  }

  // Check if it's a directory
  try {
    const stat = statSync(projectPath);
    if (!stat.isDirectory()) {
      return { valid: false, error: `Path is not a directory: ${projectPath}` };
    }
  } catch {
    return { valid: false, error: `Cannot access path: ${projectPath}` };
  }

  // Check for .ralph/ directory
  const ralphDir = join(projectPath, '.ralph');
  if (!existsSync(ralphDir)) {
    return { valid: false, error: `Path does not contain .ralph/ directory: ${projectPath}` };
  }

  try {
    const ralphStat = statSync(ralphDir);
    if (!ralphStat.isDirectory()) {
      return { valid: false, error: `.ralph is not a directory: ${ralphDir}` };
    }
  } catch {
    return { valid: false, error: `Cannot access .ralph directory: ${ralphDir}` };
  }

  return { valid: true };
}

/**
 * Generate a unique ID for a project
 */
function generateProjectId(): string {
  return uuidv4();
}

/**
 * Extract project name from path if not provided
 */
function extractProjectName(projectPath: string): string {
  // Get the last segment of the path
  const parts = projectPath.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] || 'Unknown Project';
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Register a new project
 * @param projectPath - Absolute path to the project directory
 * @param name - Optional project name (defaults to directory name)
 * @returns The registered project or an error
 */
export async function registerProject(
  projectPath: string,
  name?: string
): Promise<{ success: true; project: Project } | { success: false; error: string }> {
  // Validate the path
  const validation = validateProjectPath(projectPath);
  if (!validation.valid) {
    return { success: false, error: validation.error! };
  }

  // Load current config
  const config = await loadConfig();

  // Check if project is already registered (by path)
  const normalizedPath = projectPath.replace(/\\/g, '/');
  const existingProject = config.projects.find(
    p => p.path.replace(/\\/g, '/') === normalizedPath
  );
  if (existingProject) {
    return { success: false, error: `Project already registered with ID: ${existingProject.id}` };
  }

  // Create new project
  const project: Project = {
    id: generateProjectId(),
    path: projectPath,
    name: name || extractProjectName(projectPath),
    addedAt: new Date().toISOString(),
  };

  // Add to config and save
  config.projects.push(project);
  await saveConfig(config);

  return { success: true, project };
}

/**
 * Unregister a project by ID
 * @param id - Project ID to remove
 * @returns Success status
 */
export async function unregisterProject(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const config = await loadConfig();

  const index = config.projects.findIndex(p => p.id === id);
  if (index === -1) {
    return { success: false, error: `Project not found: ${id}` };
  }

  // Remove project
  config.projects.splice(index, 1);
  await saveConfig(config);

  return { success: true };
}

/**
 * List all registered projects
 * @returns Array of all registered projects
 */
export async function listProjects(): Promise<Project[]> {
  const config = await loadConfig();
  return config.projects;
}

/**
 * Get a single project by ID
 * @param id - Project ID to retrieve
 * @returns The project or null if not found
 */
export async function getProject(id: string): Promise<Project | null> {
  const config = await loadConfig();
  const project = config.projects.find(p => p.id === id);
  return project || null;
}

/**
 * Check if a path is a valid Ralph project (contains .ralph/ directory)
 * @param projectPath - Path to check
 * @returns Validation result
 */
export function isValidRalphProject(projectPath: string): boolean {
  const validation = validateProjectPath(projectPath);
  return validation.valid;
}

/**
 * Get the config file path (useful for testing/debugging)
 */
export function getConfigFilePath(): string {
  return CONFIG_FILE;
}
