import { Router, Request, Response } from 'express';
import { ConfigService } from '../services/config.js';

export const configRouter = Router();

configRouter.get('/', async (req: Request, res: Response) => {
  const configPath = req.app.locals.kometaConfigPath;
  const configService = new ConfigService(configPath);

  try {
    const { content, parsed } = await configService.read();
    res.json({ content, parsed });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to read config',
    });
  }
});

configRouter.put('/', async (req: Request, res: Response) => {
  const configPath = req.app.locals.kometaConfigPath;
  const configService = new ConfigService(configPath);
  const { content } = req.body;

  if (!content || typeof content !== 'string') {
    res.status(400).json({ error: 'Content is required' });
    return;
  }

  const result = await configService.save(content);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

configRouter.post('/validate', async (req: Request, res: Response) => {
  const configPath = req.app.locals.kometaConfigPath;
  const configService = new ConfigService(configPath);
  const { content } = req.body;

  if (!content || typeof content !== 'string') {
    res.status(400).json({ error: 'Content is required' });
    return;
  }

  const result = await configService.validate(content);
  res.json(result);
});

configRouter.get('/backups', async (req: Request, res: Response) => {
  const configPath = req.app.locals.kometaConfigPath;
  const configService = new ConfigService(configPath);

  try {
    const backups = await configService.listBackups();
    res.json({ backups });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list backups',
    });
  }
});

configRouter.post('/restore/:filename', async (req: Request, res: Response) => {
  const configPath = req.app.locals.kometaConfigPath;
  const configService = new ConfigService(configPath);
  const { filename } = req.params;

  const result = await configService.restore(filename);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});
