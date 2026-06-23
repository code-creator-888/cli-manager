const fs = require('fs');
const path = require('path');

const nativeModuleSpecs = [
  {
    name: 'better-sqlite3',
    packageName: 'better-sqlite3',
    filePattern: /better_sqlite3\.node$/,
  },
  {
    name: 'node-pty',
    packageName: 'node-pty',
    filePattern: /pty\.node$/,
  },
];

function findFiles(root, predicate, results = []) {
  if (!fs.existsSync(root)) {
    return results;
  }

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      findFiles(fullPath, predicate, results);
    } else if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

function findNativeModuleFiles(root) {
  return nativeModuleSpecs.map((spec) => {
    const moduleRoot = path.join(root, 'node_modules', spec.packageName);
    const files = findFiles(moduleRoot, (file) => spec.filePattern.test(file));
    return { ...spec, files };
  });
}

function assertNativeModuleFiles(root) {
  const results = findNativeModuleFiles(root);
  const missing = results.filter((result) => result.files.length === 0);

  if (missing.length > 0) {
    throw new Error(`Missing native module binaries: ${missing.map((result) => result.name).join(', ')}`);
  }

  return results;
}

module.exports = {
  assertNativeModuleFiles,
  findFiles,
  findNativeModuleFiles,
  nativeModuleSpecs,
};
