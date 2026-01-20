/**
 * Integration tests for dashboard API endpoints
 * Tests /api/health, /api/projects, /api/projects/:id, /api/projects/:id/runs, /api/projects/:id/logs
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import http from "node:http";

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
const serverPath = path.join(repoRoot, "dashboard", "server", "dist", "index.js");
const projectManagerPath = path.join(repoRoot, "dashboard", "server", "dist", "services", "projectManager.js");

let server;
let serverModule;
let projectManager;
let testPort = 14242; // Use different port to avoid conflicts
let testDir;
let originalConfigPath;
let backupConfig = null;
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

/**
 * Make an HTTP request to the test server
 */
function httpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: testPort,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, body: json, raw: data });
        } catch {
          resolve({ status: res.statusCode, body: null, raw: data });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function setup() {
  testDir = mkdtempSync(path.join(tmpdir(), "ralph-api-test-"));

  // Backup existing dashboard.json config if it exists
  const configPath = path.join(homedir(), ".ralph", "dashboard.json");
  originalConfigPath = configPath;
  if (existsSync(configPath)) {
    backupConfig = readFileSync(configPath, "utf-8");
  }

  // Clear the config file for clean tests
  if (existsSync(configPath)) {
    rmSync(configPath);
  }
}

function cleanup() {
  if (testDir) {
    rmSync(testDir, { recursive: true, force: true });
  }

  // Restore original config
  if (backupConfig !== null) {
    mkdirSync(path.dirname(originalConfigPath), { recursive: true });
    writeFileSync(originalConfigPath, backupConfig);
  } else if (existsSync(originalConfigPath)) {
    rmSync(originalConfigPath);
  }
}

/**
 * Create a valid Ralph project directory structure
 */
function createValidProject(name) {
  const projectPath = path.join(testDir, name);
  mkdirSync(projectPath, { recursive: true });
  mkdirSync(path.join(projectPath, ".ralph", "runs"), { recursive: true });
  mkdirSync(path.join(projectPath, ".agents", "tasks"), { recursive: true });

  // Create PRD
  writeFileSync(
    path.join(projectPath, ".agents", "tasks", "prd.json"),
    JSON.stringify({
      version: 1,
      project: name,
      overview: "Test project",
      goals: ["Goal 1"],
      nonGoals: [],
      stack: {},
      qualityGates: ["npm test"],
      stories: [
        { id: "US-001", title: "Story 1", status: "done", dependsOn: [], acceptanceCriteria: [] },
        { id: "US-002", title: "Story 2", status: "open", dependsOn: ["US-001"], acceptanceCriteria: [] },
      ],
    })
  );

  // Create activity log
  writeFileSync(
    path.join(projectPath, ".ralph", "activity.log"),
    `[2026-01-19 20:14:59] ITERATION 1 start (mode=build story=US-001)
[2026-01-19 20:20:41] ITERATION 1 end (duration=343s)
`
  );

  // Create errors log
  writeFileSync(
    path.join(projectPath, ".ralph", "errors.log"),
    `[2026-01-19 20:15:00] PRE-EXISTING: npm test fails
`
  );

  // Create progress.md
  writeFileSync(
    path.join(projectPath, ".ralph", "progress.md"),
    `# Progress Log

## Codebase Patterns
- Pattern: Test pattern

## Recent Stories

### US-001: Story 1
- Commit: abc1234 feat: initial
`
  );

  // Create guardrails.md
  writeFileSync(
    path.join(projectPath, ".ralph", "guardrails.md"),
    `# Guardrails

### Sign: Test Sign
- Description: Test description
`
  );

  // Create a run summary
  writeFileSync(
    path.join(projectPath, ".ralph", "runs", "run-20260119-201458-41469-iter-1.md"),
    `# Ralph Run Summary

- Run ID: 20260119-201458-41469
- Iteration: 1
- Story: US-001: Story 1
- Duration: 343s
- Status: success
`
  );

  // Create a run log
  writeFileSync(
    path.join(projectPath, ".ralph", "runs", "run-20260119-201458-41469-iter-1.log"),
    `This is a test log file for the run.
Line 2 of the log.
Line 3 of the log.
`
  );

  return projectPath;
}

// ============================================================================
// Health endpoint tests
// ============================================================================

async function testHealthEndpoint() {
  const res = await httpRequest("GET", "/api/health");
  assertEqual(res.status, 200, "GET /api/health returns 200");
  assertEqual(res.body.status, "ok", "Health endpoint returns { status: 'ok' }");
}

// ============================================================================
// Projects endpoint tests
// ============================================================================

async function testListProjects_Empty() {
  const res = await httpRequest("GET", "/api/projects");
  assertEqual(res.status, 200, "GET /api/projects returns 200");
  assert(Array.isArray(res.body), "GET /api/projects returns array");
}

async function testRegisterProject_Success() {
  const projectPath = createValidProject("api-test-project");
  const res = await httpRequest("POST", "/api/projects", {
    path: projectPath,
    name: "API Test Project",
  });

  assertEqual(res.status, 201, "POST /api/projects returns 201 on success");
  assertEqual(res.body.name, "API Test Project", "Registered project has correct name");
  assert(res.body.id !== undefined, "Registered project has ID");
  assert(res.body.storyCount !== undefined, "Registered project has storyCount");
}

async function testRegisterProject_MissingPath() {
  const res = await httpRequest("POST", "/api/projects", { name: "No Path" });
  assertEqual(res.status, 400, "POST /api/projects returns 400 for missing path");
}

async function testRegisterProject_InvalidPath() {
  const res = await httpRequest("POST", "/api/projects", {
    path: path.join(testDir, "nonexistent"),
  });
  assertEqual(res.status, 400, "POST /api/projects returns 400 for invalid path");
}

async function testGetProject_Success() {
  // First register a project
  const projectPath = createValidProject("get-project-test");
  const registerRes = await httpRequest("POST", "/api/projects", {
    path: projectPath,
    name: "Get Project Test",
  });
  const projectId = registerRes.body.id;

  // Then get it
  const res = await httpRequest("GET", `/api/projects/${projectId}`);
  assertEqual(res.status, 200, "GET /api/projects/:id returns 200");
  assertEqual(res.body.name, "Get Project Test", "GET /api/projects/:id returns correct project");
  assert(res.body.prd !== undefined, "GET /api/projects/:id includes PRD");
  assertEqual(res.body.storyCount, 2, "GET /api/projects/:id has correct storyCount");
  assertEqual(res.body.doneCount, 1, "GET /api/projects/:id has correct doneCount");
}

async function testGetProject_NotFound() {
  const res = await httpRequest("GET", "/api/projects/nonexistent-id");
  assertEqual(res.status, 404, "GET /api/projects/:id returns 404 for unknown ID");
}

async function testDeleteProject_Success() {
  // First register a project
  const projectPath = createValidProject("delete-project-test");
  const registerRes = await httpRequest("POST", "/api/projects", {
    path: projectPath,
    name: "Delete Project Test",
  });
  const projectId = registerRes.body.id;

  // Then delete it
  const res = await httpRequest("DELETE", `/api/projects/${projectId}`);
  assertEqual(res.status, 204, "DELETE /api/projects/:id returns 204");

  // Verify it's gone
  const getRes = await httpRequest("GET", `/api/projects/${projectId}`);
  assertEqual(getRes.status, 404, "Deleted project returns 404");
}

async function testDeleteProject_NotFound() {
  const res = await httpRequest("DELETE", "/api/projects/nonexistent-id");
  assertEqual(res.status, 404, "DELETE /api/projects/:id returns 404 for unknown ID");
}

// ============================================================================
// Runs endpoint tests
// ============================================================================

async function testGetRuns_Success() {
  // Register a project with runs
  const projectPath = createValidProject("runs-test-project");
  const registerRes = await httpRequest("POST", "/api/projects", {
    path: projectPath,
    name: "Runs Test Project",
  });
  const projectId = registerRes.body.id;

  // Get runs
  const res = await httpRequest("GET", `/api/projects/${projectId}/runs`);
  assertEqual(res.status, 200, "GET /api/projects/:id/runs returns 200");
  assert(res.body.runs !== undefined, "Response includes runs array");
  assert(res.body.pagination !== undefined, "Response includes pagination");
}

async function testGetRuns_ProjectNotFound() {
  const res = await httpRequest("GET", "/api/projects/nonexistent/runs");
  assertEqual(res.status, 404, "GET /api/projects/:id/runs returns 404 for unknown project");
}

// ============================================================================
// Logs endpoint tests
// ============================================================================

async function testGetActivityLog_Success() {
  // Register a project with logs
  const projectPath = createValidProject("logs-test-project");
  const registerRes = await httpRequest("POST", "/api/projects", {
    path: projectPath,
    name: "Logs Test Project",
  });
  const projectId = registerRes.body.id;

  // Get activity log
  const res = await httpRequest("GET", `/api/projects/${projectId}/logs/activity`);
  assertEqual(res.status, 200, "GET /api/projects/:id/logs/activity returns 200");
  assert(res.body.events !== undefined, "Response includes events array");
  assert(res.body.pagination !== undefined, "Response includes pagination");
}

async function testGetErrorsLog_Success() {
  // Use the previously registered project
  const projects = (await httpRequest("GET", "/api/projects")).body;
  const project = projects.find((p) => p.name === "Logs Test Project");

  if (!project) {
    console.log("SKIP: testGetErrorsLog_Success (project not found)");
    return;
  }

  const res = await httpRequest("GET", `/api/projects/${project.id}/logs/errors`);
  assertEqual(res.status, 200, "GET /api/projects/:id/logs/errors returns 200");
  assert(res.body.errors !== undefined, "Response includes errors array");
}

async function testGetLogs_ProjectNotFound() {
  const res = await httpRequest("GET", "/api/projects/nonexistent/logs/activity");
  assertEqual(res.status, 404, "GET /api/projects/:id/logs/activity returns 404 for unknown project");
}

// ============================================================================
// Progress and Guardrails endpoint tests
// ============================================================================

async function testGetProgress_Success() {
  const projects = (await httpRequest("GET", "/api/projects")).body;
  const project = projects.find((p) => p.name === "Logs Test Project");

  if (!project) {
    console.log("SKIP: testGetProgress_Success (project not found)");
    return;
  }

  const res = await httpRequest("GET", `/api/projects/${project.id}/progress`);
  assertEqual(res.status, 200, "GET /api/projects/:id/progress returns 200");
  assert(res.body.content !== undefined, "Response includes content");
  assert(res.body.patterns !== undefined, "Response includes patterns");
}

async function testGetGuardrails_Success() {
  const projects = (await httpRequest("GET", "/api/projects")).body;
  const project = projects.find((p) => p.name === "Logs Test Project");

  if (!project) {
    console.log("SKIP: testGetGuardrails_Success (project not found)");
    return;
  }

  const res = await httpRequest("GET", `/api/projects/${project.id}/guardrails`);
  assertEqual(res.status, 200, "GET /api/projects/:id/guardrails returns 200");
  assert(res.body.content !== undefined, "Response includes content");
  assert(res.body.signs !== undefined, "Response includes signs");
}

// ============================================================================
// Run all tests
// ============================================================================

async function runTests() {
  console.log("=== Dashboard API Integration Tests ===\n");

  setup();

  // Import server module
  try {
    serverModule = await import(`file://${serverPath}`);
    projectManager = await import(`file://${projectManagerPath}`);
  } catch (err) {
    console.error(`Failed to import server from ${serverPath}`);
    console.error("Run 'npm run build:dashboard:server' first.");
    console.error(err);
    process.exit(1);
  }

  // Start server on test port
  const { server: httpServer } = serverModule;
  await new Promise((resolve, reject) => {
    httpServer.listen(testPort, "localhost", () => {
      console.log(`Test server started on port ${testPort}\n`);
      resolve();
    });
    httpServer.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        testPort++;
        httpServer.listen(testPort, "localhost", () => {
          console.log(`Test server started on port ${testPort}\n`);
          resolve();
        });
      } else {
        reject(err);
      }
    });
  });

  try {
    // Health endpoint tests
    console.log("\n--- Health endpoint tests ---");
    await testHealthEndpoint();

    // Projects endpoint tests
    console.log("\n--- Projects endpoint tests ---");
    await testListProjects_Empty();
    await testRegisterProject_Success();
    await testRegisterProject_MissingPath();
    await testRegisterProject_InvalidPath();
    await testGetProject_Success();
    await testGetProject_NotFound();
    await testDeleteProject_Success();
    await testDeleteProject_NotFound();

    // Runs endpoint tests
    console.log("\n--- Runs endpoint tests ---");
    await testGetRuns_Success();
    await testGetRuns_ProjectNotFound();

    // Logs endpoint tests
    console.log("\n--- Logs endpoint tests ---");
    await testGetActivityLog_Success();
    await testGetErrorsLog_Success();
    await testGetLogs_ProjectNotFound();

    // Progress and Guardrails tests
    console.log("\n--- Progress and Guardrails endpoint tests ---");
    await testGetProgress_Success();
    await testGetGuardrails_Success();

    console.log("\n=== Results ===");
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    // Shutdown server
    if (serverModule.shutdown) {
      serverModule.shutdown();
    }
    cleanup();
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  if (serverModule && serverModule.shutdown) {
    serverModule.shutdown();
  }
  cleanup();
  process.exit(1);
});
