import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Square, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, KometaStatus, LastRun } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function Dashboard() {
  const [status, setStatus] = useState<KometaStatus | null>(null);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const [statusData, lastRunData] = await Promise.all([
        api.getStatus(),
        api.getLastRun(),
      ]);
      setStatus(statusData);
      setLastRun(lastRunData.lastRun);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: 'run' | 'stop' | 'restart') => {
    setActionLoading(action);
    try {
      let result;
      switch (action) {
        case 'run':
          result = await api.triggerRun();
          break;
        case 'stop':
          result = await api.stopContainer();
          break;
        case 'restart':
          result = await api.restartContainer();
          break;
      }
      toast({
        title: result.success ? 'Success' : 'Error',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${action}`,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = () => {
    if (!status) return null;

    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; label: string }> = {
      running: { variant: 'success', label: 'Running' },
      exited: { variant: 'secondary', label: 'Stopped' },
      paused: { variant: 'warning', label: 'Paused' },
      restarting: { variant: 'warning', label: 'Restarting' },
      unknown: { variant: 'destructive', label: 'Unknown' },
    };

    const config = variants[status.containerState] || variants.unknown;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getNextRunTime = () => {
    if (!status?.scheduledTime) return null;

    const [hours, minutes] = status.scheduledTime.split(':').map(Number);
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const diff = nextRun.getTime() - now.getTime();
    const hoursUntil = Math.floor(diff / (1000 * 60 * 60));
    const minutesUntil = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hoursUntil}h ${minutesUntil}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Container Status</CardTitle>
            {getStatusBadge()}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {status?.containerState || 'Unknown'}
            </div>
            {status?.error && (
              <p className="text-xs text-destructive mt-1">{status.error}</p>
            )}
          </CardContent>
        </Card>

        {/* Next Run Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Scheduled Run</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.scheduledTime || '--:--'}</div>
            <p className="text-xs text-muted-foreground">
              {getNextRunTime() ? `in ${getNextRunTime()}` : 'No schedule'}
            </p>
          </CardContent>
        </Card>

        {/* Last Run Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Run</CardTitle>
            {lastRun?.status === 'completed' ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : lastRun?.status === 'running' ? (
              <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
            ) : lastRun?.status === 'failed' ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastRun?.duration || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {lastRun?.startTime
                ? new Date(lastRun.startTime.replace(',', '.')).toLocaleString()
                : 'No runs recorded'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Control the Kometa container and trigger manual runs
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button
            onClick={() => handleAction('run')}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'run' ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Now
          </Button>
          <Button
            variant="outline"
            onClick={() => handleAction('restart')}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'restart' ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Restart Container
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleAction('stop')}
            disabled={actionLoading !== null || status?.containerState === 'exited'}
          >
            {actionLoading === 'stop' ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Square className="h-4 w-4 mr-2" />
            )}
            Stop Container
          </Button>
          <Button variant="outline" asChild>
            <Link to="/logs">View Logs</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
