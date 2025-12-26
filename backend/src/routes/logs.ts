import { Router, Request, Response } from 'express';
import { LogService } from '../services/log-watcher.js';

export const logsRouter = Router();

logsRouter.get('/', async (req: Request, res: Response) => {
  const configPath = req.app.locals.kometaConfigPath;
  const logService = new LogService(configPath);
  const count = parseInt(req.query.lines as string) || 500;
  const filename = (req.query.file as string) || 'meta.log';

  try {
    const lines = await logService.readLines(filename, count);
    res.json({ lines, count: lines.length });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to read logs',
    });
  }
});

logsRouter.get('/files', async (req: Request, res: Response) => {
  const configPath = req.app.locals.kometaConfigPath;
  const logService = new LogService(configPath);

  try {
    const files = await logService.listLogFiles();
    res.json({ files });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list log files',
    });
  }
});

logsRouter.get('/last-run', async (req: Request, res: Response) => {
  const configPath = req.app.locals.kometaConfigPath;
  const logService = new LogService(configPath);

  try {
    const lastRun = await logService.getLastRun();
    res.json({ lastRun });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get last run info',
    });
  }
});
