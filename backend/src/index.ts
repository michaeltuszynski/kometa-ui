import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

import { configRouter } from './routes/config.js';
import { dockerRouter } from './routes/docker.js';
import { logsRouter } from './routes/logs.js';
import { setupLogStreaming } from './websocket/log-stream.js';
import { DockerService } from './services/docker.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;
const KOMETA_CONFIG_PATH = process.env.KOMETA_CONFIG_PATH || '/kometa-config';

// Middleware
app.use(cors());
app.use(express.json());

// Make config path available to routes
app.locals.kometaConfigPath = KOMETA_CONFIG_PATH;

// API Routes
app.use('/api/config', configRouter);
app.use('/api', dockerRouter);
app.use('/api/logs', logsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(import.meta.dirname, '../public')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../public/index.html'));
  });
}

// WebSocket setup
setupLogStreaming(io, KOMETA_CONFIG_PATH);

// Broadcast status updates periodically
const dockerService = new DockerService();
setInterval(async () => {
  try {
    const status = await dockerService.getStatus();
    io.emit('status:update', status);
  } catch (error) {
    console.error('Failed to get Docker status:', error);
  }
}, 5000);

httpServer.listen(PORT, () => {
  console.log(`Kometa UI server running on port ${PORT}`);
  console.log(`Config path: ${KOMETA_CONFIG_PATH}`);
});
