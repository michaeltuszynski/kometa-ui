import { Server, Socket } from 'socket.io';
import chokidar from 'chokidar';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import readline from 'readline';
import path from 'path';

export function setupLogStreaming(io: Server, kometaConfigPath: string): void {
  const logPath = path.join(kometaConfigPath, 'logs', 'meta.log');
  let filePosition = 0;
  const subscribedSockets = new Set<string>();

  // Watch the log file for changes
  let watcher: chokidar.FSWatcher | null = null;

  try {
    watcher = chokidar.watch(logPath, {
      persistent: true,
      usePolling: true, // Better for network/docker mounted files
      interval: 1000,
      ignoreInitial: true,
    });

    watcher.on('error', (error) => {
      console.error('Log watcher error:', error.message);
    });
  } catch (error) {
    console.error('Failed to initialize log watcher:', error);
  }

  if (!watcher) {
    console.warn('Log file watcher not available - real-time streaming disabled');
    return;
  }

  watcher.on('change', async () => {
    if (subscribedSockets.size === 0) return;

    try {
      const stats = await fs.stat(logPath);

      // Handle log rotation (file size decreased)
      if (stats.size < filePosition) {
        filePosition = 0;
        io.to('logs').emit('logs:rotated', { message: 'Log file rotated' });
      }

      if (stats.size > filePosition) {
        // Read new lines
        const newLines = await readNewLines(logPath, filePosition);
        filePosition = stats.size;

        if (newLines.length > 0) {
          io.to('logs').emit('logs:new', { lines: newLines });
        }
      }
    } catch (error) {
      console.error('Error reading log file:', error);
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    socket.on('subscribe:logs', async () => {
      socket.join('logs');
      subscribedSockets.add(socket.id);

      // Send initial log content
      try {
        const lines = await readLastLines(logPath, 200);
        const stats = await fs.stat(logPath);
        filePosition = stats.size;
        socket.emit('logs:initial', { lines });
      } catch (error) {
        socket.emit('logs:error', { message: 'Failed to read log file' });
      }
    });

    socket.on('unsubscribe:logs', () => {
      socket.leave('logs');
      subscribedSockets.delete(socket.id);
    });

    socket.on('disconnect', () => {
      subscribedSockets.delete(socket.id);
      console.log('Client disconnected:', socket.id);
    });
  });
}

async function readLastLines(filePath: string, count: number): Promise<string[]> {
  const lines: string[] = [];

  try {
    const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      lines.push(line);
    }

    return lines.slice(-count);
  } catch {
    return [];
  }
}

async function readNewLines(filePath: string, fromPosition: number): Promise<string[]> {
  const lines: string[] = [];

  try {
    const fileStream = createReadStream(filePath, {
      encoding: 'utf-8',
      start: fromPosition,
    });

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim()) {
        lines.push(line);
      }
    }

    return lines;
  } catch {
    return [];
  }
}
