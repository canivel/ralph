/**
 * Ralph Dashboard Server
 * Express server with WebSocket support for real-time updates
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Default port
const PORT = process.env.PORT || 4242;

export function startServer(port: number = PORT as number): void {
  server.listen(port, () => {
    console.log(`Ralph Dashboard server running on http://localhost:${port}`);
  });
}

export { app, server };
