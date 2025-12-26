import Docker from 'dockerode';
import * as fs from 'fs';
import * as path from 'path';

const CONTAINER_NAME = process.env.KOMETA_CONTAINER_NAME || 'kometa';
const CONFIG_PATH = process.env.KOMETA_CONFIG_PATH || '/kometa-config';
const LOG_FILE = path.join(CONFIG_PATH, 'logs', 'meta.log');

export interface KometaStatus {
  containerState: 'running' | 'exited' | 'paused' | 'restarting' | 'unknown';
  isJobActive: boolean;
  jobStatus: 'idle' | 'running' | 'unknown';
  lastLogTime: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  scheduledTime: string;
  error: string | null;
}

// Check if a job is actively running by examining recent log activity
function checkJobActivity(): { isActive: boolean; lastLogTime: string | null } {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return { isActive: false, lastLogTime: null };
    }

    const stats = fs.statSync(LOG_FILE);
    const lastModified = stats.mtime;
    const now = new Date();
    const diffSeconds = (now.getTime() - lastModified.getTime()) / 1000;

    // If log file was modified in the last 60 seconds, job is likely active
    if (diffSeconds < 60) {
      // Double-check by reading last few lines for recent timestamps
      const fileContent = fs.readFileSync(LOG_FILE, 'utf-8');
      const lines = fileContent.split('\n').filter(l => l.trim()).slice(-10);

      for (const line of lines.reverse()) {
        // Parse timestamp from log line: [2025-12-26 10:38:00,821]
        const match = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
        if (match) {
          const logTime = new Date(match[1].replace(' ', 'T'));
          const logDiffSeconds = (now.getTime() - logTime.getTime()) / 1000;

          // If we have a log entry within last 60 seconds, job is running
          if (logDiffSeconds < 60) {
            return { isActive: true, lastLogTime: match[1] };
          }
          return { isActive: false, lastLogTime: match[1] };
        }
      }
    }

    // Check for the last timestamp in the log
    const fileContent = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = fileContent.split('\n').filter(l => l.trim()).slice(-20);
    for (const line of lines.reverse()) {
      const match = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
      if (match) {
        return { isActive: false, lastLogTime: match[1] };
      }
    }

    return { isActive: false, lastLogTime: null };
  } catch (error) {
    console.error('Error checking job activity:', error);
    return { isActive: false, lastLogTime: null };
  }
}

export class DockerService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  async getStatus(): Promise<KometaStatus> {
    try {
      const container = this.docker.getContainer(CONTAINER_NAME);
      const info = await container.inspect();

      const state = info.State;
      let containerState: KometaStatus['containerState'] = 'unknown';

      if (state.Running) containerState = 'running';
      else if (state.Paused) containerState = 'paused';
      else if (state.Restarting) containerState = 'restarting';
      else containerState = 'exited';

      // Get scheduled time from environment variables
      const envVars = info.Config.Env || [];
      const timeEnv = envVars.find(e => e.startsWith('KOMETA_TIME='));
      const scheduledTime = timeEnv ? timeEnv.split('=')[1] : '03:00';

      // Check actual job activity from logs
      const jobActivity = checkJobActivity();

      return {
        containerState,
        isJobActive: jobActivity.isActive,
        jobStatus: jobActivity.isActive ? 'running' : 'idle',
        lastLogTime: jobActivity.lastLogTime,
        startedAt: state.StartedAt || null,
        finishedAt: state.FinishedAt || null,
        exitCode: state.ExitCode ?? null,
        scheduledTime,
        error: null,
      };
    } catch (error) {
      return {
        containerState: 'unknown',
        isJobActive: false,
        jobStatus: 'unknown',
        lastLogTime: null,
        startedAt: null,
        finishedAt: null,
        exitCode: null,
        scheduledTime: '03:00',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async triggerRun(): Promise<{ success: boolean; message: string }> {
    try {
      const container = this.docker.getContainer(CONTAINER_NAME);
      const info = await container.inspect();

      if (!info.State.Running) {
        // Container not running, start it
        await container.start();
        return { success: true, message: 'Container started' };
      }

      // Container is running, execute kometa --run
      const exec = await container.exec({
        Cmd: ['python', '/app/kometa/kometa.py', '--run'],
        AttachStdout: true,
        AttachStderr: true,
      });

      await exec.start({ Detach: true });
      return { success: true, message: 'Kometa run triggered' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to trigger run',
      };
    }
  }

  async stopContainer(): Promise<{ success: boolean; message: string }> {
    try {
      const container = this.docker.getContainer(CONTAINER_NAME);
      await container.stop({ t: 10 });
      return { success: true, message: 'Container stopped' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to stop container',
      };
    }
  }

  async restartContainer(): Promise<{ success: boolean; message: string }> {
    try {
      const container = this.docker.getContainer(CONTAINER_NAME);
      await container.restart({ t: 10 });
      return { success: true, message: 'Container restarted' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to restart container',
      };
    }
  }
}
