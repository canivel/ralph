/**
 * Data parsers for Ralph files
 * Handles parsing of PRD JSON, activity.log, errors.log, progress.md,
 * guardrails.md, and run metadata files.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { PRD, PRDStory, ActivityEvent, ErrorEntry, RunMeta } from '../types.js';

// ============================================================================
// Additional Types for Parsed Data
// ============================================================================

/**
 * Story summary parsed from progress.md
 */
export interface ProgressStorySummary {
  id: string;
  title: string;
  summary: string;
}

/**
 * Structured progress data from progress.md
 */
export interface ProgressData {
  content: string;
  patterns: string[];
  stories: ProgressStorySummary[];
}

/**
 * Sign entry parsed from guardrails.md
 */
export interface GuardrailSign {
  title: string;
  description: string;
}

/**
 * Structured guardrails data from guardrails.md
 */
export interface GuardrailsData {
  content: string;
  signs: GuardrailSign[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely read a file, returning null if it doesn't exist or can't be read
 */
async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = await readFile(filePath, 'utf-8');
    return content;
  } catch {
    return null;
  }
}


// ============================================================================
// PRD Parser
// ============================================================================

/**
 * Parse a PRD JSON file
 * @param filePath - Path to the PRD JSON file
 * @returns Parsed PRD object or null if file doesn't exist/is malformed
 */
export async function parsePrd(filePath: string): Promise<PRD | null> {
  const content = await safeReadFile(filePath);
  if (!content) {
    return null;
  }

  try {
    const data = JSON.parse(content);

    // Validate required fields
    if (typeof data.version !== 'number' ||
        typeof data.project !== 'string' ||
        !Array.isArray(data.stories)) {
      return null;
    }

    // Normalize stories
    const stories: PRDStory[] = data.stories.map((story: Record<string, unknown>) => ({
      id: String(story.id || ''),
      title: String(story.title || ''),
      description: String(story.description || ''),
      acceptanceCriteria: Array.isArray(story.acceptanceCriteria)
        ? story.acceptanceCriteria.map(String)
        : [],
      dependsOn: Array.isArray(story.dependsOn)
        ? story.dependsOn.map(String)
        : [],
      status: (['open', 'in_progress', 'done'].includes(story.status as string))
        ? (story.status as PRDStory['status'])
        : 'open',
      startedAt: story.startedAt ? String(story.startedAt) : undefined,
      completedAt: story.completedAt ? String(story.completedAt) : undefined,
      updatedAt: story.updatedAt ? String(story.updatedAt) : undefined,
    }));

    const prd: PRD = {
      version: data.version,
      project: data.project,
      overview: String(data.overview || ''),
      goals: Array.isArray(data.goals) ? data.goals.map(String) : [],
      nonGoals: Array.isArray(data.nonGoals) ? data.nonGoals.map(String) : [],
      stack: typeof data.stack === 'object' && data.stack !== null
        ? Object.fromEntries(
            Object.entries(data.stack).map(([k, v]) => [k, String(v)])
          )
        : {},
      qualityGates: Array.isArray(data.qualityGates)
        ? data.qualityGates.map(String)
        : [],
      stories,
    };

    return prd;
  } catch {
    return null;
  }
}

// ============================================================================
// Activity Log Parser
// ============================================================================

/**
 * Parse an activity.log file
 * Format examples:
 * [2026-01-19 20:14:59] ITERATION 1 start (mode=build story=US-002)
 * [2026-01-19 20:20:41] ITERATION 1 end (duration=343s)
 * [2026-01-19 20:15:00] Some other message
 *
 * @param filePath - Path to the activity.log file
 * @returns Array of parsed activity events
 */
export async function parseActivityLog(filePath: string): Promise<ActivityEvent[]> {
  const content = await safeReadFile(filePath);
  if (!content) {
    return [];
  }

  const events: ActivityEvent[] = [];
  const lines = content.split('\n').filter(line => line.trim());

  for (const line of lines) {
    // Skip markdown headers and summary table entries
    if (line.startsWith('#') || line.startsWith('-')) {
      continue;
    }

    // Parse event lines: [timestamp] message
    const match = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s*(.+)$/);
    if (match) {
      const [, timestamp, message] = match;

      // Determine event type
      let type: ActivityEvent['type'] = 'other';
      if (message.includes('ITERATION') && message.includes('start')) {
        type = 'iteration_start';
      } else if (message.includes('ITERATION') && message.includes('end')) {
        type = 'iteration_end';
      }

      events.push({
        timestamp: timestamp.replace(' ', 'T'),
        message,
        type,
      });
    }
  }

  return events;
}

// ============================================================================
// Errors Log Parser
// ============================================================================

/**
 * Parse an errors.log file
 * Format examples:
 * [2026-01-19 20:15:00] PRE-EXISTING: npm test fails because...
 * [2026-01-19 20:16:00] Error in iteration 3: TypeScript compilation failed
 *
 * @param filePath - Path to the errors.log file
 * @returns Array of parsed error entries
 */
export async function parseErrorsLog(filePath: string): Promise<ErrorEntry[]> {
  const content = await safeReadFile(filePath);
  if (!content) {
    return [];
  }

  const errors: ErrorEntry[] = [];
  const lines = content.split('\n').filter(line => line.trim());

  for (const line of lines) {
    // Parse error lines: [timestamp] message
    const match = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s*(.+)$/);
    if (match) {
      const [, timestamp, message] = match;

      // Try to extract iteration number
      let iteration: number | undefined;
      const iterMatch = message.match(/iteration\s+(\d+)/i);
      if (iterMatch) {
        iteration = parseInt(iterMatch[1], 10);
      }

      errors.push({
        timestamp: timestamp.replace(' ', 'T'),
        message,
        iteration,
      });
    }
  }

  return errors;
}

// ============================================================================
// Run Metadata Parser
// ============================================================================

/**
 * Parse a run metadata file (.ralph/runs/*.md)
 * Format example:
 * # Ralph Run Summary
 *
 * - Run ID: 20260119-201458-41469
 * - Iteration: 1
 * - Mode: build
 * - Story: US-002: Express server with basic routing
 * - Started: 2026-01-19 20:14:58
 * - Ended: 2026-01-19 20:20:41
 * - Duration: 343s
 * - Status: success
 * - Log: /f/Projects/ralph/.ralph/runs/run-20260119-201458-41469-iter-1.log
 *
 * @param filePath - Path to the run metadata file
 * @returns Parsed run metadata or null if file doesn't exist/is malformed
 */
export async function parseRunMeta(filePath: string): Promise<RunMeta | null> {
  const content = await safeReadFile(filePath);
  if (!content) {
    return null;
  }

  try {
    const lines = content.split('\n');

    let runId = '';
    let iteration = 0;
    let storyId = '';
    let storyTitle = '';
    let duration = 0;
    let status: RunMeta['status'] = 'running';
    const commits: string[] = [];
    const changedFiles: string[] = [];

    let inCommits = false;
    let inChangedFiles = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Parse metadata lines
      if (trimmed.startsWith('- Run ID:')) {
        runId = trimmed.replace('- Run ID:', '').trim();
      } else if (trimmed.startsWith('- Iteration:')) {
        iteration = parseInt(trimmed.replace('- Iteration:', '').trim(), 10) || 0;
      } else if (trimmed.startsWith('- Story:')) {
        const storyMatch = trimmed.replace('- Story:', '').trim();
        const storyParts = storyMatch.match(/^(US-\d+):\s*(.+)$/);
        if (storyParts) {
          storyId = storyParts[1];
          storyTitle = storyParts[2];
        } else {
          storyId = storyMatch;
          storyTitle = storyMatch;
        }
      } else if (trimmed.startsWith('- Duration:')) {
        const durationStr = trimmed.replace('- Duration:', '').trim();
        const durationMatch = durationStr.match(/(\d+)/);
        if (durationMatch) {
          duration = parseInt(durationMatch[1], 10);
        }
      } else if (trimmed.startsWith('- Status:')) {
        const statusStr = trimmed.replace('- Status:', '').trim().toLowerCase();
        if (statusStr === 'success') status = 'success';
        else if (statusStr === 'failed') status = 'failed';
        else status = 'running';
      } else if (trimmed === '### Commits') {
        inCommits = true;
        inChangedFiles = false;
      } else if (trimmed === '### Changed Files (commits)') {
        inCommits = false;
        inChangedFiles = true;
      } else if (trimmed === '### Uncommitted Changes') {
        inCommits = false;
        inChangedFiles = false;
      } else if (inCommits && trimmed.startsWith('- ') && !trimmed.includes('(none)')) {
        const commit = trimmed.replace('- ', '').trim();
        if (commit && commit !== '(none)') {
          commits.push(commit);
        }
      } else if (inChangedFiles && trimmed.startsWith('- ') && !trimmed.includes('(none)')) {
        const file = trimmed.replace('- ', '').trim();
        if (file && file !== '(none)') {
          changedFiles.push(file);
        }
      }
    }

    // Return null if we couldn't parse essential fields
    if (!runId) {
      return null;
    }

    return {
      runId,
      iteration,
      storyId,
      storyTitle,
      duration,
      status,
      commits: commits.length > 0 ? commits : undefined,
      changedFiles: changedFiles.length > 0 ? changedFiles : undefined,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Progress.md Parser
// ============================================================================

/**
 * Parse the progress.md file
 * Format: Has "## Codebase Patterns" section with patterns and "## Recent Stories" section
 * with story summaries like "### US-XXX: Title" followed by bullet points
 *
 * @param filePath - Path to the progress.md file
 * @returns Structured progress data with patterns and story summaries
 */
export async function parseProgressMd(filePath: string): Promise<ProgressData> {
  const content = await safeReadFile(filePath);
  if (!content) {
    return { content: '', patterns: [], stories: [] };
  }

  const patterns: string[] = [];
  const stories: ProgressStorySummary[] = [];

  // Split content into sections by ## headers
  const lines = content.split('\n');
  let currentSection = '';
  let currentStory: ProgressStorySummary | null = null;
  let storyLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section headers
    if (trimmed.startsWith('## ')) {
      // Save previous story if any
      if (currentStory && storyLines.length > 0) {
        currentStory.summary = storyLines.join('\n');
        stories.push(currentStory);
        currentStory = null;
        storyLines = [];
      }

      const sectionName = trimmed.slice(3).trim().toLowerCase();
      if (sectionName.includes('pattern')) {
        currentSection = 'patterns';
      } else if (sectionName.includes('stories') || sectionName.includes('recent')) {
        currentSection = 'stories';
      } else {
        currentSection = 'other';
      }
      continue;
    }

    // Check for story headers (### US-XXX: Title)
    if (trimmed.startsWith('### ')) {
      // Save previous story if any
      if (currentStory && storyLines.length > 0) {
        currentStory.summary = storyLines.join('\n');
        stories.push(currentStory);
        storyLines = [];
      }

      const storyHeader = trimmed.slice(4).trim();
      const storyMatch = storyHeader.match(/^(US-\d+):\s*(.+)$/);
      if (storyMatch) {
        currentStory = {
          id: storyMatch[1],
          title: storyMatch[2].trim(),
          summary: '',
        };
      }
      continue;
    }

    // Parse patterns section
    if (currentSection === 'patterns') {
      // Handle both "- Pattern: description" and "- **pattern**: description" formats
      if (trimmed.startsWith('- ')) {
        let patternText = trimmed.slice(2).trim();
        // Remove "Pattern: " prefix if present
        if (patternText.toLowerCase().startsWith('pattern:')) {
          patternText = patternText.slice(8).trim();
        }
        if (patternText) {
          patterns.push(patternText);
        }
      }
    }

    // Collect story content
    if (currentStory && trimmed) {
      storyLines.push(trimmed);
    }
  }

  // Save last story if any
  if (currentStory && storyLines.length > 0) {
    currentStory.summary = storyLines.join('\n');
    stories.push(currentStory);
  }

  return { content, patterns, stories };
}

// ============================================================================
// Guardrails.md Parser
// ============================================================================

/**
 * Parse the guardrails.md file
 * Format: Markdown with "### Sign: [Name]" headers followed by metadata
 *
 * @param filePath - Path to the guardrails.md file
 * @returns Structured guardrails data
 */
export async function parseGuardrailsMd(filePath: string): Promise<GuardrailsData> {
  const content = await safeReadFile(filePath);
  if (!content) {
    return { content: '', signs: [] };
  }

  const signs: GuardrailSign[] = [];

  // Split by "### Sign:" headers
  const signRegex = /###\s*Sign:\s*(.+?)$/gm;
  let match;
  const signMatches: Array<{ name: string; start: number; end: number }> = [];

  while ((match = signRegex.exec(content)) !== null) {
    if (signMatches.length > 0) {
      signMatches[signMatches.length - 1].end = match.index;
    }
    signMatches.push({
      name: match[1].trim(),
      start: match.index,
      end: content.length,
    });
  }

  for (const signMatch of signMatches) {
    const signContent = content.slice(signMatch.start, signMatch.end).trim();

    // Build description from the content after the header
    const lines = signContent.split('\n').slice(1); // Skip the header line
    const descriptionParts: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        descriptionParts.push(trimmed);
      }
    }

    signs.push({
      title: signMatch.name,
      description: descriptionParts.join('\n'),
    });
  }

  return {
    content,
    signs,
  };
}

// Re-export types from types.ts for convenience
export type { PRD, PRDStory, ActivityEvent, ErrorEntry, RunMeta };
