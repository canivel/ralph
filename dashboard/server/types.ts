/**
 * Shared TypeScript types for Ralph Dashboard
 */

// Project types
export interface Project {
  id: string;
  path: string;
  name: string;
  addedAt: string;
}

// PRD types
export interface PRDStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  dependsOn: string[];
  status: 'open' | 'in_progress' | 'done';
  startedAt?: string;
  completedAt?: string;
  updatedAt?: string;
}

export interface PRD {
  version: number;
  project: string;
  overview: string;
  goals: string[];
  nonGoals: string[];
  stack: Record<string, string>;
  qualityGates: string[];
  stories: PRDStory[];
}

// Activity log types
export interface ActivityEvent {
  timestamp: string;
  message: string;
  type: 'iteration_start' | 'iteration_end' | 'other';
}

// Error log types
export interface ErrorEntry {
  timestamp: string;
  message: string;
  iteration?: number;
}

// Run metadata types
export interface RunMeta {
  runId: string;
  iteration: number;
  storyId: string;
  storyTitle: string;
  duration: number;
  status: 'success' | 'failed' | 'running';
  commits?: string[];
  changedFiles?: string[];
}

// WebSocket message types
export interface WSMessage {
  type: string;
  payload: unknown;
}

export interface ProjectUpdateMessage extends WSMessage {
  type: 'project:update';
  payload: {
    projectId: string;
    data: Project;
  };
}

export interface StoryUpdateMessage extends WSMessage {
  type: 'story:update';
  payload: {
    projectId: string;
    storyId: string;
    status: string;
  };
}

export interface RunStartMessage extends WSMessage {
  type: 'run:start';
  payload: {
    projectId: string;
    runId: string;
    storyId: string;
  };
}

export interface RunEndMessage extends WSMessage {
  type: 'run:end';
  payload: {
    projectId: string;
    runId: string;
    status: string;
    duration: number;
  };
}

export interface LogUpdateMessage extends WSMessage {
  type: 'log:activity' | 'log:error';
  payload: {
    projectId: string;
    line: string;
  };
}
