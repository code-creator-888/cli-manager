#!/usr/bin/env node

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const runtimeDir = path.join(os.homedir(), '.cli-manager');
const pidFile = path.join(runtimeDir, 'cli-manager-dev.pid');
const logFile = path.join(runtimeDir, 'cli-manager-dev.log');
const defaultDevPort = 5173;

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function ensureRuntimeDir() {
  fs.mkdirSync(runtimeDir, { recursive: true });
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === 'EPERM';
  }
}

function readExistingPid() {
  if (!fs.existsSync(pidFile)) {
    return null;
  }

  const value = fs.readFileSync(pidFile, 'utf8').trim();
  const pid = Number.parseInt(value, 10);
  return Number.isInteger(pid) ? pid : null;
}

function removeStalePidFile() {
  if (fs.existsSync(pidFile)) {
    fs.rmSync(pidFile, { force: true });
  }
}

function ensureDependenciesInstalled() {
  const nodeModulesPath = path.join(projectRoot, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    throw new Error(`Missing dependencies. Run "npm install" in ${projectRoot} first.`);
  }
}

function ensureNpmAvailable() {
  const npmCommand = getNpmCommand();
  const result = spawnSync(npmCommand, ['--version'], { stdio: 'ignore' });

  if (result.error || result.status !== 0) {
    throw new Error('npm is not available in PATH.');
  }
}

function canListenOnHost(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}

async function canListenOnPort(port) {
  const hosts = ['127.0.0.1', '::1'];

  for (const host of hosts) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await canListenOnHost(port, host))) {
      return false;
    }
  }

  return true;
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await canListenOnPort(port)) {
      return port;
    }
  }

  throw new Error(`No available port found between ${startPort} and ${startPort + 49}.`);
}

function startDetachedProcess(port) {
  const npmCommand = getNpmCommand();
  const logFd = fs.openSync(logFile, 'a');
  const child = spawn(npmCommand, ['run', 'dev'], {
    cwd: projectRoot,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      CLI_MANAGER_DEV_PORT: String(port),
      CLI_MANAGER_LAUNCHED_BY: 'cli-manager-start',
    },
  });

  child.unref();
  fs.writeFileSync(pidFile, `${child.pid}\n`);

  return child.pid;
}

async function main() {
  ensureRuntimeDir();
  ensureNpmAvailable();
  ensureDependenciesInstalled();

  const existingPid = readExistingPid();
  if (existingPid && isProcessRunning(existingPid)) {
    console.log(`CLI Manager is already running in background (PID: ${existingPid}).`);
    console.log(`Log file: ${logFile}`);
    return;
  }

  removeStalePidFile();
  const port = await findAvailablePort(defaultDevPort);
  const pid = startDetachedProcess(port);

  await new Promise((resolve) => setTimeout(resolve, 1500));

  if (!isProcessRunning(pid)) {
    removeStalePidFile();
    throw new Error(`CLI Manager failed to stay running. Check log: ${logFile}`);
  }

  console.log(`CLI Manager started in background (PID: ${pid}).`);
  console.log(`Dev server port: ${port}`);
  console.log(`Log file: ${logFile}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
