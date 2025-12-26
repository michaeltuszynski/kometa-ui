import Docker from 'dockerode';

const CONTAINER_NAME = process.env.KOMETA_CONTAINER_NAME || 'kometa';

export interface KometaStatus {
  containerState: 'running' | 'exited' | 'paused' | 'restarting' | 'unknown';
  isJobActive: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  scheduledTime: string;
  error: string | null;
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

      return {
        containerState,
        isJobActive: state.Running,
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
