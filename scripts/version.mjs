import fs from 'fs';
import path from 'path';

function readPackageVersion() {
  const packagePath = path.resolve(process.cwd(), 'package.json');
  const raw = fs.readFileSync(packagePath, 'utf-8');
  const pkg = JSON.parse(raw);
  return String(pkg.version ?? '0.0.0');
}

export function createBuildVersion() {
  const appVersion = readPackageVersion();
  const buildStamp = new Date().toISOString();
  return {
    version: `${appVersion}+${buildStamp}`,
    appVersion,
    buildStamp,
  };
}

export function createVersionJson(snapshot = createBuildVersion()) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
