#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const { assertNativeModuleFiles } = require('./native-modules.cjs');

const projectRoot = path.resolve(__dirname, '..');
const electronBin = process.platform === 'win32'
  ? path.join(projectRoot, 'node_modules', '.bin', 'electron.cmd')
  : path.join(projectRoot, 'node_modules', '.bin', 'electron');

const results = assertNativeModuleFiles(projectRoot);
const script = `
const Database = require('better-sqlite3');
const pty = require('node-pty');
const db = new Database(':memory:');
db.exec('CREATE TABLE smoke_test (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO smoke_test (value) VALUES (\\'ok\\');');
const value = db.prepare('SELECT value FROM smoke_test WHERE id = 1').get().value;
db.close();
if (value !== 'ok') throw new Error('better-sqlite3 smoke query failed');
if (typeof pty.spawn !== 'function') throw new Error('node-pty spawn API is unavailable');
`;

const result = spawnSync(electronBin, ['-e', script], {
  cwd: projectRoot,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
  encoding: 'utf8',
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

for (const nativeModule of results) {
  console.log(`Native smoke passed for ${nativeModule.name}: ${path.relative(projectRoot, nativeModule.files[0])}`);
}
