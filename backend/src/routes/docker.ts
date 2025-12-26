import { Router, Request, Response } from 'express';
import { DockerService } from '../services/docker.js';

export const dockerRouter = Router();
const dockerService = new DockerService();

dockerRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await dockerService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
});

dockerRouter.post('/run', async (_req: Request, res: Response) => {
  try {
    const result = await dockerService.triggerRun();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to trigger run',
    });
  }
});

dockerRouter.post('/stop', async (_req: Request, res: Response) => {
  try {
    const result = await dockerService.stopContainer();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to stop container',
    });
  }
});

dockerRouter.post('/restart', async (_req: Request, res: Response) => {
  try {
    const result = await dockerService.restartContainer();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to restart container',
    });
  }
});
