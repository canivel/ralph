/**
 * Projects API routes
 * Handles project registration, listing, and retrieval
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/projects
 * List all registered projects
 */
router.get('/', (_req: Request, res: Response) => {
  // TODO: Implement with projectManager service (US-007)
  res.json([]);
});

/**
 * POST /api/projects
 * Register a new project
 * Body: { path: string, name?: string }
 */
router.post('/', (_req: Request, res: Response) => {
  // TODO: Implement with projectManager service (US-007)
  res.status(501).json({ error: 'Not implemented' });
});

/**
 * GET /api/projects/:id
 * Get project details with parsed PRD data
 */
router.get('/:id', (_req: Request, res: Response) => {
  // TODO: Implement with projectManager service (US-007)
  res.status(501).json({ error: 'Not implemented' });
});

/**
 * DELETE /api/projects/:id
 * Unregister a project
 */
router.delete('/:id', (_req: Request, res: Response) => {
  // TODO: Implement with projectManager service (US-007)
  res.status(501).json({ error: 'Not implemented' });
});

/**
 * GET /api/projects/:id/prd
 * Get parsed PRD data for a project
 */
router.get('/:id/prd', (_req: Request, res: Response) => {
  // TODO: Implement with dataParser service (US-003, US-007)
  res.status(501).json({ error: 'Not implemented' });
});

/**
 * GET /api/projects/:id/stories
 * Get stories with status for a project
 */
router.get('/:id/stories', (_req: Request, res: Response) => {
  // TODO: Implement with dataParser service (US-003, US-007)
  res.status(501).json({ error: 'Not implemented' });
});

/**
 * GET /api/projects/:id/progress
 * Get progress.md content for a project
 */
router.get('/:id/progress', (_req: Request, res: Response) => {
  // TODO: Implement with dataParser service (US-003, US-007)
  res.status(501).json({ error: 'Not implemented' });
});

/**
 * GET /api/projects/:id/guardrails
 * Get guardrails.md content for a project
 */
router.get('/:id/guardrails', (_req: Request, res: Response) => {
  // TODO: Implement with dataParser service (US-003, US-007)
  res.status(501).json({ error: 'Not implemented' });
});

/**
 * GET /api/projects/:id/metrics
 * Get computed metrics for a project
 */
router.get('/:id/metrics', (_req: Request, res: Response) => {
  // TODO: Implement with dataParser service (US-003, US-007)
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
