const API_BASE = '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  return response.json();
}

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

export interface LastRun {
  startTime: string;
  endTime: string | null;
  duration: string | null;
  status: 'running' | 'completed' | 'failed';
}

export interface LogFile {
  name: string;
  size: number;
  modified: string;
}

export interface ConfigBackup {
  filename: string;
  timestamp: string;
  size: number;
}

export const api = {
  // Status
  getStatus: () => fetchApi<KometaStatus>('/status'),
  triggerRun: () => fetchApi<{ success: boolean; message: string }>('/run', { method: 'POST' }),
  stopContainer: () => fetchApi<{ success: boolean; message: string }>('/stop', { method: 'POST' }),
  restartContainer: () => fetchApi<{ success: boolean; message: string }>('/restart', { method: 'POST' }),

  // Logs
  getLogs: (lines = 500, file = 'meta.log') =>
    fetchApi<{ lines: string[]; count: number }>(`/logs?lines=${lines}&file=${file}`),
  getLogFiles: () => fetchApi<{ files: LogFile[] }>('/logs/files'),
  getLastRun: () => fetchApi<{ lastRun: LastRun | null }>('/logs/last-run'),

  // Config
  getConfig: () => fetchApi<{ content: string; parsed: unknown }>('/config'),
  saveConfig: (content: string) =>
    fetchApi<{ success: boolean; message: string }>('/config', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  validateConfig: (content: string) =>
    fetchApi<{ valid: boolean; errors: string[] }>('/config/validate', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  getBackups: () => fetchApi<{ backups: ConfigBackup[] }>('/config/backups'),
  restoreBackup: (filename: string) =>
    fetchApi<{ success: boolean; message: string }>(`/config/restore/${filename}`, {
      method: 'POST',
    }),
};
