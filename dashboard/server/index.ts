/**
 * Ralph Dashboard Server
 * Express server with WebSocket support for real-time updates
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import projectsRouter from './routes/projects.js';
import runsRouter from './routes/runs.js';
import logsRouter from './routes/logs.js';
import { getWebSocketHub } from './services/websocketHub.js';

const app = express();
const server = createServer(app);

// Initialize WebSocket hub and attach to HTTP server
const wsHub = getWebSocketHub();
wsHub.attach(server);

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

// Serve static files from the client build directory
// Use process.cwd() based path for production, or relative to this file for development
const getClientDistPath = (): string => {
  // When running from bin/ralph, the server is at dashboard/server/dist/index.js
  // Client dist is at dashboard/client/dist relative to repo root
  const repoRoot = process.env.RALPH_REPO_ROOT || path.resolve(__dirname, '..', '..');
  return path.join(repoRoot, 'dashboard', 'client', 'dist');
};
const clientDistPath = getClientDistPath();
app.use(express.static(clientDistPath));

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

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

/**
 * Start the dashboard server
 * @param port - Port to listen on (default: 4242)
 */
export function startServer(port: number = PORT): void {
  server.listen(port, () => {
    console.log(`Ralph Dashboard server running on http://localhost:${port}`);
  });
}

export { app, server, wsHub };

/**
 * Gracefully shutdown the server and WebSocket connections
 */
export function shutdown(): void {
  wsHub.close();
  server.close();
}

// Start server if run directly
// This enables: node dashboard/server/index.js
const isMainModule = process.argv[1]?.endsWith('index.js') ||
                     process.argv[1]?.endsWith('index.ts');
if (isMainModule) {
  startServer();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...');
    shutdown();
    process.exit(0);
  });
}
