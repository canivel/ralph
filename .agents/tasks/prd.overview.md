# PRD Overview: Ralph Dashboard

- File: .agents\tasks\prd.json
- Stories: 23 total (17 open, 1 in_progress, 5 done)

## Quality Gates
- npm run typecheck
- npm run lint
- npm test -- --run

## Stories
- [done] US-001: Project structure and dependencies setup
- [done] US-002: Express server with basic routing (depends on: US-001)
- [done] US-003: Data parsers for Ralph files (depends on: US-001)
- [done] US-004: Project manager service (depends on: US-001)
- [done] US-005: File watcher service with chokidar (depends on: US-004)
- [in_progress] US-006: WebSocket server for real-time updates (depends on: US-005)
- [open] US-007: REST API endpoints for projects (depends on: US-003, US-004)
- [open] US-008: REST API endpoints for runs and logs (depends on: US-003, US-007)
- [open] US-009: CLI command: ralph dashboard (depends on: US-002, US-006, US-007, US-008)
- [open] US-010: Frontend: Vite React app shell (depends on: US-001)
- [open] US-011: Frontend: Zustand store and WebSocket hook (depends on: US-010)
- [open] US-012: Frontend: API client and data fetching (depends on: US-011)
- [open] US-013: Frontend: Projects list view (depends on: US-012)
- [open] US-014: Frontend: Project detail layout with tabs (depends on: US-013)
- [open] US-015: Frontend: Overview tab (depends on: US-014)
- [open] US-016: Frontend: Stories kanban board (depends on: US-014)
- [open] US-017: Frontend: Runs timeline (depends on: US-014)
- [open] US-018: Frontend: Logs viewer (depends on: US-014)
- [open] US-019: Frontend: Progress and Guardrails tabs (depends on: US-014)
- [open] US-020: Frontend: Metrics panel (depends on: US-015)
- [open] US-021: Build system for production bundle (depends on: US-009, US-010)
- [open] US-022: Polish: Error handling and loading states (depends on: US-013, US-014, US-015, US-016, US-017, US-018, US-019, US-020)
- [open] US-023: Testing and documentation (depends on: US-021, US-022)
