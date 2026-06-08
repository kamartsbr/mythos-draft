export const APP_BUILD_VERSION = import.meta.env.VITE_APP_BUILD_VERSION ?? 'development';
export const VERSION_POLL_INTERVAL_MS = 3 * 60 * 1000;
export const VERSION_ENDPOINT = '/version.json';

export type AppVersionSnapshot = {
  version: string;
  appVersion?: string;
  buildStamp?: string;
};

/**
 * Validates and normalizes an unknown value into an AppVersionSnapshot.
 *
 * @param payload - The raw value (typically parsed JSON) expected to contain a string `version` and optional `appVersion` and `buildStamp` fields.
 * @returns An `AppVersionSnapshot` with trimmed string fields when `version` is a non-empty string, `null` otherwise.
 */
export function parseAppVersionSnapshot(payload: unknown): AppVersionSnapshot | null {
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const version = typeof record.version === 'string' ? record.version.trim() : '';
  if (!version) return null;

  return {
    version,
    appVersion: typeof record.appVersion === 'string' ? record.appVersion.trim() : undefined,
    buildStamp: typeof record.buildStamp === 'string' ? record.buildStamp.trim() : undefined,
  };
}

/**
 * Determines whether the remote app version differs from the current version.
 *
 * @returns `true` if the versions differ, `false` otherwise.
 */
export function isAppVersionUpdate(currentVersion: string, remoteVersion: string): boolean {
  return currentVersion !== remoteVersion;
}

/**
 * Fetches the remote app version from the VERSION_ENDPOINT.
 *
 * Attempts to retrieve and parse the version snapshot; returns the snapshot's `version` when present and valid, or `null` on network errors, non-OK responses, or invalid payloads.
 *
 * @param fetchImpl - Optional fetch implementation to use instead of the global `fetch` (useful for testing or alternate runtimes)
 * @returns The remote version string if available, `null` otherwise
 */
export async function readRemoteAppVersion(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetchImpl(VERSION_ENDPOINT, { cache: 'no-store' });
    if (!response.ok) return null;

    const snapshot = parseAppVersionSnapshot(await response.json());
    return snapshot?.version ?? null;
  } catch {
    return null;
  }
}
