# Ralph

![Ralph](ralph.webp)

Ralph is a minimal, file-based agent loop for autonomous coding. Each iteration starts fresh, reads the same on-disk state, and commits work for one story at a time.

> **Fork Note:** This is a fork of [@iannuttall/ralph](https://github.com/iannuttall/ralph) with improved agent support and first-run configuration.

## What's New in This Fork

- **First-run agent selection** - Prompted to choose your default agent on first use
- **`ralph config` command** - Reconfigure your default agent anytime
- **Improved Claude support** - Uses stdin mode (`-p -`) for reliable prompt passing
- **Better Windows compatibility** - Fixed shell quoting and Python detection
- **Global config storage** - Settings persist in `~/.ralph/config.json`

## How It Works

Ralph treats **files and git** as memory, not the model context:

- **PRD (JSON)** - Defines stories, quality gates, and status
- **Loop** - Executes one story per iteration
- **State** - Persists in `.ralph/` directory

![Ralph architecture](diagram.svg)

## Installation

### From npm (recommended)

```bash
npm i -g @canivel/ralph
```

### From source

```bash
git clone https://github.com/canivel/ralph.git
cd ralph
npm install
npm link
```

### Prerequisites

You need at least one AI agent CLI installed:

| Agent | Install Command |
|-------|-----------------|
| Claude | `curl -fsSL https://claude.ai/install.sh \| bash` |
| Codex | `npm i -g @openai/codex` |
| Droid | `curl -fsSL https://app.factory.ai/cli \| sh` |
| OpenCode | `curl -fsSL https://opencode.ai/install.sh \| bash` |

## Quick Start

```bash
# 1. Navigate to your project
cd my-project

# 2. Generate a PRD (first run prompts for agent selection)
ralph prd "A task management app with projects and due dates"

# 3. Build one story at a time
ralph build 1
```

On first run, you'll see the agent selection prompt:

```
Ralph Configuration
? Select your default agent
> claude (Anthropic Claude CLI)
  codex (OpenAI Codex CLI)
  droid (Factory Droid CLI)
  opencode (OpenCode CLI)
```

## Commands

| Command | Description |
|---------|-------------|
| `ralph prd ["<request>"]` | Generate a PRD JSON file via agent |
| `ralph build [n]` | Run n build iterations (default: continuous) |
| `ralph config` | Configure or change default agent |
| `ralph install` | Copy templates to current repo for customization |
| `ralph install --skills` | Install required skills (commit, dev-browser, prd) |
| `ralph overview` | Generate human-readable overview from PRD |
| `ralph ping` | Health check for agent connectivity |
| `ralph log "<message>"` | Append to activity log |
| `ralph help` | Show help message |

### Options

| Option | Description |
|--------|-------------|
| `--agent <name>` | Override agent (codex, claude, droid, opencode) |
| `--prd <path>` | Override PRD file path |
| `--out <path>` | Override PRD output path (for `prd` command) |
| `--progress <path>` | Override progress log path |
| `--no-commit` | Dry run without committing (for `build` command) |
| `--force` | Force overwrite (for `install` command) |

## Usage Examples

### Generate a PRD

```bash
# Interactive mode - prompts for description
ralph prd

# Direct mode - pass description as argument
ralph prd "A REST API for user authentication with JWT tokens"

# Specify output path
ralph prd --out .agents/tasks/prd-auth.json "Auth API"
```

### Build Stories

```bash
# Build one story
ralph build 1

# Build 5 stories
ralph build 5

# Dry run (no commits)
ralph build 1 --no-commit

# Use specific PRD file
ralph build 1 --prd .agents/tasks/prd-auth.json

# Override agent for this run
ralph build 1 --agent codex
```

### Configuration

```bash
# Change default agent
ralph config

# Install templates for customization
ralph install

# Install skills (commit, dev-browser, prd)
ralph install --skills
```

## Configuration

### Global Config

Ralph stores global settings in `~/.ralph/config.json`:

```json
{
  "defaultAgent": "claude",
  "configuredAt": "2026-01-19T12:00:00.000Z"
}
```

To change your default agent:

```bash
ralph config
```

### Project Config

After running `ralph install`, you can customize behavior in `.agents/ralph/config.sh`:

```bash
# Override agent command (Claude uses stdin mode by default)
# AGENT_CMD="claude --dangerously-skip-permissions -p -"

# Build settings
NO_COMMIT=false
MAX_ITERATIONS=25
STALE_SECONDS=0
```

## Template Hierarchy

Ralph looks for templates in this order:

1. `.agents/ralph/` in current project (if present)
2. Bundled defaults from the package

State and logs always go to `.ralph/` in the project.

## PRD Story Status

The build loop automatically updates story status:

| Status | Meaning |
|--------|---------|
| `open` | Available for selection |
| `in_progress` | Currently being worked on (with `startedAt`) |
| `done` | Completed (with `completedAt`) |

If a loop crashes while a story is `in_progress`, set `STALE_SECONDS` in config to auto-reopen stalled stories.

## State Files

All state is stored in `.ralph/` in your project:

| File | Purpose |
|------|---------|
| `progress.md` | Append-only progress log |
| `guardrails.md` | Lessons learned ("Signs") |
| `activity.log` | Activity and timing log |
| `errors.log` | Repeated failures and notes |
| `runs/` | Raw run logs and summaries |

## Advanced

### Multiple PRD Files

If you have multiple PRD JSON files in `.agents/tasks/` and don't specify `--prd`, Ralph will prompt you to choose.

### OpenCode Server Mode

For faster performance with OpenCode, run `opencode serve` in a separate terminal and uncomment the server mode lines in `.agents/ralph/agents.sh`:

```bash
AGENT_OPENCODE_CMD="opencode run --attach http://localhost:4096 \"\$(cat {prompt})\""
```

### Custom Agent Commands

Agents are passed prompts via stdin by default. Use `{prompt}` placeholder when the agent needs a file path instead:

```bash
# Stdin mode (default for claude, codex)
AGENT_CMD="my-agent -"

# File path mode (for agents that require a file)
AGENT_CMD="my-agent --file {prompt}"
```

## Development

### Running Tests

```bash
# Dry-run smoke tests (no agent required)
npm test

# Fast agent health check
npm run test:ping

# Integration tests (requires agents)
RALPH_INTEGRATION=1 npm test

# Full real-agent loop test
npm run test:real
```

### Publishing

```bash
npm login
npm publish --access public
```

## License

MIT
