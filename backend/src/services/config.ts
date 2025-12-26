import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

export interface Backup {
  filename: string;
  timestamp: Date;
  size: number;
}

export class ConfigService {
  private configPath: string;
  private backupDir: string;
  private maxBackups = 10;

  constructor(kometaConfigPath: string) {
    this.configPath = path.join(kometaConfigPath, 'config.yml');
    this.backupDir = path.join(kometaConfigPath, 'backups');
  }

  async read(): Promise<{ content: string; parsed: unknown }> {
    const content = await fs.readFile(this.configPath, 'utf-8');
    const parsed = yaml.load(content);
    return { content, parsed };
  }

  async save(content: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate YAML syntax
      yaml.load(content);

      // Create backup
      await this.createBackup();

      // Write atomically (write to temp, then rename)
      const tempPath = this.configPath + '.tmp';
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, this.configPath);

      return { success: true, message: 'Configuration saved successfully' };
    } catch (error) {
      if (error instanceof yaml.YAMLException) {
        return { success: false, message: `YAML syntax error: ${error.message}` };
      }
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save configuration',
      };
    }
  }

  async validate(content: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const parsed = yaml.load(content) as Record<string, unknown>;

      // Basic structure validation
      if (!parsed || typeof parsed !== 'object') {
        errors.push('Configuration must be a valid YAML object');
        return { valid: false, errors };
      }

      // Check required sections
      if (!parsed.plex) {
        errors.push('Missing required section: plex');
      } else {
        const plex = parsed.plex as Record<string, unknown>;
        if (!plex.url) errors.push('Missing plex.url');
        if (!plex.token) errors.push('Missing plex.token');
      }

      if (!parsed.libraries) {
        errors.push('Missing required section: libraries');
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      if (error instanceof yaml.YAMLException) {
        errors.push(`YAML syntax error: ${error.message}`);
      } else {
        errors.push(error instanceof Error ? error.message : 'Unknown validation error');
      }
      return { valid: false, errors };
    }
  }

  async createBackup(): Promise<string> {
    await fs.mkdir(this.backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `config.yml.backup.${timestamp}`;
    const backupPath = path.join(this.backupDir, backupName);

    await fs.copyFile(this.configPath, backupPath);

    // Clean up old backups
    await this.cleanOldBackups();

    return backupName;
  }

  async listBackups(): Promise<Backup[]> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      const files = await fs.readdir(this.backupDir);
      const backups: Backup[] = [];

      for (const file of files) {
        if (file.startsWith('config.yml.backup.')) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          backups.push({
            filename: file,
            timestamp: stats.mtime,
            size: stats.size,
          });
        }
      }

      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch {
      return [];
    }
  }

  async restore(backupFilename: string): Promise<{ success: boolean; message: string }> {
    try {
      const backupPath = path.join(this.backupDir, backupFilename);

      // Verify backup exists
      await fs.access(backupPath);

      // Create backup of current config before restoring
      await this.createBackup();

      // Restore
      await fs.copyFile(backupPath, this.configPath);

      return { success: true, message: 'Configuration restored successfully' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to restore backup',
      };
    }
  }

  private async cleanOldBackups(): Promise<void> {
    const backups = await this.listBackups();

    if (backups.length > this.maxBackups) {
      const toDelete = backups.slice(this.maxBackups);
      for (const backup of toDelete) {
        await fs.unlink(path.join(this.backupDir, backup.filename));
      }
    }
  }
}
