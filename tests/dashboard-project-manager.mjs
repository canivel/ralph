/**
 * Unit tests for dashboard projectManager service
 * Tests registerProject, unregisterProject, listProjects, getProject, isValidRalphProject
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
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
const projectManagerPath = path.join(repoRoot, "dashboard", "server", "dist", "services", "projectManager.js");

let projectManager;
try {
  projectManager = await import(`file://${projectManagerPath}`);
} catch (err) {
  console.error(`Failed to import projectManager.js from ${projectManagerPath}`);
  console.error("Run 'npm run build:dashboard:server' first.");
  process.exit(1);
}

const {
  registerProject,
  unregisterProject,
  listProjects,
  getProject,
  isValidRalphProject,
  getConfigFilePath,
} = projectManager;

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

function setup() {
  testDir = mkdtempSync(path.join(tmpdir(), "ralph-pm-test-"));

  // Backup existing dashboard.json config if it exists
  originalConfigPath = getConfigFilePath();
  if (existsSync(originalConfigPath)) {
    backupConfig = readFileSync(originalConfigPath, "utf-8");
  }

  // Clear the config file for clean tests
  if (existsSync(originalConfigPath)) {
    rmSync(originalConfigPath);
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
  mkdirSync(path.join(projectPath, ".ralph"), { recursive: true });
  mkdirSync(path.join(projectPath, ".agents", "tasks"), { recursive: true });
  writeFileSync(
    path.join(projectPath, ".agents", "tasks", "prd.json"),
    JSON.stringify({ version: 1, project: name, stories: [] })
  );
  return projectPath;
}

/**
 * Create an invalid project (no .ralph directory)
 */
function createInvalidProject(name) {
  const projectPath = path.join(testDir, name);
  mkdirSync(projectPath, { recursive: true });
  return projectPath;
}

// ============================================================================
// isValidRalphProject tests
// ============================================================================

async function testIsValidRalphProject_ValidProject() {
  const projectPath = createValidProject("valid-project");
  const result = isValidRalphProject(projectPath);
  assertEqual(result, true, "isValidRalphProject returns true for valid project");
}

async function testIsValidRalphProject_NoRalphDir() {
  const projectPath = createInvalidProject("no-ralph-dir");
  const result = isValidRalphProject(projectPath);
  assertEqual(result, false, "isValidRalphProject returns false when .ralph/ missing");
}

async function testIsValidRalphProject_NonExistentPath() {
  const result = isValidRalphProject(path.join(testDir, "nonexistent"));
  assertEqual(result, false, "isValidRalphProject returns false for nonexistent path");
}

// ============================================================================
// registerProject tests
// ============================================================================

async function testRegisterProject_ValidProject() {
  const projectPath = createValidProject("register-test");
  const result = await registerProject(projectPath, "Test Project");

  assertEqual(result.success, true, "registerProject succeeds for valid project");
  assert(result.project !== undefined, "registerProject returns project object");
  assertEqual(result.project.name, "Test Project", "registerProject sets project name");
  assertEqual(result.project.path, projectPath, "registerProject sets project path");
  assert(result.project.id !== undefined, "registerProject generates project ID");
  assert(result.project.addedAt !== undefined, "registerProject sets addedAt timestamp");
}

async function testRegisterProject_AutoGenerateName() {
  const projectPath = createValidProject("auto-name-project");
  const result = await registerProject(projectPath);

  assertEqual(result.success, true, "registerProject succeeds without name");
  assertEqual(result.project.name, "auto-name-project", "registerProject auto-generates name from path");
}

async function testRegisterProject_InvalidPath() {
  const result = await registerProject(path.join(testDir, "nonexistent"));

  assertEqual(result.success, false, "registerProject fails for nonexistent path");
  assert(result.error.includes("does not exist"), "registerProject returns appropriate error");
}

async function testRegisterProject_NoRalphDir() {
  const projectPath = createInvalidProject("no-ralph-project");
  const result = await registerProject(projectPath);

  assertEqual(result.success, false, "registerProject fails when .ralph/ missing");
  assert(result.error.includes(".ralph/"), "registerProject returns error about missing .ralph");
}

async function testRegisterProject_DuplicatePath() {
  const projectPath = createValidProject("duplicate-test");

  // First registration should succeed
  const result1 = await registerProject(projectPath, "First");
  assertEqual(result1.success, true, "First registration succeeds");

  // Second registration of same path should fail
  const result2 = await registerProject(projectPath, "Second");
  assertEqual(result2.success, false, "Duplicate registration fails");
  assert(result2.error.includes("already registered"), "registerProject returns duplicate error");
}

// ============================================================================
// listProjects tests
// ============================================================================

async function testListProjects_Empty() {
  // Config was cleared in setup, so list should be empty
  // But we may have registered projects in previous tests
  // This test runs after clearing config
  const projects = await listProjects();
  assert(Array.isArray(projects), "listProjects returns an array");
}

async function testListProjects_WithProjects() {
  const projectPath1 = createValidProject("list-test-1");
  const projectPath2 = createValidProject("list-test-2");

  await registerProject(projectPath1, "Project 1");
  await registerProject(projectPath2, "Project 2");

  const projects = await listProjects();

  assert(projects.length >= 2, "listProjects returns at least 2 projects");
  const projectNames = projects.map(p => p.name);
  assert(projectNames.includes("Project 1"), "listProjects includes Project 1");
  assert(projectNames.includes("Project 2"), "listProjects includes Project 2");
}

// ============================================================================
// getProject tests
// ============================================================================

async function testGetProject_Exists() {
  const projectPath = createValidProject("get-test");
  const registerResult = await registerProject(projectPath, "Get Test Project");
  const projectId = registerResult.project.id;

  const project = await getProject(projectId);

  assert(project !== null, "getProject returns project when exists");
  assertEqual(project.id, projectId, "getProject returns correct project ID");
  assertEqual(project.name, "Get Test Project", "getProject returns correct project name");
}

async function testGetProject_NotFound() {
  const project = await getProject("nonexistent-id-12345");
  assertEqual(project, null, "getProject returns null for unknown ID");
}

// ============================================================================
// unregisterProject tests
// ============================================================================

async function testUnregisterProject_Success() {
  const projectPath = createValidProject("unregister-test");
  const registerResult = await registerProject(projectPath, "Unregister Test");
  const projectId = registerResult.project.id;

  const unregisterResult = await unregisterProject(projectId);
  assertEqual(unregisterResult.success, true, "unregisterProject succeeds for existing project");

  // Verify project is removed
  const project = await getProject(projectId);
  assertEqual(project, null, "Project is removed after unregister");
}

async function testUnregisterProject_NotFound() {
  const result = await unregisterProject("nonexistent-id-12345");
  assertEqual(result.success, false, "unregisterProject fails for unknown ID");
  assert(result.error.includes("not found"), "unregisterProject returns not found error");
}

// ============================================================================
// getConfigFilePath tests
// ============================================================================

async function testGetConfigFilePath() {
  const configPath = getConfigFilePath();
  assert(configPath.includes(".ralph"), "Config path includes .ralph directory");
  assert(configPath.endsWith("dashboard.json"), "Config file is dashboard.json");
}

// ============================================================================
// Run all tests
// ============================================================================

async function runTests() {
  console.log("=== Dashboard Project Manager Tests ===\n");

  setup();

  try {
    // isValidRalphProject tests
    console.log("\n--- isValidRalphProject tests ---");
    await testIsValidRalphProject_ValidProject();
    await testIsValidRalphProject_NoRalphDir();
    await testIsValidRalphProject_NonExistentPath();

    // registerProject tests
    console.log("\n--- registerProject tests ---");
    await testRegisterProject_ValidProject();
    await testRegisterProject_AutoGenerateName();
    await testRegisterProject_InvalidPath();
    await testRegisterProject_NoRalphDir();
    await testRegisterProject_DuplicatePath();

    // listProjects tests
    console.log("\n--- listProjects tests ---");
    await testListProjects_Empty();
    await testListProjects_WithProjects();

    // getProject tests
    console.log("\n--- getProject tests ---");
    await testGetProject_Exists();
    await testGetProject_NotFound();

    // unregisterProject tests
    console.log("\n--- unregisterProject tests ---");
    await testUnregisterProject_Success();
    await testUnregisterProject_NotFound();

    // getConfigFilePath tests
    console.log("\n--- getConfigFilePath tests ---");
    await testGetConfigFilePath();

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
