import { useEffect, useState, useRef, useMemo } from 'react';
import { Download, Pause, Play, Trash2, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLogStream } from '@/hooks/useWebSocket';
import { api, LogFile } from '@/lib/api';
import { cn } from '@/lib/utils';

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'ALL';

const LOG_PATTERN = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\] \[([^\]]+)\]\s+\[(\w+)\]\s+\|\s*(.*)$/;

function parseLogLine(line: string) {
  const match = line.match(LOG_PATTERN);
  if (!match) {
    return { raw: line, level: 'INFO' as LogLevel };
  }
  return {
    timestamp: match[1],
    module: match[2],
    level: match[3] as LogLevel,
    message: match[4],
    raw: line,
  };
}

const levelColors: Record<string, string> = {
  DEBUG: 'text-gray-400',
  INFO: 'text-blue-400',
  WARNING: 'text-yellow-400',
  ERROR: 'text-red-400',
  CRITICAL: 'text-red-600 font-bold',
};

export function Logs() {
  const { logs, isStreaming, isConnected, clearLogs } = useLogStream();
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<LogLevel>('ALL');
  const [search, setSearch] = useState('');
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    api.getLogFiles().then((data) => setLogFiles(data.files));
  }, []);

  useEffect(() => {
    if (autoScroll && !paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll, paused]);

  const filteredLogs = useMemo(() => {
    return logs.filter((line) => {
      const parsed = parseLogLine(line);

      // Filter by level
      if (filter !== 'ALL' && parsed.level !== filter) {
        return false;
      }

      // Filter by search
      if (search && !line.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [logs, filter, search]);

  const displayLogs = paused ? filteredLogs : filteredLogs;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const atBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    setAutoScroll(atBottom);
  };

  const downloadLogs = () => {
    const content = displayLogs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kometa-logs-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Logs</h1>
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? 'success' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          {isStreaming && (
            <Badge variant="outline" className="animate-pulse">
              Live
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filter} onValueChange={(v) => setFilter(v as LogLevel)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Levels</SelectItem>
                  <SelectItem value="DEBUG">Debug</SelectItem>
                  <SelectItem value="INFO">Info</SelectItem>
                  <SelectItem value="WARNING">Warning</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaused(!paused)}
              >
                {paused ? (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={clearLogs}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
              <Button variant="outline" size="sm" onClick={downloadLogs}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-[600px] overflow-auto bg-zinc-950 rounded-md p-4 font-mono text-sm log-viewer"
          >
            {displayLogs.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">
                {logs.length === 0 ? 'No logs available' : 'No logs match your filters'}
              </div>
            ) : (
              displayLogs.map((line, i) => {
                const parsed = parseLogLine(line);
                return (
                  <div
                    key={i}
                    className={cn(
                      'py-0.5 hover:bg-zinc-900 whitespace-pre-wrap break-all',
                      levelColors[parsed.level] || 'text-gray-300'
                    )}
                  >
                    {line}
                  </div>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
            <span>{displayLogs.length} lines shown</span>
            {!autoScroll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAutoScroll(true);
                  if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                  }
                }}
              >
                Scroll to bottom
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {logFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Available Log Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {logFiles.map((file) => (
                <Badge key={file.name} variant="outline">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
