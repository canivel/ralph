/**
 * Runs API routes
 * Handles run history retrieval and run details
 */

import { Router, Request, Response } from 'express';
import { join } from 'path';
import { readdir, readFile, stat } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { getProject } from '../services/projectManager.js';
import { parseRunMeta } from '../services/dataParser.js';
import type { RunMeta } from '../types.js';

const router = Router({ mergeParams: true });

/** Default pagination settings */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
/** Maximum characters to return for log content before truncation */
const MAX_LOG_SIZE = 500000;

/**
 * Parse pagination query params
 */
function parsePagination(query: Request['query']): { limit: number; offset: number } {
  let limit = DEFAULT_LIMIT;
  let offset = 0;

  if (query.limit) {
    const parsed = parseInt(query.limit as string, 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  if (query.offset) {
    const parsed = parseInt(query.offset as string, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      offset = parsed;
    }
  }

  return { limit, offset };
}

/**
 * List all run summary files in .ralph/runs/ directory
 */
async function listRunFiles(runsDir: string): Promise<string[]> {
  if (!existsSync(runsDir)) {
    return [];
  }

  try {
    const files = await readdir(runsDir);
    // Only include .md files (run summaries), not .log files
    return files.filter(f => f.endsWith('.md') && f.startsWith('run-'));
  } catch {
    return [];
  }
}

/**
 * GET /api/projects/:id/runs
 * Get run history for a project
 * Query params: ?limit=N&offset=N
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId || req.params.id;

    const project = await getProject(projectId);
    if (!project) {
      res.status(404).json({ error: `Project not found: ${projectId}` });
      return;
    }

    const runsDir = join(project.path, '.ralph', 'runs');
    const runFiles = await listRunFiles(runsDir);

    // Parse all run metadata files
    const runs: RunMeta[] = [];
    for (const file of runFiles) {
      const filePath = join(runsDir, file);
      const meta = await parseRunMeta(filePath);
      if (meta) {
        runs.push(meta);
      }
    }

    // Sort by runId descending (newest first)
    runs.sort((a, b) => b.runId.localeCompare(a.runId));

    // Apply pagination
    const { limit, offset } = parsePagination(req.query);
    const total = runs.length;
    const paginated = runs.slice(offset, offset + limit);

    res.json({
      runs: paginated,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error listing runs:', error);
    res.status(500).json({ error: 'Failed to list runs' });
  }
});

/**
 * GET /api/projects/:id/runs/:runId
 * Get specific run metadata
 */
router.get('/:runId', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    const { runId } = req.params;

    const project = await getProject(projectId);
    if (!project) {
      res.status(404).json({ error: `Project not found: ${projectId}` });
      return;
    }

    const runsDir = join(project.path, '.ralph', 'runs');
    const runFiles = await listRunFiles(runsDir);

    // Find the run file that matches the runId
    // Files are named like: run-20260119-201458-41469-iter-1.md
    const matchingFile = runFiles.find(f => f.includes(runId));

    if (!matchingFile) {
      res.status(404).json({ error: `Run not found: ${runId}` });
      return;
    }

    const filePath = join(runsDir, matchingFile);
    const meta = await parseRunMeta(filePath);

    if (!meta) {
      res.status(404).json({ error: `Failed to parse run metadata: ${runId}` });
      return;
    }

    res.json(meta);
  } catch (error) {
    console.error('Error getting run:', error);
    res.status(500).json({ error: 'Failed to get run' });
  }
});

/**
 * GET /api/projects/:id/runs/:runId/log
 * Get run log content
 * Query params: ?limit=N&offset=N (line-based pagination)
 */
router.get('/:runId/log', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    const { runId } = req.params;

    const project = await getProject(projectId);
    if (!project) {
      res.status(404).json({ error: `Project not found: ${projectId}` });
      return;
    }

    const runsDir = join(project.path, '.ralph', 'runs');

    // Find log file(s) that match the runId
    // Log files are named like: run-20260119-201458-41469-iter-1.log
    if (!existsSync(runsDir)) {
      res.status(404).json({ error: `Runs directory not found` });
      return;
    }

    const files = await readdir(runsDir);
    const logFiles = files.filter(f => f.endsWith('.log') && f.includes(runId));

    if (logFiles.length === 0) {
      res.status(404).json({ error: `Log file not found for run: ${runId}` });
      return;
    }

    // Use the first matching log file
    const logPath = join(runsDir, logFiles[0]);

    // Check file size for truncation
    const stats = await stat(logPath);
    const isTruncated = stats.size > MAX_LOG_SIZE;

    // Read file content
    let content: string;
    if (isTruncated) {
      // Read only the last MAX_LOG_SIZE bytes for very large files
      const stream = createReadStream(logPath, {
        start: stats.size - MAX_LOG_SIZE,
        end: stats.size,
      });

      content = await new Promise<string>((resolve, reject) => {
        let data = '';
        stream.on('data', chunk => (data += chunk.toString()));
        stream.on('end', () => resolve(data));
        stream.on('error', reject);
      });

      // Remove first partial line
      const firstNewline = content.indexOf('\n');
      if (firstNewline > 0) {
        content = content.slice(firstNewline + 1);
      }
    } else {
      content = await readFile(logPath, 'utf-8');
    }

    // Split into lines for pagination
    const lines = content.split('\n');
    const { limit, offset } = parsePagination(req.query);
    const total = lines.length;
    const paginated = lines.slice(offset, offset + limit);

    res.json({
      content: paginated.join('\n'),
      lines: paginated,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      truncated: isTruncated,
      truncatedMessage: isTruncated
        ? `Log file exceeded ${MAX_LOG_SIZE} characters. Showing last ${MAX_LOG_SIZE} characters.`
        : undefined,
    });
  } catch (error) {
    console.error('Error getting run log:', error);
    res.status(500).json({ error: 'Failed to get run log' });
  }
});

export default router;
