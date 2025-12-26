import { useEffect, useState } from 'react';
import { Save, RotateCcw, History, AlertCircle, CheckCircle } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api, ConfigBackup } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface PlexConfig {
  url: string;
  token: string;
  timeout: number;
}

interface TmdbConfig {
  apikey: string;
  language: string;
}

interface SettingsConfig {
  cache: boolean;
  cache_expiration: number;
  sync_mode: string;
}

export function Config() {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [backups, setBackups] = useState<ConfigBackup[]>([]);
  const [showBackups, setShowBackups] = useState(false);
  const { toast } = useToast();

  const hasChanges = content !== originalContent;

  useEffect(() => {
    fetchConfig();
    fetchBackups();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await api.getConfig();
      setContent(data.content);
      setOriginalContent(data.content);
      setParsed(data.parsed as Record<string, unknown>);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load config',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const data = await api.getBackups();
      setBackups(data.backups);
    } catch {
      // Ignore backup fetch errors
    }
  };

  const validateConfig = async () => {
    setValidating(true);
    try {
      const result = await api.validateConfig(content);
      setValidation(result);
    } catch (error) {
      setValidation({
        valid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed'],
      });
    } finally {
      setValidating(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const result = await api.saveConfig(content);
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Configuration saved successfully',
        });
        setOriginalContent(content);
        fetchBackups();
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save config',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const restoreBackup = async (filename: string) => {
    try {
      const result = await api.restoreBackup(filename);
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Backup restored successfully',
        });
        fetchConfig();
        setShowBackups(false);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to restore backup',
        variant: 'destructive',
      });
    }
  };

  const discardChanges = () => {
    setContent(originalContent);
    setValidation(null);
  };

  // Extract config sections for guided editor
  const plex = (parsed?.plex || {}) as PlexConfig;
  const tmdb = (parsed?.tmdb || {}) as TmdbConfig;
  const settings = (parsed?.settings || {}) as SettingsConfig;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuration</h1>
          <p className="text-muted-foreground">Edit your Kometa configuration</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="warning">Unsaved changes</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBackups(!showBackups)}
          >
            <History className="h-4 w-4 mr-2" />
            Backups ({backups.length})
          </Button>
        </div>
      </div>

      {showBackups && backups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Available Backups</CardTitle>
            <CardDescription>Restore a previous configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {backups.map((backup) => (
                  <div
                    key={backup.filename}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div>
                      <p className="text-sm font-medium">{backup.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(backup.timestamp).toLocaleString()} - {(backup.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restoreBackup(backup.filename)}
                    >
                      Restore
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="yaml" className="space-y-4">
        <TabsList>
          <TabsTrigger value="yaml">Raw YAML</TabsTrigger>
          <TabsTrigger value="guided">Guided Editor</TabsTrigger>
        </TabsList>

        <TabsContent value="yaml" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <CodeMirror
                value={content}
                height="500px"
                extensions={[yaml()]}
                onChange={(value) => {
                  setContent(value);
                  setValidation(null);
                }}
                theme="dark"
                className="border rounded-md overflow-hidden"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guided" className="space-y-4">
          {/* Plex Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Plex Connection</CardTitle>
              <CardDescription>Configure your Plex server connection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plex-url">Server URL</Label>
                  <Input
                    id="plex-url"
                    value={plex.url || ''}
                    placeholder="http://192.168.1.x:32400"
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plex-token">Token</Label>
                  <Input
                    id="plex-token"
                    type="password"
                    value={plex.token ? '••••••••••••••••' : ''}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plex-timeout">Timeout (seconds)</Label>
                  <Input
                    id="plex-timeout"
                    type="number"
                    value={plex.timeout || 60}
                    disabled
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                For full editing capability, use the Raw YAML tab
              </p>
            </CardContent>
          </Card>

          {/* TMDb Settings */}
          <Card>
            <CardHeader>
              <CardTitle>TMDb</CardTitle>
              <CardDescription>The Movie Database API settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tmdb-key">API Key</Label>
                  <Input
                    id="tmdb-key"
                    type="password"
                    value={tmdb.apikey ? '••••••••••••••••' : ''}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tmdb-lang">Language</Label>
                  <Input
                    id="tmdb-lang"
                    value={tmdb.language || 'en'}
                    disabled
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>General Kometa settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cache Enabled</Label>
                  <p className="text-sm text-muted-foreground">
                    Cache API responses to reduce load
                  </p>
                </div>
                <Switch checked={settings.cache ?? true} disabled />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cache Expiration (minutes)</Label>
                  <Input
                    type="number"
                    value={settings.cache_expiration || 60}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sync Mode</Label>
                  <Input value={settings.sync_mode || 'append'} disabled />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Validation Results */}
      {validation && (
        <Card className={validation.valid ? 'border-green-500' : 'border-destructive'}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-2">
              {validation.valid ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <p className="text-green-500">Configuration is valid</p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-destructive font-medium">Validation errors:</p>
                    <ul className="list-disc list-inside text-sm text-destructive">
                      {validation.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={validateConfig}
          disabled={validating}
        >
          {validating ? 'Validating...' : 'Validate'}
        </Button>
        <Button
          variant="outline"
          onClick={discardChanges}
          disabled={!hasChanges}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Discard Changes
        </Button>
        <Button
          onClick={saveConfig}
          disabled={saving || !hasChanges}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}
