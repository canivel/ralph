# Ralph Dashboard - Implementation Plan

## Overview

A real-time web dashboard for visualizing Ralph agent loop progress across multiple concurrent projects. The dashboard provides visibility into stories, iterations, logs, errors, and guardrails for users running long autonomous coding sessions.

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Ralph Dashboard                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐  │
│  │   ralph build    │    │   ralph build    │    │    ralph build       │  │
│  │  (Project A)     │    │  (Project B)     │    │   (Project C)        │  │
│  └────────┬─────────┘    └────────┬─────────┘    └──────────┬───────────┘  │
│           │                       │                          │              │
│           │  .ralph/              │  .ralph/                 │  .ralph/     │
│           │  ├── progress.md      │  ├── progress.md         │  ├── ...     │
│           │  ├── activity.log     │  ├── activity.log        │              │
│           │  ├── errors.log       │  ├── errors.log          │              │
│           │  ├── guardrails.md    │  ├── guardrails.md       │              │
│           │  └── runs/            │  └── runs/               │              │
│           ▼                       ▼                          ▼              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     Ralph Dashboard Server                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │  │
│  │  │ File Watcher │  │  Data Parser │  │      WebSocket Server      │  │  │
│  │  │  (chokidar)  │──│  (JSON/MD)   │──│   (real-time updates)      │  │  │
│  │  └──────────────┘  └──────────────┘  └────────────────────────────┘  │  │
│  │                                                                       │  │
│  │  ┌──────────────────────────────────────────────────────────────┐    │  │
│  │  │                    REST API Endpoints                         │    │  │
│  │  │  GET /api/projects          - list registered projects        │    │  │
│  │  │  GET /api/projects/:id      - project details + stories       │    │  │
│  │  │  GET /api/projects/:id/runs - run history with metadata       │    │  │
│  │  │  GET /api/projects/:id/logs - activity + error logs           │    │  │
│  │  │  POST /api/projects         - register new project path       │    │  │
│  │  │  DELETE /api/projects/:id   - unregister project              │    │  │
│  │  └──────────────────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    │ WebSocket + REST                       │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        React Frontend (SPA)                           │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │                     Project Sidebar                              │ │  │
│  │  │  ○ Project A (3/10 stories) ●                                   │ │  │
│  │  │  ○ Project B (7/12 stories)                                     │ │  │
│  │  │  ○ Project C (idle)                                             │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │                     Main Content Area                            │ │  │
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │ │  │
│  │  │  │  Overview   │ │   Stories   │ │    Runs     │ │   Logs    │  │ │  │
│  │  │  │   Panel     │ │   Board     │ │  Timeline   │ │  Viewer   │  │ │  │
│  │  │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Backend Runtime** | Node.js | Already a dependency, consistent with existing CLI |
| **Web Framework** | Express.js | Minimal, well-known, easy to extend |
| **WebSocket** | ws | Lightweight, native WebSocket for real-time updates |
| **File Watching** | chokidar | Cross-platform file watching with debouncing |
| **Frontend** | React + Vite | Fast dev experience, modern tooling |
| **UI Components** | shadcn/ui + Tailwind | Clean design system, accessible components |
| **State Management** | Zustand | Minimal boilerplate, works well with WebSocket |
| **Charts** | Recharts | React-native charting for metrics visualization |
| **Markdown Rendering** | react-markdown | For progress.md and guardrails.md display |
| **Syntax Highlighting** | Prism.js | For log file code snippets |

---

## Data Sources & Parsing

### 1. PRD JSON (`.agents/tasks/prd.json`)

**Structure:**
```json
{
  "version": 1,
  "project": "Project Name",
  "overview": "...",
  "goals": ["..."],
  "nonGoals": ["..."],
  "stack": {...},
  "qualityGates": ["npm test", "npm run lint"],
  "stories": [
    {
      "id": "US-001",
      "title": "User authentication",
      "description": "...",
      "acceptanceCriteria": ["..."],
      "dependsOn": [],
      "status": "open|in_progress|done",
      "startedAt": "ISO timestamp",
      "completedAt": "ISO timestamp",
      "updatedAt": "ISO timestamp"
    }
  ]
}
```

**Dashboard Use:**
- Story kanban board (open → in_progress → done)
- Progress percentage calculation
- Dependency graph visualization
- Quality gates checklist

### 2. Activity Log (`.ralph/activity.log`)

**Format:**
```
[2024-01-19 13:57:22] ITERATION 1 start (mode=build story=US-001)
[2024-01-19 14:02:15] ITERATION 1 end (duration=293s)
```

**Dashboard Use:**
- Activity timeline
- Iteration duration tracking
- Real-time status updates

### 3. Run Metadata (`.ralph/runs/run-*.md`)

**Format:**
```markdown
# Ralph Run Summary
- Run ID: 20240119-135722-1234
- Iteration: 1
- Story: US-001: User authentication
- Duration: 293s
- Status: success
## Git
- Commits: ...
- Changed Files: ...
```

**Dashboard Use:**
- Run history table
- Git commit tracking
- Files changed per iteration
- Duration metrics

### 4. Run Logs (`.ralph/runs/run-*.log`)

**Format:** Raw agent output (can be large)

**Dashboard Use:**
- Expandable log viewer with search
- Output streaming for active runs
- Error extraction and highlighting

### 5. Progress Log (`.ralph/progress.md`)

**Format:** Markdown with structured entries per completed story

**Dashboard Use:**
- Completion history with details
- Learnings viewer
- Verification results display

### 6. Errors Log (`.ralph/errors.log`)

**Format:**
```
[2024-01-19 14:02:15] ITERATION 1 command failed (status=1)
```

**Dashboard Use:**
- Error timeline
- Failure pattern detection
- Alert notifications

### 7. Guardrails (`.ralph/guardrails.md`)

**Format:** Markdown with "Signs" sections

**Dashboard Use:**
- Guardrails reference panel
- Lessons learned display

---

## CLI Integration

### New Command: `ralph dashboard`

```bash
ralph dashboard [options]

Options:
  --port <number>       Server port (default: 4242)
  --host <string>       Host to bind (default: localhost)
  --open                Open browser automatically
  --projects <paths>    Comma-separated project paths to watch

Examples:
  ralph dashboard                           # Watch current directory
  ralph dashboard --port 8080 --open
  ralph dashboard --projects /path/a,/path/b
```

### Project Registration

Projects can be registered via:
1. **CLI argument:** `--projects path1,path2`
2. **Config file:** `~/.ralph/dashboard.json`
3. **API endpoint:** `POST /api/projects`
4. **Auto-discovery:** Scan for `.ralph/` directories in common locations

---

## Frontend Views

### 1. Projects Overview (Home)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Ralph Dashboard                                    [+ Add Project]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ my-app                                          ● RUNNING      │  │
│  │ /Users/dev/projects/my-app                                    │  │
│  │                                                               │  │
│  │  Stories: ████████░░ 8/10 (80%)    Current: US-008           │  │
│  │  Iteration: 5 of 25                Duration: 12m 34s         │  │
│  │  Last activity: 30s ago            Errors: 0                 │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ api-service                                     ○ IDLE         │  │
│  │ /Users/dev/projects/api-service                               │  │
│  │                                                               │  │
│  │  Stories: ██████████ 12/12 (100%)  Completed: 2h ago         │  │
│  │  Total runs: 15                    Total time: 1h 45m        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Project Detail View

**Tabs:**

#### 2a. Overview Tab
- Project summary stats (stories, runs, time)
- Quality gates status
- Recent activity feed
- Current iteration status (if running)

#### 2b. Stories Tab (Kanban Board)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Stories                                    View: [Kanban | List]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  OPEN (3)            IN PROGRESS (1)       DONE (6)                │
│  ┌─────────────┐     ┌─────────────┐       ┌─────────────┐         │
│  │ US-009      │     │ US-008      │       │ US-001      │         │
│  │ Add export  │     │ ● Active    │       │ ✓ Auth      │         │
│  │             │     │ Email notif │       │ 45m         │         │
│  │ Blocked by: │     │             │       └─────────────┘         │
│  │ US-008      │     │ Started:    │       ┌─────────────┐         │
│  └─────────────┘     │ 12m ago     │       │ US-002      │         │
│  ┌─────────────┐     └─────────────┘       │ ✓ Database  │         │
│  │ US-010      │                           │ 32m         │         │
│  │ Analytics   │                           └─────────────┘         │
│  └─────────────┘                           ...                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2c. Runs Tab (Timeline)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Runs                                              Filter: [All ▼]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Run ID                  Story      Duration  Status   Git          │
│  ──────────────────────────────────────────────────────────────────│
│  ● 20240119-135722-1234  US-008     12:34     running  -            │
│  ✓ 20240119-133500-1233  US-007     08:45     success  abc123d      │
│  ✓ 20240119-131200-1232  US-006     15:22     success  def456e      │
│  ✗ 20240119-125800-1231  US-005     03:15     failed   -            │
│  ✓ 20240119-124000-1230  US-005     11:08     success  ghi789f      │
│                                                                     │
│  [Click row to expand run details, logs, git changes]              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2d. Logs Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│ Logs                   [Activity | Errors | Current Run]   🔍 Search│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ [2024-01-19 14:05:22] ITERATION 5 start (story=US-008)        │ │
│  │ [2024-01-19 14:03:18] ITERATION 4 end (duration=185s)         │ │
│  │ [2024-01-19 14:00:13] ITERATION 4 start (story=US-007)        │ │
│  │ ...                                                            │ │
│  │                                                                │ │
│  │ [Auto-scroll enabled] [Download] [Clear filters]              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2e. Progress Tab

Rendered markdown view of `progress.md` with:
- Collapsible story sections
- Syntax highlighted code blocks
- Commit links (if configured)
- Verification results with pass/fail badges

#### 2f. Guardrails Tab

Rendered markdown view of `guardrails.md`:
- Core signs
- Learned signs with trigger/instruction/context

### 3. Metrics View

```
┌─────────────────────────────────────────────────────────────────────┐
│ Metrics                                        Time: [Last 24h ▼]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────┐ ┌────────────────────┐ │
│  │ Stories Over Time                       │ │ Success Rate       │ │
│  │                                         │ │                    │ │
│  │    ████                                 │ │    ████████ 85%    │ │
│  │   █████                                 │ │                    │ │
│  │  ██████                                 │ │  15 successful     │ │
│  │ ███████                                 │ │   3 failed         │ │
│  └─────────────────────────────────────────┘ └────────────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────┐ ┌────────────────────┐ │
│  │ Iteration Duration                      │ │ Files Changed      │ │
│  │                                         │ │                    │ │
│  │  avg: 8m 32s  │ max: 25m  │ min: 2m    │ │  Total: 47 files   │ │
│  │                                         │ │  Avg per run: 3.1  │ │
│  └─────────────────────────────────────────┘ └────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Real-Time Updates

### WebSocket Events

```typescript
// Server → Client events
interface ServerEvents {
  // Project-level updates
  'project:update': { projectId: string; data: ProjectData }
  'project:status': { projectId: string; status: 'running' | 'idle' | 'error' }

  // Story updates
  'story:update': { projectId: string; storyId: string; status: string }

  // Run updates
  'run:start': { projectId: string; runId: string; storyId: string }
  'run:end': { projectId: string; runId: string; status: string; duration: number }
  'run:log': { projectId: string; runId: string; content: string }

  // Log updates (streaming)
  'log:activity': { projectId: string; line: string }
  'log:error': { projectId: string; line: string }
}

// Client → Server events
interface ClientEvents {
  'subscribe': { projectIds: string[] }
  'unsubscribe': { projectIds: string[] }
}
```

### File Watching Strategy

```typescript
// Watch patterns per project
const watchPatterns = [
  '.agents/tasks/*.json',      // PRD files
  '.ralph/progress.md',        // Progress log
  '.ralph/activity.log',       // Activity events
  '.ralph/errors.log',         // Errors
  '.ralph/guardrails.md',      // Guardrails
  '.ralph/runs/*.log',         // Run logs (for active run streaming)
  '.ralph/runs/*.md',          // Run metadata
];

// Debounce file changes to avoid excessive updates
// Use 100ms debounce for logs (streaming feel)
// Use 500ms debounce for structural changes (PRD, progress)
```

---

## Project Structure

```
ralph/
├── package.json                 # Add dashboard dependencies
├── bin/
│   └── ralph                    # Add 'dashboard' command
├── dashboard/
│   ├── server/
│   │   ├── index.ts             # Express + WebSocket server
│   │   ├── routes/
│   │   │   ├── projects.ts      # Project CRUD endpoints
│   │   │   ├── runs.ts          # Run history endpoints
│   │   │   └── logs.ts          # Log retrieval endpoints
│   │   ├── services/
│   │   │   ├── projectManager.ts    # Project registration & state
│   │   │   ├── fileWatcher.ts       # Chokidar file watching
│   │   │   ├── dataParser.ts        # Parse PRD, logs, runs
│   │   │   └── websocketHub.ts      # WebSocket connection manager
│   │   └── types.ts             # Shared TypeScript types
│   ├── client/
│   │   ├── package.json         # Vite + React dependencies
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── Sidebar.tsx
│   │   │   │   │   └── Header.tsx
│   │   │   │   ├── projects/
│   │   │   │   │   ├── ProjectCard.tsx
│   │   │   │   │   ├── ProjectDetail.tsx
│   │   │   │   │   └── AddProjectDialog.tsx
│   │   │   │   ├── stories/
│   │   │   │   │   ├── StoryBoard.tsx
│   │   │   │   │   ├── StoryCard.tsx
│   │   │   │   │   └── StoryDetail.tsx
│   │   │   │   ├── runs/
│   │   │   │   │   ├── RunsTimeline.tsx
│   │   │   │   │   ├── RunRow.tsx
│   │   │   │   │   └── RunDetail.tsx
│   │   │   │   ├── logs/
│   │   │   │   │   ├── LogViewer.tsx
│   │   │   │   │   └── LogLine.tsx
│   │   │   │   ├── metrics/
│   │   │   │   │   ├── MetricsPanel.tsx
│   │   │   │   │   └── Charts.tsx
│   │   │   │   └── common/
│   │   │   │       ├── ProgressBar.tsx
│   │   │   │       ├── StatusBadge.tsx
│   │   │   │       └── MarkdownRenderer.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useWebSocket.ts
│   │   │   │   ├── useProjects.ts
│   │   │   │   └── useProjectData.ts
│   │   │   ├── stores/
│   │   │   │   ├── projectStore.ts
│   │   │   │   └── uiStore.ts
│   │   │   ├── lib/
│   │   │   │   ├── api.ts
│   │   │   │   └── utils.ts
│   │   │   └── styles/
│   │   │       └── globals.css
│   │   └── public/
│   └── build.ts                 # Build script for bundling
└── ...
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Foundation)
1. Set up dashboard directory structure
2. Create Express server with basic routes
3. Implement file watching service
4. Add WebSocket server
5. Create data parsers for all file types
6. Add `ralph dashboard` CLI command

### Phase 2: Frontend Shell
1. Set up Vite + React project
2. Install and configure Tailwind + shadcn/ui
3. Create layout components (sidebar, header)
4. Implement routing
5. Set up Zustand stores
6. Create WebSocket hook

### Phase 3: Projects View
1. Project listing component
2. Add project dialog
3. Project card with status
4. Project registration API

### Phase 4: Project Detail - Overview
1. Project detail layout with tabs
2. Overview panel with stats
3. Quality gates display
4. Current iteration status

### Phase 5: Stories Board
1. Kanban board layout
2. Story cards with status
3. Story detail modal
4. Dependency visualization

### Phase 6: Runs Timeline
1. Runs table with sorting/filtering
2. Run detail expansion
3. Git commit display
4. Changed files list

### Phase 7: Logs Viewer
1. Activity log display
2. Error log display
3. Run log viewer (for specific runs)
4. Log streaming for active runs
5. Search/filter functionality

### Phase 8: Progress & Guardrails
1. Markdown renderer component
2. Progress log view with sections
3. Guardrails display

### Phase 9: Metrics & Polish
1. Charts for story completion
2. Duration metrics
3. Success rate visualization
4. Dark mode support
5. Responsive design
6. Loading states
7. Error handling

### Phase 10: Testing & Documentation
1. Unit tests for parsers
2. Integration tests for API
3. E2E tests for critical flows
4. Update README with dashboard docs
5. Add inline help/tooltips

---

## API Endpoints

```
GET    /api/projects                    List all registered projects
POST   /api/projects                    Register a new project { path: string }
GET    /api/projects/:id                Get project details
DELETE /api/projects/:id                Unregister a project
GET    /api/projects/:id/prd            Get parsed PRD data
GET    /api/projects/:id/stories        Get stories with status
GET    /api/projects/:id/runs           Get run history
GET    /api/projects/:id/runs/:runId    Get specific run details
GET    /api/projects/:id/runs/:runId/log  Get run log content
GET    /api/projects/:id/logs/activity  Get activity log
GET    /api/projects/:id/logs/errors    Get errors log
GET    /api/projects/:id/progress       Get progress.md content
GET    /api/projects/:id/guardrails     Get guardrails.md content
GET    /api/projects/:id/metrics        Get computed metrics
```

---

## Configuration

### Dashboard Config (`~/.ralph/dashboard.json`)

```json
{
  "port": 4242,
  "host": "localhost",
  "projects": [
    {
      "id": "abc123",
      "path": "/path/to/project",
      "name": "My Project",
      "addedAt": "2024-01-19T12:00:00Z"
    }
  ],
  "theme": "system",
  "autoRefresh": true,
  "refreshInterval": 1000
}
```

---

## Security Considerations

1. **Local only by default** - Bind to localhost, require explicit `--host 0.0.0.0` for network access
2. **Path validation** - Validate project paths exist and contain `.ralph/` directory
3. **No code execution** - Dashboard is read-only, never executes code from logs
4. **Rate limiting** - Limit WebSocket message frequency
5. **Input sanitization** - Sanitize all user inputs and file contents before display

---

## Performance Considerations

1. **Lazy loading** - Don't load full log files until requested
2. **Virtual scrolling** - For large log files and long story lists
3. **Debounced updates** - Batch rapid file changes
4. **Incremental parsing** - For activity logs, only parse new lines
5. **Caching** - Cache parsed PRD data, invalidate on change
6. **Pagination** - For runs and logs endpoints

---

## Future Enhancements (Post-MVP)

1. **Notifications** - Desktop notifications for story completion/failures
2. **Export** - Export run reports as PDF/HTML
3. **Compare** - Compare metrics across projects
4. **Remote projects** - SSH/remote file system support
5. **Themes** - Custom theme support
6. **Plugins** - Extension system for custom visualizations
7. **Mobile app** - React Native companion app
8. **Slack/Discord integration** - Webhooks for status updates

---

## Dependencies to Add

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.16.0",
    "chokidar": "^3.5.3",
    "cors": "^2.8.5",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/ws": "^8.5.10",
    "@types/cors": "^2.8.17",
    "@types/uuid": "^9.0.7"
  }
}
```

Frontend (in dashboard/client/package.json):
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "zustand": "^4.4.7",
    "react-markdown": "^9.0.1",
    "recharts": "^2.10.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "lucide-react": "^0.303.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "date-fns": "^3.1.0"
  },
  "devDependencies": {
    "vite": "^5.0.10",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.33"
  }
}
```

---

## Summary

This dashboard will provide Ralph users with:

1. **Multi-project visibility** - Monitor multiple concurrent Ralph sessions
2. **Real-time updates** - Live progress tracking via WebSocket
3. **Story management** - Visual kanban board for story status
4. **Run history** - Complete audit trail of all iterations
5. **Log access** - Searchable, filterable log viewer
6. **Metrics** - Performance insights and success rates
7. **Documentation** - Easy access to progress and guardrails

The implementation prioritizes a clean, responsive UI with real-time updates, making it easy to monitor long-running autonomous coding sessions across multiple projects.
