import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  AlertTriangle,
  BookOpen,
  Lightbulb,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useWebSocket } from '@/hooks/useWebSocket';
import { api, type ProgressData as ApiProgressData } from '@/lib/api';
import type { Project } from '@/stores/projectStore';
import { useTheme } from '@/context/ThemeContext';

interface ProgressTabProps {
  project: Project;
}

/**
 * Progress data structure matching server response
 */
interface ProgressData {
  content: string;
  patterns: string[];
  stories: Array<{
    id: string;
    title: string;
    summary: string;
  }>;
}

/**
 * Empty state component
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Loading skeleton component
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="h-6 w-48 bg-muted/50 rounded animate-pulse" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-4 bg-muted/50 rounded animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />
        ))}
      </div>
      <div className="h-6 w-32 bg-muted/50 rounded animate-pulse mt-6" />
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-4 bg-muted/50 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Collapsible story section
 */
function StorySection({
  storyId,
  title,
  summary,
  isExpanded,
  onToggle,
  isDark,
}: {
  storyId: string;
  title: string;
  summary: string;
  isExpanded: boolean;
  onToggle: () => void;
  isDark: boolean;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="font-mono text-sm text-primary font-medium">{storyId}</span>
        <span className="text-sm truncate">{title}</span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t bg-muted/20">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');

                  if (match) {
                    return (
                      <SyntaxHighlighter
                        style={isDark ? oneDark : oneLight}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '0.875rem' }}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    );
                  }

                  // Inline code
                  return (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => <>{children}</>,
                a: ({ href, children }) => (
                  <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {summary}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Codebase patterns section
 */
function PatternsSection({ patterns }: { patterns: string[] }) {
  if (patterns.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-yellow-500" />
        <h3 className="font-semibold text-lg">Codebase Patterns</h3>
      </div>
      <ul className="space-y-2 pl-7">
        {patterns.map((pattern, index) => (
          <li key={index} className="text-sm text-muted-foreground">
            <ReactMarkdown
              components={{
                p: ({ children }) => <span>{children}</span>,
                code: ({ children }) => (
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                    {children}
                  </code>
                ),
              }}
            >
              {pattern}
            </ReactMarkdown>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Main markdown content renderer with syntax highlighting
 */
function MarkdownContent({ content, isDark }: { content: string; isDark: boolean }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mt-6 mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const isInline = !className && typeof children === 'string' && !children.includes('\n');

            if (isInline) {
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            }

            if (match) {
              return (
                <SyntaxHighlighter
                  style={isDark ? oneDark : oneLight}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ margin: '1rem 0', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                >
                  {codeString}
                </SyntaxHighlighter>
              );
            }

            return (
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4">
                <code className="text-sm font-mono" {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          pre: ({ children }) => <>{children}</>,
          ul: ({ children }) => (
            <ul className="list-disc pl-6 space-y-1 my-3">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 space-y-1 my-3">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/50 pl-4 italic my-4 text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-border" />,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full border-collapse border border-border">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-muted px-3 py-2 text-left font-medium">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * ProgressTab component - displays progress.md with collapsible story sections
 */
export function ProgressTab({ project }: ProgressTabProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  const fetchProgress = useCallback(async () => {
    // Save scroll position before update
    if (scrollRef.current) {
      scrollPositionRef.current = scrollRef.current.scrollTop;
    }

    try {
      setIsLoading(true);
      const response = await api.getProgress(project.id) as ApiProgressData;
      setProgressData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  // Initial fetch
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // Restore scroll position after data update
  useEffect(() => {
    if (scrollRef.current && scrollPositionRef.current > 0) {
      scrollRef.current.scrollTop = scrollPositionRef.current;
    }
  }, [progressData]);

  // WebSocket for real-time updates
  useWebSocket({
    onFileChange: (message) => {
      if (message.projectId === project.id && message.fileType === 'progress') {
        fetchProgress();
      }
    },
  });

  const toggleStory = useCallback((storyId: string) => {
    setExpandedStories((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) {
        next.delete(storyId);
      } else {
        next.add(storyId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (progressData?.stories) {
      setExpandedStories(new Set(progressData.stories.map((s) => s.id)));
    }
  }, [progressData]);

  const collapseAll = useCallback(() => {
    setExpandedStories(new Set());
  }, []);

  // Check if there's any content
  const hasContent = useMemo(() => {
    return progressData && (
      progressData.content.trim().length > 0 ||
      progressData.patterns.length > 0 ||
      progressData.stories.length > 0
    );
  }, [progressData]);

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-red-500">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading && !progressData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Progress Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (!hasContent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Progress Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState message="No progress log found. Progress entries will appear here as stories are completed." />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Progress Log
            </CardTitle>
            {progressData && progressData.stories.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={expandAll}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Expand all
                </button>
                <span className="text-xs text-muted-foreground">|</span>
                <button
                  onClick={collapseAll}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Collapse all
                </button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div ref={scrollRef} className="space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
            {/* Codebase Patterns Section */}
            {progressData && progressData.patterns.length > 0 && (
              <PatternsSection patterns={progressData.patterns} />
            )}

            {/* Story Summaries Section */}
            {progressData && progressData.stories.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Recent Story Summaries</h3>
                <div className="space-y-2">
                  {progressData.stories.map((story) => (
                    <StorySection
                      key={story.id}
                      storyId={story.id}
                      title={story.title}
                      summary={story.summary}
                      isExpanded={expandedStories.has(story.id)}
                      onToggle={() => toggleStory(story.id)}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Raw Content Section (if no structured data) */}
            {progressData && progressData.stories.length === 0 && progressData.patterns.length === 0 && progressData.content && (
              <MarkdownContent content={progressData.content} isDark={isDark} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
