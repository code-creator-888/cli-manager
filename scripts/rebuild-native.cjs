#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const { assertNativeModuleFiles } = require('./native-modules.cjs');

const projectRoot = path.resolve(__dirname, '..');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run('node', ['scripts/ensure-electron.cjs']);
run('npx', ['electron-builder', 'install-app-deps']);

const results = assertNativeModuleFiles(projectRoot);
for (const result of results) {
  console.log(`Verified ${result.name} native binary: ${path.relative(projectRoot, result.files[0])}`);
}
