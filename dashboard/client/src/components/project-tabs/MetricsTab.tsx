import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import {
  TrendingUp,
  Clock,
  FileCode,
  CheckCircle2,
  PlayCircle,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useRuns, type RunMeta } from '@/hooks/useApi';
import type { Project, Story } from '@/stores/projectStore';

interface MetricsTabProps {
  project: Project;
}

/**
 * Format duration in seconds to human-readable format
 */
function formatDuration(seconds: number): string {
  if (seconds === 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Parse run ID to extract date for grouping
 * Run IDs are formatted as: YYYYMMDD-HHMMSS-random
 */
function parseRunDate(runId: string): Date | null {
  const match = runId.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, min, sec] = match;
  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(min, 10),
    parseInt(sec, 10)
  );
}

/**
 * Compute story completion data over time from runs
 */
function computeStoryCompletionData(
  runs: RunMeta[] | null,
  stories: Story[] | undefined
): Array<{ date: string; completed: number; total: number }> {
  if (!runs || runs.length === 0 || !stories) return [];

  // Sort runs by date
  const sortedRuns = [...runs].sort((a, b) => a.runId.localeCompare(b.runId));

  // Track completed stories over time
  const completedStories = new Set<string>();
  const totalStories = stories.length;
  const dataPoints: Array<{ date: string; completed: number; total: number }> = [];

  // Group runs by day
  const runsByDay = new Map<string, RunMeta[]>();
  for (const run of sortedRuns) {
    const runDate = parseRunDate(run.runId);
    if (!runDate) continue;
    const dateKey = runDate.toISOString().split('T')[0];
    const existing = runsByDay.get(dateKey) || [];
    existing.push(run);
    runsByDay.set(dateKey, existing);
  }

  // Process each day
  for (const [dateKey, dayRuns] of runsByDay) {
    // Mark successful story runs as completed
    for (const run of dayRuns) {
      if (run.status === 'success' && run.storyId) {
        completedStories.add(run.storyId);
      }
    }

    const date = new Date(dateKey);
    dataPoints.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      completed: completedStories.size,
      total: totalStories,
    });
  }

  return dataPoints;
}

/**
 * Compute success/failure stats from runs
 */
function computeSuccessFailureData(runs: RunMeta[] | null): Array<{
  name: string;
  value: number;
  color: string;
}> {
  if (!runs || runs.length === 0) return [];

  const counts = { success: 0, failed: 0, running: 0 };
  for (const run of runs) {
    if (run.status === 'success') counts.success++;
    else if (run.status === 'failed') counts.failed++;
    else if (run.status === 'running') counts.running++;
  }

  const data = [];
  if (counts.success > 0) {
    data.push({ name: 'Success', value: counts.success, color: '#22c55e' });
  }
  if (counts.failed > 0) {
    data.push({ name: 'Failed', value: counts.failed, color: '#ef4444' });
  }
  if (counts.running > 0) {
    data.push({ name: 'Running', value: counts.running, color: '#3b82f6' });
  }

  return data;
}

/**
 * Compute iteration duration data (limited to recent runs)
 */
function computeDurationData(
  runs: RunMeta[] | null,
  limit = 20
): Array<{ name: string; duration: number; status: string }> {
  if (!runs || runs.length === 0) return [];

  // Sort by date and take recent runs
  const sortedRuns = [...runs]
    .sort((a, b) => b.runId.localeCompare(a.runId))
    .slice(0, limit)
    .reverse();

  return sortedRuns.map((run) => ({
    name: `${run.storyId}#${run.iteration}`,
    duration: run.duration,
    status: run.status,
  }));
}

/**
 * Compute aggregate stats
 */
function computeAggregateStats(runs: RunMeta[] | null): {
  avgDuration: number;
  totalFilesChanged: number;
  totalRuns: number;
  successRate: number;
} {
  if (!runs || runs.length === 0) {
    return { avgDuration: 0, totalFilesChanged: 0, totalRuns: 0, successRate: 0 };
  }

  let totalDuration = 0;
  let totalFilesChanged = 0;
  let successCount = 0;
  let completedRuns = 0;

  for (const run of runs) {
    if (run.duration > 0) {
      totalDuration += run.duration;
      completedRuns++;
    }
    if (run.changedFiles) {
      totalFilesChanged += run.changedFiles.length;
    }
    if (run.status === 'success') {
      successCount++;
    }
  }

  const avgDuration = completedRuns > 0 ? totalDuration / completedRuns : 0;
  const successRate = runs.length > 0 ? (successCount / runs.length) * 100 : 0;

  return {
    avgDuration,
    totalFilesChanged,
    totalRuns: runs.length,
    successRate,
  };
}

/**
 * Stat Card component
 */
function StatCard({
  title,
  value,
  icon: Icon,
  className,
}: {
  title: string;
  value: string | number;
  icon: typeof Clock;
  className?: string;
}) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground/50" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Story Completion Chart - Line chart showing progress over time
 */
function StoryCompletionChart({
  data,
}: {
  data: ReturnType<typeof computeStoryCompletionData>;
}) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Story Completion Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            No completion data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Story Completion Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              domain={[0, 'dataMax']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number, name: string) => [
                value,
                name === 'completed' ? 'Stories Completed' : 'Total Stories',
              ]}
            />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ fill: '#22c55e', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Success/Failure Pie Chart
 */
function SuccessFailurePieChart({
  data,
}: {
  data: ReturnType<typeof computeSuccessFailureData>;
}) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4" />
            Run Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            No run data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4" />
          Run Status Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={{ strokeWidth: 1 }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              formatter={(value: number, name: string) => [
                `${value} runs (${((value / total) * 100).toFixed(1)}%)`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-2">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-muted-foreground">{entry.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Duration Bar Chart - shows iteration durations
 */
function DurationBarChart({
  data,
}: {
  data: ReturnType<typeof computeDurationData>;
}) {
  if (data.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Iteration Duration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            No duration data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Color bars based on status
  const coloredData = data.map((item) => ({
    ...item,
    fill:
      item.status === 'success'
        ? '#22c55e'
        : item.status === 'failed'
          ? '#ef4444'
          : '#3b82f6',
  }));

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Iteration Duration (Recent {data.length} runs)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={coloredData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              className="text-muted-foreground"
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              tickFormatter={(value) => formatDuration(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => [formatDuration(value), 'Duration']}
            />
            <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
              {coloredData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-2">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">Success</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm text-muted-foreground">Failed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-sm text-muted-foreground">Running</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading state component
 */
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground mt-3">Computing metrics...</p>
    </div>
  );
}

/**
 * MetricsTab component - displays various charts and stats for the project
 */
export function MetricsTab({ project }: MetricsTabProps) {
  const { data: runs, isLoading } = useRuns(project.id);
  const stories = project.prd?.stories;

  // Compute all metrics
  const storyCompletionData = useMemo(
    () => computeStoryCompletionData(runs, stories),
    [runs, stories]
  );

  const successFailureData = useMemo(
    () => computeSuccessFailureData(runs),
    [runs]
  );

  const durationData = useMemo(
    () => computeDurationData(runs, 20),
    [runs]
  );

  const stats = useMemo(() => computeAggregateStats(runs), [runs]);

  // Show loading state
  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Average Duration"
          value={formatDuration(stats.avgDuration)}
          icon={Clock}
        />
        <StatCard
          title="Total Files Changed"
          value={stats.totalFilesChanged}
          icon={FileCode}
        />
        <StatCard
          title="Total Runs"
          value={stats.totalRuns}
          icon={PlayCircle}
        />
        <StatCard
          title="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
          icon={CheckCircle2}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <StoryCompletionChart data={storyCompletionData} />
        <SuccessFailurePieChart data={successFailureData} />
      </div>

      {/* Duration Bar Chart - full width */}
      <DurationBarChart data={durationData} />
    </div>
  );
}
