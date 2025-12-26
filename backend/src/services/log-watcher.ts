import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import readline from 'readline';

export interface LogLine {
  timestamp: string;
  module: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  raw: string;
}

export interface ParsedLogRun {
  startTime: string;
  endTime: string | null;
  duration: string | null;
  status: 'running' | 'completed' | 'failed';
}

const LOG_PATTERN = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\] \[([^\]]+)\]\s+\[(\w+)\]\s+\|\s*(.*)$/;

export class LogService {
  private logsPath: string;

  constructor(kometaConfigPath: string) {
    this.logsPath = path.join(kometaConfigPath, 'logs');
  }

  async listLogFiles(): Promise<{ name: string; size: number; modified: Date }[]> {
    try {
      const files = await fs.readdir(this.logsPath);
      const logFiles: { name: string; size: number; modified: Date }[] = [];

      for (const file of files) {
        if (file.startsWith('meta') && file.endsWith('.log')) {
          const filePath = path.join(this.logsPath, file);
          const stats = await fs.stat(filePath);
          logFiles.push({
            name: file,
            size: stats.size,
            modified: stats.mtime,
          });
        }
      }

      // Sort by modification time, newest first
      return logFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    } catch {
      return [];
    }
  }

  async readLines(filename: string = 'meta.log', count: number = 500): Promise<string[]> {
    const filePath = path.join(this.logsPath, filename);
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

      // Return last N lines
      return lines.slice(-count);
    } catch {
      return [];
    }
  }

  parseLine(raw: string): LogLine | null {
    const match = raw.match(LOG_PATTERN);
    if (!match) {
      // Return as unparsed line
      return {
        timestamp: '',
        module: '',
        level: 'INFO',
        message: raw,
        raw,
      };
    }

    const [, timestamp, module, level, message] = match;
    return {
      timestamp,
      module,
      level: level as LogLine['level'],
      message,
      raw,
    };
  }

  async getLastRun(): Promise<ParsedLogRun | null> {
    const lines = await this.readLines('meta.log', 2000);

    let startTime: string | null = null;
    let endTime: string | null = null;

    // Find the last "Starting Run" and "Finished" markers
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];

      if (!endTime && line.includes('Finished Run')) {
        const parsed = this.parseLine(line);
        if (parsed) endTime = parsed.timestamp;
      }

      if (line.includes('Starting Run')) {
        const parsed = this.parseLine(line);
        if (parsed) {
          startTime = parsed.timestamp;
          break;
        }
      }
    }

    if (!startTime) return null;

    let duration: string | null = null;
    let status: ParsedLogRun['status'] = 'running';

    if (endTime) {
      status = 'completed';
      const start = new Date(startTime.replace(',', '.'));
      const end = new Date(endTime.replace(',', '.'));
      const diffMs = end.getTime() - start.getTime();
      const minutes = Math.floor(diffMs / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      duration = `${minutes}m ${seconds}s`;
    }

    return {
      startTime,
      endTime,
      duration,
      status,
    };
  }

  getMainLogPath(): string {
    return path.join(this.logsPath, 'meta.log');
  }
}
