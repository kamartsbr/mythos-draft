import fs from 'fs';
import path from 'path';

/**
 * Read the project's package.json and return its declared version.
 *
 * If package.json does not contain a version field, returns "0.0.0".
 * File I/O or JSON parsing errors propagate to the caller.
 *
 * @returns {string} The package version as a string, or "0.0.0" when missing.
 */
function readPackageVersion() {
  const packagePath = path.resolve(process.cwd(), 'package.json');
  const raw = fs.readFileSync(packagePath, 'utf-8');
  const pkg = JSON.parse(raw);
  return String(pkg.version ?? '0.0.0');
}

/**
 * Create a build-qualified version object combining the package version and the current ISO timestamp.
 *
 * @returns {{version: string, appVersion: string, buildStamp: string}} An object containing:
 *  - `version`: the build-qualified version formatted as `appVersion+buildStamp`,
 *  - `appVersion`: the package.json `version` (or fallback `0.0.0` from `readPackageVersion`),
 *  - `buildStamp`: the current timestamp in ISO 8601 format.
 */
export function createBuildVersion() {
  const appVersion = readPackageVersion();
  const buildStamp = new Date().toISOString();
  return {
    version: `${appVersion}+${buildStamp}`,
    appVersion,
    buildStamp,
  };
}

/**
 * Serialize a version snapshot to a pretty-printed JSON string with a trailing newline.
 * @param {{version: string, appVersion: string, buildStamp: string}} snapshot - Version snapshot to serialize; expected to contain `version`, `appVersion`, and `buildStamp`.
 * @returns {string} A JSON string of `snapshot` formatted with 2-space indentation and terminated with a newline.
 */
export function createVersionJson(snapshot = createBuildVersion()) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
