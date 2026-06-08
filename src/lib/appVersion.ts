export const APP_BUILD_VERSION = import.meta.env.VITE_APP_BUILD_VERSION ?? 'development';
export const VERSION_POLL_INTERVAL_MS = 3 * 60 * 1000;
export const VERSION_ENDPOINT = '/version.json';

export type AppVersionSnapshot = {
  version: string;
  appVersion?: string;
  buildStamp?: string;
};

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

export function isAppVersionUpdate(currentVersion: string, remoteVersion: string): boolean {
  return currentVersion !== remoteVersion;
}

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
