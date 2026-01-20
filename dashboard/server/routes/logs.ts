/**
 * Logs API routes
 * Handles activity log and errors log retrieval
 */

import { Router, Request, Response } from 'express';
import { join } from 'path';
import { readFile, stat } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { getProject } from '../services/projectManager.js';
import { parseActivityLog, parseErrorsLog } from '../services/dataParser.js';
import type { ActivityEvent, ErrorEntry } from '../types.js';

const router = Router({ mergeParams: true });

/** Default pagination settings */
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
/** Maximum characters to return for raw log content before truncation */
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
 * Read raw log file content with truncation for large files
 */
async function readLogWithTruncation(
  logPath: string
): Promise<{ content: string; truncated: boolean; truncatedMessage?: string }> {
  if (!existsSync(logPath)) {
    return { content: '', truncated: false };
  }

  try {
    const stats = await stat(logPath);
    const isTruncated = stats.size > MAX_LOG_SIZE;

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

    return {
      content,
      truncated: isTruncated,
      truncatedMessage: isTruncated
        ? `Log file exceeded ${MAX_LOG_SIZE} characters. Showing last ${MAX_LOG_SIZE} characters.`
        : undefined,
    };
  } catch {
    return { content: '', truncated: false };
  }
}

/**
 * GET /api/projects/:id/logs/activity
 * Get activity log for a project
 * Query params: ?limit=N&offset=N&raw=true (raw returns unparsed content)
 */
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    const raw = req.query.raw === 'true';

    const project = await getProject(projectId);
    if (!project) {
      res.status(404).json({ error: `Project not found: ${projectId}` });
      return;
    }

    const logPath = join(project.path, '.ralph', 'activity.log');

    if (raw) {
      // Return raw content with truncation handling
      const { content, truncated, truncatedMessage } = await readLogWithTruncation(logPath);
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
        truncated,
        truncatedMessage,
      });
      return;
    }

    // Parse and return structured activity events
    const events: ActivityEvent[] = await parseActivityLog(logPath);

    // Sort by timestamp descending (newest first)
    events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Apply pagination
    const { limit, offset } = parsePagination(req.query);
    const total = events.length;
    const paginated = events.slice(offset, offset + limit);

    res.json({
      events: paginated,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error getting activity log:', error);
    res.status(500).json({ error: 'Failed to get activity log' });
  }
});

/**
 * GET /api/projects/:id/logs/errors
 * Get errors log for a project
 * Query params: ?limit=N&offset=N&raw=true (raw returns unparsed content)
 */
router.get('/errors', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    const raw = req.query.raw === 'true';

    const project = await getProject(projectId);
    if (!project) {
      res.status(404).json({ error: `Project not found: ${projectId}` });
      return;
    }

    const logPath = join(project.path, '.ralph', 'errors.log');

    if (raw) {
      // Return raw content with truncation handling
      const { content, truncated, truncatedMessage } = await readLogWithTruncation(logPath);
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
        truncated,
        truncatedMessage,
      });
      return;
    }

    // Parse and return structured error entries
    const errors: ErrorEntry[] = await parseErrorsLog(logPath);

    // Sort by timestamp descending (newest first)
    errors.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Apply pagination
    const { limit, offset } = parsePagination(req.query);
    const total = errors.length;
    const paginated = errors.slice(offset, offset + limit);

    res.json({
      errors: paginated,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error getting errors log:', error);
    res.status(500).json({ error: 'Failed to get errors log' });
  }
});

export default router;
