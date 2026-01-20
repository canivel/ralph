/**
 * Zustand store for managing projects state in the dashboard.
 * Handles projects array, selection state, and WebSocket connection status.
 */

import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

/**
 * Story status as defined in the PRD
 */
export type StoryStatus = 'open' | 'in_progress' | 'done';

/**
 * Story from the PRD
 */
export interface Story {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  dependsOn: string[];
  status: StoryStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
}

/**
 * Parsed PRD data structure
 */
export interface Prd {
  version: number;
  project: string;
  overview: string;
  goals: string[];
  nonGoals: string[];
  stack: Record<string, string>;
  qualityGates: string[];
  stories: Story[];
}

/**
 * Project as returned by the API
 */
export interface Project {
  id: string;
  path: string;
  name: string;
  addedAt: string;
  prd?: Prd | null;
  storyCount?: number;
  doneCount?: number;
  inProgressCount?: number;
  isRunning?: boolean;
}

/**
 * WebSocket connection status
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

/**
 * Project store state
 */
interface ProjectState {
  /** Array of registered projects */
  projects: Project[];
  /** Currently selected project ID */
  selectedProjectId: string | null;
  /** WebSocket connection status */
  connectionStatus: ConnectionStatus;
}

/**
 * Project store actions
 */
interface ProjectActions {
  /** Replace all projects */
  setProjects: (projects: Project[]) => void;
  /** Update a single project by ID (merges with existing) */
  updateProject: (id: string, updates: Partial<Project>) => void;
  /** Set the selected project ID */
  setSelectedProject: (id: string | null) => void;
  /** Set the WebSocket connection status */
  setConnectionStatus: (status: ConnectionStatus) => void;
  /** Add a new project to the list */
  addProject: (project: Project) => void;
  /** Remove a project from the list */
  removeProject: (id: string) => void;
}

export type ProjectStore = ProjectState & ProjectActions;

// ============================================================================
// Store
// ============================================================================

/**
 * Zustand store for projects state management.
 *
 * Usage:
 * ```tsx
 * const projects = useProjectStore((state) => state.projects);
 * const setProjects = useProjectStore((state) => state.setProjects);
 * ```
 */
export const useProjectStore = create<ProjectStore>((set) => ({
  // Initial state
  projects: [],
  selectedProjectId: null,
  connectionStatus: 'disconnected',

  // Actions
  setProjects: (projects) =>
    set({ projects }),

  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id ? { ...project, ...updates } : project
      ),
    })),

  setSelectedProject: (id) =>
    set({ selectedProjectId: id }),

  setConnectionStatus: (status) =>
    set({ connectionStatus: status }),

  addProject: (project) =>
    set((state) => ({
      projects: [...state.projects, project],
    })),

  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((project) => project.id !== id),
      // Clear selection if removed project was selected
      selectedProjectId:
        state.selectedProjectId === id ? null : state.selectedProjectId,
    })),
}));
