import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Shield,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronRight,
  Target,
  Zap,
  BookOpen,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useWebSocket } from '@/hooks/useWebSocket';
import { api, type GuardrailsData as ApiGuardrailsData } from '@/lib/api';
import type { Project } from '@/stores/projectStore';
import { useTheme } from '@/context/ThemeContext';

interface GuardrailsTabProps {
  project: Project;
}

/**
 * Guardrails data structure matching server response
 */
interface GuardrailSign {
  title: string;
  description: string;
}

interface GuardrailsData {
  content: string;
  signs: GuardrailSign[];
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
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <div className="h-5 w-40 bg-muted/50 rounded animate-pulse" />
            <div className="h-4 bg-muted/50 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
            <div className="h-4 bg-muted/50 rounded animate-pulse" style={{ width: `${50 + Math.random() * 30}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Sign card component with visual distinction
 */
function SignCard({
  sign,
  isExpanded,
  onToggle,
  isDark,
}: {
  sign: GuardrailSign;
  isExpanded: boolean;
  onToggle: () => void;
  isDark: boolean;
}) {
  // Determine icon based on sign name
  const getSignIcon = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('stop') || lower.includes('danger') || lower.includes('critical')) {
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }
    if (lower.includes('warn') || lower.includes('caution')) {
      return <Zap className="h-5 w-5 text-yellow-500" />;
    }
    if (lower.includes('rule') || lower.includes('must')) {
      return <Target className="h-5 w-5 text-blue-500" />;
    }
    return <Shield className="h-5 w-5 text-green-500" />;
  };

  // Determine border color based on sign type
  const getBorderColor = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('stop') || lower.includes('danger') || lower.includes('critical')) {
      return 'border-l-red-500';
    }
    if (lower.includes('warn') || lower.includes('caution')) {
      return 'border-l-yellow-500';
    }
    if (lower.includes('rule') || lower.includes('must')) {
      return 'border-l-blue-500';
    }
    return 'border-l-green-500';
  };

  return (
    <div className={cn(
      'border rounded-lg overflow-hidden border-l-4',
      getBorderColor(sign.title)
    )}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        {getSignIcon(sign.title)}
        <span className="font-semibold text-base">{sign.title}</span>
      </button>

      {isExpanded && sign.description && (
        <div className="px-4 pb-4 pt-0 border-t bg-muted/10">
          <div className="prose prose-sm dark:prose-invert max-w-none mt-3">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');

                  if (match) {
                    return (
                      <SyntaxHighlighter
                        style={isDark ? oneDark : oneLight}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{ margin: '0.75rem 0', borderRadius: '0.5rem', fontSize: '0.875rem' }}
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
                ul: ({ children }) => (
                  <ul className="list-disc pl-6 space-y-1 my-2">{children}</ul>
                ),
                li: ({ children }) => (
                  <li className="text-sm">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                a: ({ href, children }) => (
                  <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {sign.description}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main markdown content renderer for raw guardrails content
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
            <h2 className="text-xl font-semibold mt-6 mb-3">{children}</h2>
          ),
          h3: ({ children }) => {
            // Special styling for Sign headers
            const text = String(children);
            if (text.toLowerCase().includes('sign:')) {
              return (
                <h3 className="text-lg font-semibold mt-6 mb-3 flex items-center gap-2 text-primary border-b pb-2">
                  <Shield className="h-5 w-5" />
                  {children}
                </h3>
              );
            }
            return (
              <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>
            );
          },
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
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * GuardrailsTab component - displays guardrails.md with Sign headers highlighted
 */
export function GuardrailsTab({ project }: GuardrailsTabProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [guardrailsData, setGuardrailsData] = useState<GuardrailsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSigns, setExpandedSigns] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  const fetchGuardrails = useCallback(async () => {
    // Save scroll position before update
    if (scrollRef.current) {
      scrollPositionRef.current = scrollRef.current.scrollTop;
    }

    try {
      setIsLoading(true);
      const response = await api.getGuardrails(project.id) as ApiGuardrailsData;
      // Transform the API response to our expected format
      const transformedData: GuardrailsData = {
        content: response.content,
        signs: response.signs.map(s => ({
          title: s.title,
          description: s.description,
        })),
      };
      setGuardrailsData(transformedData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guardrails');
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  // Initial fetch
  useEffect(() => {
    fetchGuardrails();
  }, [fetchGuardrails]);

  // Restore scroll position after data update
  useEffect(() => {
    if (scrollRef.current && scrollPositionRef.current > 0) {
      scrollRef.current.scrollTop = scrollPositionRef.current;
    }
  }, [guardrailsData]);

  // WebSocket for real-time updates
  useWebSocket({
    onFileChange: (message) => {
      if (message.projectId === project.id && message.fileType === 'guardrails') {
        fetchGuardrails();
      }
    },
  });

  const toggleSign = useCallback((title: string) => {
    setExpandedSigns((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (guardrailsData?.signs) {
      setExpandedSigns(new Set(guardrailsData.signs.map((s) => s.title)));
    }
  }, [guardrailsData]);

  const collapseAll = useCallback(() => {
    setExpandedSigns(new Set());
  }, []);

  // Check if there's any content
  const hasContent = useMemo(() => {
    return guardrailsData && (
      guardrailsData.content.trim().length > 0 ||
      guardrailsData.signs.length > 0
    );
  }, [guardrailsData]);

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

  if (isLoading && !guardrailsData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Guardrails
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
            <Shield className="h-5 w-5" />
            Guardrails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState message="No guardrails found. Guardrail signs will appear here when defined." />
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
              <Shield className="h-5 w-5" />
              Guardrails
            </CardTitle>
            {guardrailsData && guardrailsData.signs.length > 0 && (
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
            {/* Signs Section */}
            {guardrailsData && guardrailsData.signs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  <span className="text-sm">{guardrailsData.signs.length} guardrail sign{guardrailsData.signs.length !== 1 ? 's' : ''} defined</span>
                </div>
                <div className="space-y-3">
                  {guardrailsData.signs.map((sign) => (
                    <SignCard
                      key={sign.title}
                      sign={sign}
                      isExpanded={expandedSigns.has(sign.title)}
                      onToggle={() => toggleSign(sign.title)}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Raw Content Section (if no structured signs) */}
            {guardrailsData && guardrailsData.signs.length === 0 && guardrailsData.content && (
              <MarkdownContent content={guardrailsData.content} isDark={isDark} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
