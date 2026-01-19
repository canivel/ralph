# Ralph

![Ralph](ralph.webp)

Ralph is a minimal, file‑based agent loop for autonomous coding. Each iteration starts fresh, reads the same on‑disk state, and commits work for one story at a time.

> **Note:** This is a fork of [@iannuttall/ralph](https://github.com/iannuttall/ralph) with improved agent support and first-run configuration.

## What's New in This Fork

- **First-run agent selection** - Prompted to choose your default agent on first use
- **`ralph config` command** - Reconfigure your default agent anytime
- **Improved Claude support** - Direct spawning with proper TTY handling for PRD generation
- **Better Windows compatibility** - Fixed shell quoting issues
- **Global config storage** - Settings persist in `~/.ralph/config.json`

## How it works

Ralph treats **files and git** as memory, not the model context:

- **PRD (JSON)** defines stories, gates, and status
- **Loop** executes one story per iteration
- **State** persists in `.ralph/`

![Ralph architecture](diagram.svg)

## Installation

### From npm (recommended)

```bash
npm i -g @canivel/ralph
```

### From source (development)

```bash
git clone https://github.com/canivel/ralph.git
cd ralph
npm install
npm link
```

## Quick Start

```bash
ralph prd      # Generate a PRD (first run prompts for agent selection)
ralph build 1  # Run one build iteration
```

On first run, you'll be prompted to select your default agent:

```
Ralph Configuration
? Select your default agent
> claude (Anthropic Claude CLI)
  codex (OpenAI Codex CLI)
  droid (Factory Droid CLI)
  opencode (OpenCode CLI)
```

## Commands

```
ralph install [--skills] [--force]   Copy .agents/ralph into the current repo
ralph prd ["<request>"] [--out path] Generate a PRD (JSON) via agent
ralph build [n] [--no-commit]        Run build loop (default)
ralph overview                       Render a human overview from PRD JSON
ralph config                         Configure default agent
ralph ping                           Minimal agent health check
ralph log "<message>"                Append to .ralph/activity.log
ralph help                           Show help message
```

### Options

```
--prd <path>                         Override PRD path
--out <path>                         Override PRD output path (prd command)
--progress <path>                    Override progress log path
--agent <codex|claude|droid|opencode> Override agent runner
```

## Template hierarchy

Ralph will look for templates in this order:

1. `.agents/ralph/` in the current project (if present)
2. Bundled defaults shipped with this repo

State and logs always go to `.ralph/` in the project.

### Install templates into a project (optional overrides)

```bash
ralph install
```

This creates `.agents/ralph/` in the current repo so you can customize prompts and loop behavior. During install, you'll be asked if you want to add the required skills.

### Install required skills (optional)

```bash
ralph install --skills
```

You'll be prompted for agent (codex/claude/droid/opencode) and local vs global install. Skills installed: **commit**, **dev-browser**, **prd**.
If you skipped skills during `ralph install`, you can run `ralph install --skills` anytime.

## PRD Generation

Create your PRD (JSON) or generate one:
```bash
ralph prd
```
Requires the **prd** skill (install via `ralph install --skills`).

Example prompt text:
```
A lightweight uptime monitor (Hono app), deployed on Cloudflare, with email alerts via AWS SES
```

Default output (agent chooses a short filename in `.agents/tasks/`):
```
.agents/tasks/prd-<short>.json
```

Override PRD output:
```bash
ralph prd --out .agents/tasks/prd-api.json
```

Optional human overview (generated from JSON):
```bash
ralph overview
```
This writes a tiny overview alongside the PRD: `prd-<slug>.overview.md`.

## Build Loop

Run one build iteration:
```bash
ralph build 1
```

No‑commit dry run:
```bash
ralph build 1 --no-commit
```

PRD story status fields are updated automatically by the loop:
- `open` → selectable
- `in_progress` → locked by a running loop (with `startedAt`)
- `done` → completed (with `completedAt`)

If a loop crashes and a story stays `in_progress`, you can set `STALE_SECONDS` in `.agents/ralph/config.sh` to allow Ralph to automatically reopen stalled stories.

## Override PRD paths

You can point Ralph at a different PRD JSON file via CLI flags:

```bash
ralph build 1 --prd .agents/tasks/prd-api.json
```

Optional progress override:

```bash
ralph build 1 --progress .ralph/progress-api.md
```

If multiple PRD JSON files exist in `.agents/tasks/` and you omit `--prd`, Ralph will prompt you to choose.

Optional config file (if you installed templates):

```
.agents/ralph/config.sh
```

## Choose the agent runner

On first run, Ralph will prompt you to select your default agent. To change it later:

```bash
ralph config
```

Or set `AGENT_CMD` in `.agents/ralph/config.sh` to switch agents:

```
AGENT_CMD="codex exec --yolo -"
AGENT_CMD="claude -p --dangerously-skip-permissions \"\$(cat {prompt})\""
AGENT_CMD="droid exec --skip-permissions-unsafe -f {prompt}"
AGENT_CMD="opencode run \"$(cat {prompt})\""
```

Or override per run:

```bash
ralph prd --agent=codex
ralph build 1 --agent=codex
ralph build 1 --agent=claude
ralph build 1 --agent=droid
ralph build 1 --agent=opencode
```

If the CLI isn't installed, Ralph prints install hints:

```
codex    -> npm i -g @openai/codex
claude   -> curl -fsSL https://claude.ai/install.sh | bash
droid    -> curl -fsSL https://app.factory.ai/cli | sh
opencode -> curl -fsSL https://opencode.ai/install.sh | bash
```

## Configuration

Ralph stores global configuration in `~/.ralph/config.json`:

```json
{
  "defaultAgent": "claude",
  "configuredAt": "2025-01-19T12:00:00.000Z"
}
```

To reconfigure:
```bash
ralph config
```

## State files (.ralph/)

- `progress.md` — append‑only progress log
- `guardrails.md` — "Signs" (lessons learned)
- `activity.log` — activity + timing log
- `errors.log` — repeated failures and notes
- `runs/` — raw run logs + summaries

## Notes

- `.agents/ralph` is portable and can be copied between repos.
- `.ralph` is per‑project state.
- Use `{prompt}` in `AGENT_CMD` when agent needs a file path instead of stdin.
- Examples: see `examples/commands.md`.
- **OpenCode server mode**: For faster performance with OpenCode, run `opencode serve` in a separate terminal and uncomment the `AGENT_OPENCODE_CMD` lines in `.agents/ralph/agents.sh` to use `--attach http://localhost:4096`. This avoids cold boot on every run.

## Tests

Dry-run smoke tests (no agent required):

```bash
npm test
```

Fast agent health check (real agent call, minimal output):

```bash
npm run test:ping
```

Optional integration test (requires agents installed):

```bash
RALPH_INTEGRATION=1 npm test
```

Full real-agent loop test:

```bash
npm run test:real
```

## Publishing to npm

To publish this package:

```bash
npm login
npm publish --access public
```

## License

MIT
