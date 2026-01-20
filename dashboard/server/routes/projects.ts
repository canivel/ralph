/**
 * Projects API routes
 * Handles project registration, listing, and retrieval with computed fields
 */

import { Router, Request, Response } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import {
  registerProject,
  unregisterProject,
  listProjects,
  getProject,
} from '../services/projectManager.js';
import { parsePrd, parseActivityLog } from '../services/dataParser.js';
import type { Project, PRD } from '../types.js';

const router = Router();

/**
 * Extended project with computed fields
 */
interface ProjectWithStatus extends Project {
  storyCount: number;
  doneCount: number;
  isRunning: boolean;
}

/**
 * Project detail with full PRD data
 */
interface ProjectDetail extends ProjectWithStatus {
  prd: PRD | null;
}

/**
 * Find the PRD file for a project
 * Looks in .agents/tasks/ for .json files
 */
async function findPrdFile(projectPath: string): Promise<string | null> {
  const tasksDir = join(projectPath, '.agents', 'tasks');
  if (!existsSync(tasksDir)) {
    return null;
  }

  try {
    const files = await readdir(tasksDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    if (jsonFiles.length > 0) {
      // Return the first JSON file found (typically prd.json)
      return join(tasksDir, jsonFiles[0]);
    }
  } catch {
    // Directory read failed
  }

  return null;
}

/**
 * Check if a project has an active iteration running
 * by examining the activity log for an iteration start without a matching end
 */
async function checkIsRunning(projectPath: string): Promise<boolean> {
  const activityLogPath = join(projectPath, '.ralph', 'activity.log');
  const events = await parseActivityLog(activityLogPath);

  // Count iteration starts and ends
  let starts = 0;
  let ends = 0;
  for (const event of events) {
    if (event.type === 'iteration_start') {
      starts++;
    } else if (event.type === 'iteration_end') {
      ends++;
    }
  }

  // If there are more starts than ends, an iteration is running
  return starts > ends;
}

/**
 * Compute story counts from PRD
 */
function computeStoryCounts(prd: PRD | null): { storyCount: number; doneCount: number } {
  if (!prd || !prd.stories) {
    return { storyCount: 0, doneCount: 0 };
  }

  const storyCount = prd.stories.length;
  const doneCount = prd.stories.filter(s => s.status === 'done').length;

  return { storyCount, doneCount };
}

/**
 * Enrich a project with computed fields
 */
async function enrichProject(project: Project): Promise<ProjectWithStatus> {
  const prdFile = await findPrdFile(project.path);
  const prd = prdFile ? await parsePrd(prdFile) : null;
  const { storyCount, doneCount } = computeStoryCounts(prd);
  const isRunning = await checkIsRunning(project.path);

  return {
    ...project,
    storyCount,
    doneCount,
    isRunning,
  };
}

/**
 * GET /api/projects
 * List all registered projects with computed status fields
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const projects = await listProjects();
    const enrichedProjects: ProjectWithStatus[] = await Promise.all(
      projects.map(p => enrichProject(p))
    );
    res.json(enrichedProjects);
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

/**
 * POST /api/projects
 * Register a new project
 * Body: { path: string, name?: string }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { path: projectPath, name } = req.body;

    // Validate required path field
    if (!projectPath || typeof projectPath !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "path" field' });
      return;
    }

    // Trim and normalize path
    const normalizedPath = projectPath.trim();
    if (!normalizedPath) {
      res.status(400).json({ error: 'Path cannot be empty' });
      return;
    }

    // Validate name if provided
    if (name !== undefined && typeof name !== 'string') {
      res.status(400).json({ error: 'Invalid "name" field - must be a string' });
      return;
    }

    // Attempt to register the project
    const result = await registerProject(normalizedPath, name);

    if (!result.success) {
      // Check if it's a path validation error (invalid path)
      if (result.error.includes('does not exist') ||
          result.error.includes('not a directory') ||
          result.error.includes('Cannot access') ||
          result.error.includes('does not contain .ralph/')) {
        res.status(400).json({ error: result.error });
        return;
      }
      // Check if project already registered (conflict)
      if (result.error.includes('already registered')) {
        res.status(409).json({ error: result.error });
        return;
      }
      // Other errors
      res.status(500).json({ error: result.error });
      return;
    }

    // Success - return enriched project
    const enriched = await enrichProject(result.project);
    res.status(201).json(enriched);
  } catch (error) {
    console.error('Error registering project:', error);
    res.status(500).json({ error: 'Failed to register project' });
  }
});

/**
 * GET /api/projects/:id
 * Get project details with parsed PRD data
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get project by ID
    const project = await getProject(id);
    if (!project) {
      res.status(404).json({ error: `Project not found: ${id}` });
      return;
    }

    // Get PRD data
    const prdFile = await findPrdFile(project.path);
    const prd = prdFile ? await parsePrd(prdFile) : null;
    const { storyCount, doneCount } = computeStoryCounts(prd);
    const isRunning = await checkIsRunning(project.path);

    const projectDetail: ProjectDetail = {
      ...project,
      storyCount,
      doneCount,
      isRunning,
      prd,
    };

    res.json(projectDetail);
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

/**
 * DELETE /api/projects/:id
 * Unregister a project
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Attempt to unregister
    const result = await unregisterProject(id);

    if (!result.success) {
      if (result.error.includes('not found')) {
        res.status(404).json({ error: `Project not found: ${id}` });
        return;
      }
      res.status(500).json({ error: result.error });
      return;
    }

    // Success - return 204 No Content
    res.status(204).send();
  } catch (error) {
    console.error('Error unregistering project:', error);
    res.status(500).json({ error: 'Failed to unregister project' });
  }
});

/**
 * GET /api/projects/:id/prd
 * Get parsed PRD data for a project
 */
router.get('/:id/prd', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const project = await getProject(id);
    if (!project) {
      res.status(404).json({ error: `Project not found: ${id}` });
      return;
    }

    const prdFile = await findPrdFile(project.path);
    if (!prdFile) {
      res.status(404).json({ error: 'No PRD file found for project' });
      return;
    }

    const prd = await parsePrd(prdFile);
    if (!prd) {
      res.status(500).json({ error: 'Failed to parse PRD file' });
      return;
    }

    res.json(prd);
  } catch (error) {
    console.error('Error getting PRD:', error);
    res.status(500).json({ error: 'Failed to get PRD' });
  }
});

/**
 * GET /api/projects/:id/stories
 * Get stories with status for a project
 */
router.get('/:id/stories', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const project = await getProject(id);
    if (!project) {
      res.status(404).json({ error: `Project not found: ${id}` });
      return;
    }

    const prdFile = await findPrdFile(project.path);
    if (!prdFile) {
      res.json([]); // No PRD means no stories
      return;
    }

    const prd = await parsePrd(prdFile);
    if (!prd) {
      res.json([]); // Failed to parse PRD
      return;
    }

    res.json(prd.stories);
  } catch (error) {
    console.error('Error getting stories:', error);
    res.status(500).json({ error: 'Failed to get stories' });
  }
});

/**
 * GET /api/projects/:id/progress
 * Get progress.md content for a project
 */
router.get('/:id/progress', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const project = await getProject(id);
    if (!project) {
      res.status(404).json({ error: `Project not found: ${id}` });
      return;
    }

    const { parseProgressMd } = await import('../services/dataParser.js');
    const progressPath = join(project.path, '.ralph', 'progress.md');
    const progress = await parseProgressMd(progressPath);

    res.json(progress);
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

/**
 * GET /api/projects/:id/guardrails
 * Get guardrails.md content for a project
 */
router.get('/:id/guardrails', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const project = await getProject(id);
    if (!project) {
      res.status(404).json({ error: `Project not found: ${id}` });
      return;
    }

    const { parseGuardrailsMd } = await import('../services/dataParser.js');
    const guardrailsPath = join(project.path, '.ralph', 'guardrails.md');
    const guardrails = await parseGuardrailsMd(guardrailsPath);

    res.json(guardrails);
  } catch (error) {
    console.error('Error getting guardrails:', error);
    res.status(500).json({ error: 'Failed to get guardrails' });
  }
});

/**
 * GET /api/projects/:id/metrics
 * Get computed metrics for a project
 */
router.get('/:id/metrics', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const project = await getProject(id);
    if (!project) {
      res.status(404).json({ error: `Project not found: ${id}` });
      return;
    }

    // Get PRD for story metrics
    const prdFile = await findPrdFile(project.path);
    const prd = prdFile ? await parsePrd(prdFile) : null;
    const { storyCount, doneCount } = computeStoryCounts(prd);

    // Get activity log for run metrics
    const activityPath = join(project.path, '.ralph', 'activity.log');
    const events = await parseActivityLog(activityPath);

    // Count iterations
    const iterationStarts = events.filter(e => e.type === 'iteration_start').length;
    const iterationEnds = events.filter(e => e.type === 'iteration_end').length;

    const metrics = {
      storyCount,
      doneCount,
      openCount: storyCount - doneCount - (prd?.stories.filter(s => s.status === 'in_progress').length || 0),
      inProgressCount: prd?.stories.filter(s => s.status === 'in_progress').length || 0,
      totalIterations: iterationEnds,
      runningIterations: iterationStarts - iterationEnds,
    };

    res.json(metrics);
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

export default router;
