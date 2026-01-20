/**
 * Unit tests for dashboard data parsers
 * Tests parsePrd, parseActivityLog, parseErrorsLog, parseRunMeta, parseProgressMd, parseGuardrailsMd
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve path for MINGW compatibility
function resolveRepoRoot() {
  const rawPath = new URL("..", import.meta.url).pathname;
  // On MINGW/Windows, pathname may start with /C:/ - remove leading slash
  if (/^\/[A-Z]:/.test(rawPath)) {
    return rawPath.slice(1);
  }
  return rawPath;
}

const repoRoot = path.resolve(resolveRepoRoot());
const parserPath = path.join(repoRoot, "dashboard", "server", "dist", "services", "dataParser.js");

let parsers;
try {
  parsers = await import(`file://${parserPath}`);
} catch (err) {
  console.error(`Failed to import dataParser.js from ${parserPath}`);
  console.error("Run 'npm run build:dashboard:server' first.");
  process.exit(1);
}

const {
  parsePrd,
  parseActivityLog,
  parseErrorsLog,
  parseRunMeta,
  parseProgressMd,
  parseGuardrailsMd,
} = parsers;

let testDir;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}

function assertEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    console.error(`FAIL: ${message}`);
    console.error(`  Expected: ${expectedStr}`);
    console.error(`  Actual:   ${actualStr}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}

function setup() {
  testDir = mkdtempSync(path.join(tmpdir(), "ralph-parser-test-"));
}

function cleanup() {
  if (testDir) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

// ============================================================================
// parsePrd tests
// ============================================================================

async function testParsePrd_ValidPRD() {
  const prdFile = path.join(testDir, "prd.json");
  const prd = {
    version: 1,
    project: "Test Project",
    overview: "A test project",
    goals: ["Goal 1", "Goal 2"],
    nonGoals: ["Non-goal 1"],
    stack: { backend: "Node.js", frontend: "React" },
    qualityGates: ["npm test", "npm run lint"],
    stories: [
      {
        id: "US-001",
        title: "First Story",
        description: "Description of first story",
        acceptanceCriteria: ["AC 1", "AC 2"],
        dependsOn: [],
        status: "open",
      },
      {
        id: "US-002",
        title: "Second Story",
        description: "Description of second story",
        acceptanceCriteria: ["AC 1"],
        dependsOn: ["US-001"],
        status: "done",
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
  };
  writeFileSync(prdFile, JSON.stringify(prd));

  const result = await parsePrd(prdFile);
  assert(result !== null, "parsePrd returns non-null for valid PRD");
  assertEqual(result.version, 1, "parsePrd extracts version");
  assertEqual(result.project, "Test Project", "parsePrd extracts project");
  assertEqual(result.goals.length, 2, "parsePrd extracts goals");
  assertEqual(result.stories.length, 2, "parsePrd extracts stories");
  assertEqual(result.stories[0].status, "open", "parsePrd extracts story status");
  assertEqual(result.stories[1].status, "done", "parsePrd extracts done status");
}

async function testParsePrd_MissingFile() {
  const result = await parsePrd(path.join(testDir, "nonexistent.json"));
  assertEqual(result, null, "parsePrd returns null for missing file");
}

async function testParsePrd_InvalidJSON() {
  const badFile = path.join(testDir, "bad.json");
  writeFileSync(badFile, "{ invalid json }");
  const result = await parsePrd(badFile);
  assertEqual(result, null, "parsePrd returns null for invalid JSON");
}

async function testParsePrd_MissingRequiredFields() {
  const badFile = path.join(testDir, "incomplete.json");
  writeFileSync(badFile, JSON.stringify({ project: "Test" }));
  const result = await parsePrd(badFile);
  assertEqual(result, null, "parsePrd returns null for missing required fields");
}

// ============================================================================
// parseActivityLog tests
// ============================================================================

async function testParseActivityLog_ValidLog() {
  const logFile = path.join(testDir, "activity.log");
  const content = `[2026-01-19 20:14:59] ITERATION 1 start (mode=build story=US-001)
[2026-01-19 20:15:30] Some other event
[2026-01-19 20:20:41] ITERATION 1 end (duration=343s)
`;
  writeFileSync(logFile, content);

  const events = await parseActivityLog(logFile);
  assertEqual(events.length, 3, "parseActivityLog returns correct number of events");
  assertEqual(events[0].type, "iteration_start", "parseActivityLog identifies iteration_start");
  assertEqual(events[1].type, "other", "parseActivityLog identifies other events");
  assertEqual(events[2].type, "iteration_end", "parseActivityLog identifies iteration_end");
  assert(events[0].timestamp.includes("2026-01-19"), "parseActivityLog extracts timestamp");
}

async function testParseActivityLog_MissingFile() {
  const events = await parseActivityLog(path.join(testDir, "nonexistent.log"));
  assertEqual(events.length, 0, "parseActivityLog returns empty array for missing file");
}

async function testParseActivityLog_EmptyFile() {
  const logFile = path.join(testDir, "empty.log");
  writeFileSync(logFile, "");
  const events = await parseActivityLog(logFile);
  assertEqual(events.length, 0, "parseActivityLog returns empty array for empty file");
}

// ============================================================================
// parseErrorsLog tests
// ============================================================================

async function testParseErrorsLog_ValidLog() {
  const logFile = path.join(testDir, "errors.log");
  const content = `[2026-01-19 20:15:00] PRE-EXISTING: npm test fails
[2026-01-19 20:46:27] ITERATION 3 left uncommitted changes
`;
  writeFileSync(logFile, content);

  const errors = await parseErrorsLog(logFile);
  assertEqual(errors.length, 2, "parseErrorsLog returns correct number of errors");
  assert(errors[0].message.includes("PRE-EXISTING"), "parseErrorsLog extracts message");
  assertEqual(errors[1].iteration, 3, "parseErrorsLog extracts iteration number");
}

async function testParseErrorsLog_MissingFile() {
  const errors = await parseErrorsLog(path.join(testDir, "nonexistent.log"));
  assertEqual(errors.length, 0, "parseErrorsLog returns empty array for missing file");
}

// ============================================================================
// parseRunMeta tests
// ============================================================================

async function testParseRunMeta_ValidFile() {
  const runFile = path.join(testDir, "run-20260119-201458-iter-1.md");
  const content = `# Ralph Run Summary

- Run ID: 20260119-201458-41469
- Iteration: 1
- Mode: build
- Story: US-002: Express server with basic routing
- Started: 2026-01-19 20:14:58
- Ended: 2026-01-19 20:20:41
- Duration: 343s
- Status: success

### Commits
- abc1234 feat: add something
- def5678 fix: something else

### Changed Files (commits)
- file1.ts
- file2.ts
`;
  writeFileSync(runFile, content);

  const meta = await parseRunMeta(runFile);
  assert(meta !== null, "parseRunMeta returns non-null for valid file");
  assertEqual(meta.runId, "20260119-201458-41469", "parseRunMeta extracts runId");
  assertEqual(meta.iteration, 1, "parseRunMeta extracts iteration");
  assertEqual(meta.storyId, "US-002", "parseRunMeta extracts storyId");
  assertEqual(meta.storyTitle, "Express server with basic routing", "parseRunMeta extracts storyTitle");
  assertEqual(meta.duration, 343, "parseRunMeta extracts duration");
  assertEqual(meta.status, "success", "parseRunMeta extracts status");
  assertEqual(meta.commits.length, 2, "parseRunMeta extracts commits");
  assertEqual(meta.changedFiles.length, 2, "parseRunMeta extracts changedFiles");
}

async function testParseRunMeta_MissingFile() {
  const meta = await parseRunMeta(path.join(testDir, "nonexistent.md"));
  assertEqual(meta, null, "parseRunMeta returns null for missing file");
}

async function testParseRunMeta_InvalidFormat() {
  const runFile = path.join(testDir, "invalid-run.md");
  writeFileSync(runFile, "# Some random content without run metadata");
  const meta = await parseRunMeta(runFile);
  assertEqual(meta, null, "parseRunMeta returns null for invalid format");
}

// ============================================================================
// parseProgressMd tests
// ============================================================================

async function testParseProgressMd_ValidFile() {
  const progressFile = path.join(testDir, "progress.md");
  const content = `# Progress Log

## Codebase Patterns
- **Windows/MINGW64**: Set IS_WSL="" to avoid npm path issues
- **shadcn/ui theming**: Requires specific Tailwind config

---

## Recent Stories

### US-001: Project setup
- Commit: abc1234 feat: initial setup
- Key files: package.json, src/

### US-002: Add API
- Commit: def5678 feat: add API
- Key files: src/api/
`;
  writeFileSync(progressFile, content);

  const progress = await parseProgressMd(progressFile);
  assert(progress.content.length > 0, "parseProgressMd extracts content");
  assert(progress.patterns.length >= 2, "parseProgressMd extracts patterns");
  assertEqual(progress.stories.length, 2, "parseProgressMd extracts stories");
  assertEqual(progress.stories[0].id, "US-001", "parseProgressMd extracts story ID");
  assertEqual(progress.stories[0].title, "Project setup", "parseProgressMd extracts story title");
}

async function testParseProgressMd_MissingFile() {
  const progress = await parseProgressMd(path.join(testDir, "nonexistent.md"));
  assertEqual(progress.content, "", "parseProgressMd returns empty content for missing file");
  assertEqual(progress.patterns.length, 0, "parseProgressMd returns empty patterns for missing file");
  assertEqual(progress.stories.length, 0, "parseProgressMd returns empty stories for missing file");
}

// ============================================================================
// parseGuardrailsMd tests
// ============================================================================

async function testParseGuardrailsMd_ValidFile() {
  const guardrailsFile = path.join(testDir, "guardrails.md");
  const content = `# Guardrails

### Sign: Always run tests
- What went wrong: Tests were skipped
- Why: Forgot to run npm test
- Fix: Add test step to checklist

### Sign: Check TypeScript errors
- What went wrong: TS errors in production
- Why: Ignored type errors
- Fix: Run tsc before commit
`;
  writeFileSync(guardrailsFile, content);

  const guardrails = await parseGuardrailsMd(guardrailsFile);
  assert(guardrails.content.length > 0, "parseGuardrailsMd extracts content");
  assertEqual(guardrails.signs.length, 2, "parseGuardrailsMd extracts signs");
  assertEqual(guardrails.signs[0].title, "Always run tests", "parseGuardrailsMd extracts sign title");
  assert(guardrails.signs[0].description.includes("Tests were skipped"), "parseGuardrailsMd extracts sign description");
}

async function testParseGuardrailsMd_MissingFile() {
  const guardrails = await parseGuardrailsMd(path.join(testDir, "nonexistent.md"));
  assertEqual(guardrails.content, "", "parseGuardrailsMd returns empty content for missing file");
  assertEqual(guardrails.signs.length, 0, "parseGuardrailsMd returns empty signs for missing file");
}

// ============================================================================
// Run all tests
// ============================================================================

async function runTests() {
  console.log("=== Dashboard Parser Tests ===\n");

  setup();

  try {
    // parsePrd tests
    console.log("\n--- parsePrd tests ---");
    await testParsePrd_ValidPRD();
    await testParsePrd_MissingFile();
    await testParsePrd_InvalidJSON();
    await testParsePrd_MissingRequiredFields();

    // parseActivityLog tests
    console.log("\n--- parseActivityLog tests ---");
    await testParseActivityLog_ValidLog();
    await testParseActivityLog_MissingFile();
    await testParseActivityLog_EmptyFile();

    // parseErrorsLog tests
    console.log("\n--- parseErrorsLog tests ---");
    await testParseErrorsLog_ValidLog();
    await testParseErrorsLog_MissingFile();

    // parseRunMeta tests
    console.log("\n--- parseRunMeta tests ---");
    await testParseRunMeta_ValidFile();
    await testParseRunMeta_MissingFile();
    await testParseRunMeta_InvalidFormat();

    // parseProgressMd tests
    console.log("\n--- parseProgressMd tests ---");
    await testParseProgressMd_ValidFile();
    await testParseProgressMd_MissingFile();

    // parseGuardrailsMd tests
    console.log("\n--- parseGuardrailsMd tests ---");
    await testParseGuardrailsMd_ValidFile();
    await testParseGuardrailsMd_MissingFile();

    console.log("\n=== Results ===");
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    cleanup();
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  cleanup();
  process.exit(1);
});
