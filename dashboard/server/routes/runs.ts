/**
 * Runs API routes
 * Handles run history retrieval and run details
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/projects/:id/runs
 * Get run history for a project
 * Query params: ?limit=N&offset=N
 */
router.get('/', (_req: Request, res: Response) => {
  // TODO: Implement with dataParser service (US-003, US-008)
  res.json([]);
});

/**
 * GET /api/projects/:id/runs/:runId
 * Get specific run metadata
 */
router.get('/:runId', (_req: Request, res: Response) => {
  // TODO: Implement with dataParser service (US-003, US-008)
  res.status(501).json({ error: 'Not implemented' });
});

/**
 * GET /api/projects/:id/runs/:runId/log
 * Get run log content
 * Query params: ?limit=N&offset=N
 */
router.get('/:runId/log', (_req: Request, res: Response) => {
  // TODO: Implement with dataParser service (US-003, US-008)
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
