/**
 * Ralph Dashboard Server
 * Express server with WebSocket support for real-time updates
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import projectsRouter from './routes/projects.js';
import runsRouter from './routes/runs.js';
import logsRouter from './routes/logs.js';

const app = express();
const server = createServer(app);

// Default port
const DEFAULT_PORT = 4242;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;

// CORS configuration for local development
const corsOptions: cors.CorsOptions = {
  origin: [
    'http://localhost:5173', // Vite dev server
    'http://localhost:4173', // Vite preview
    `http://localhost:${PORT}`, // Same origin
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/projects', projectsRouter);

// Nested routes for project-specific resources
// These are mounted under /api/projects/:id in the projects router,
// but for clarity, we also support the flat URL structure
app.use('/api/projects/:projectId/runs', (req, _res, next) => {
  // Pass projectId to downstream handlers
  req.params = { ...req.params };
  next();
}, runsRouter);

app.use('/api/projects/:projectId/logs', (req, _res, next) => {
  // Pass projectId to downstream handlers
  req.params = { ...req.params };
  next();
}, logsRouter);

/**
 * Start the dashboard server
 * @param port - Port to listen on (default: 4242)
 */
export function startServer(port: number = PORT): void {
  server.listen(port, () => {
    console.log(`Ralph Dashboard server running on http://localhost:${port}`);
  });
}

export { app, server };

// Start server if run directly
// This enables: node dashboard/server/index.js
const isMainModule = process.argv[1]?.endsWith('index.js') ||
                     process.argv[1]?.endsWith('index.ts');
if (isMainModule) {
  startServer();
}
