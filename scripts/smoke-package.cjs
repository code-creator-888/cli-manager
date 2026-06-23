#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { assertNativeModuleFiles } = require('./native-modules.cjs');

const projectRoot = path.resolve(__dirname, '..');
const releaseDir = path.join(projectRoot, 'release');
const appPathArg = process.argv[2];

function findPackagedApp() {
  if (appPathArg) {
    return path.resolve(projectRoot, appPathArg);
  }

  if (process.platform === 'darwin') {
    const candidates = [
      path.join(releaseDir, 'mac-arm64', 'CLI Manager.app'),
      path.join(releaseDir, 'mac', 'CLI Manager.app'),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate));
  }

  if (process.platform === 'linux') {
    const candidates = [
      path.join(releaseDir, 'linux-unpacked', 'cli-manager'),
      path.join(releaseDir, 'linux-arm64-unpacked', 'cli-manager'),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate));
  }

  if (process.platform === 'win32') {
    const candidates = [
      path.join(releaseDir, 'win-unpacked', 'CLI Manager.exe'),
      path.join(releaseDir, 'win-arm64-unpacked', 'CLI Manager.exe'),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate));
  }

  return undefined;
}

function getExecutable(appPath) {
  if (process.platform === 'darwin' && appPath.endsWith('.app')) {
    return path.join(appPath, 'Contents', 'MacOS', 'CLI Manager');
  }

  return appPath;
}

function getResourcesDir(appPath) {
  if (process.platform === 'darwin' && appPath.endsWith('.app')) {
    return path.join(appPath, 'Contents', 'Resources');
  }

  return path.join(path.dirname(appPath), 'resources');
}

async function runPackagedApp(executable) {
  await new Promise((resolve, reject) => {
    const child = spawn(executable, ['--cli-manager-smoke-test'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        CLI_MANAGER_SMOKE_TEST: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Packaged app smoke test timed out.\n${output}`));
    }, 30000);

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Packaged app smoke test exited with ${code}.\n${output}`));
      }
    });
  });
}

async function main() {
  const appPath = findPackagedApp();
  if (!appPath) {
    throw new Error('No packaged app found. Run npm run package:mac:dir, package:linux, or package:win first.');
  }

  const executable = getExecutable(appPath);
  const resourcesDir = getResourcesDir(appPath);
  const asarPath = path.join(resourcesDir, 'app.asar');
  const unpackedPath = path.join(resourcesDir, 'app.asar.unpacked');

  for (const requiredPath of [appPath, executable, asarPath, unpackedPath]) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(`Missing packaged artifact: ${requiredPath}`);
    }
  }

  const nativeResults = assertNativeModuleFiles(unpackedPath);
  for (const result of nativeResults) {
    console.log(`Packaged native binary found for ${result.name}: ${path.relative(projectRoot, result.files[0])}`);
  }

  await runPackagedApp(executable);
  console.log(`Packaged app smoke passed: ${path.relative(projectRoot, appPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
