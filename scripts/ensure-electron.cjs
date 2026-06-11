const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function getPlatformPath() {
  switch (os.platform()) {
    case 'darwin':
      return 'Electron.app/Contents/MacOS/Electron';
    case 'win32':
      return 'electron.exe';
    default:
      return 'electron';
  }
}

function getRequiredPaths(electronDir, platformPath) {
  const requiredPaths = [path.join(electronDir, 'dist', platformPath)];

  if (os.platform() === 'darwin') {
    requiredPaths.push(
      path.join(
        electronDir,
        'dist',
        'Electron.app',
        'Contents',
        'Frameworks',
        'Electron Framework.framework',
        'Electron Framework'
      )
    );
  }

  return requiredPaths;
}

function hasCompleteElectronPayload(electronDir, platformPath) {
  return getRequiredPaths(electronDir, platformPath).every((requiredPath) => fs.existsSync(requiredPath));
}

function isElectronInstalled(electronDir, version, platformPath) {
  try {
    const installedVersion = fs.readFileSync(path.join(electronDir, 'dist', 'version'), 'utf8').trim().replace(/^v/, '');
    const installedPath = fs.readFileSync(path.join(electronDir, 'path.txt'), 'utf8').trim();
    return installedVersion === version && installedPath === platformPath && hasCompleteElectronPayload(electronDir, platformPath);
  } catch {
    return false;
  }
}

function writeElectronMetadata(electronDir, version, platformPath) {
  const distDir = path.join(electronDir, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(electronDir, 'path.txt'), platformPath);
  fs.writeFileSync(path.join(distDir, 'version'), `v${version}`);
}

function resetElectronInstall(electronDir) {
  fs.rmSync(path.join(electronDir, 'dist'), { recursive: true, force: true });
  fs.rmSync(path.join(electronDir, 'path.txt'), { force: true });
}

function extractElectronArchive(zipPath, electronDir) {
  const distDir = path.join(electronDir, 'dist');
  fs.mkdirSync(distDir, { recursive: true });

  const command = os.platform() === 'darwin' ? 'ditto' : 'unzip';
  const args =
    os.platform() === 'darwin'
      ? ['-x', '-k', zipPath, distDir]
      : ['-q', zipPath, '-d', distDir];

  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`Failed to extract Electron archive with ${command}.`);
  }
}

async function installElectronFromArchive(electronDir, version) {
  const electronGetPath = require.resolve('@electron/get', { paths: [electronDir] });
  const { downloadArtifact } = require(electronGetPath);
  const platform = os.platform();
  const arch = os.arch();

  console.log('Electron binary missing, downloading archive...');
  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform,
    arch,
    force: true,
    checksums: require(path.join(electronDir, 'checksums.json')),
  });

  resetElectronInstall(electronDir);
  extractElectronArchive(zipPath, electronDir);
}

async function main() {
  const electronPackagePath = require.resolve('electron/package.json');
  const electronDir = path.dirname(electronPackagePath);
  const { version } = require(electronPackagePath);
  const platformPath = getPlatformPath();

  if (isElectronInstalled(electronDir, version, platformPath)) {
    return;
  }

  if (hasCompleteElectronPayload(electronDir, platformPath)) {
    writeElectronMetadata(electronDir, version, platformPath);
    if (isElectronInstalled(electronDir, version, platformPath)) {
      return;
    }
  }

  await installElectronFromArchive(electronDir, version);
  writeElectronMetadata(electronDir, version, platformPath);

  if (!isElectronInstalled(electronDir, version, platformPath)) {
    throw new Error('Electron installer completed but the binary is still missing.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
