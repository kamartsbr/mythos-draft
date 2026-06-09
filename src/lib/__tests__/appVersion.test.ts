import { describe, expect, it, vi } from 'vitest';
import {
  isAppVersionUpdate,
  parseAppVersionSnapshot,
  readRemoteAppVersion,
} from '../appVersion';

describe('appVersion helpers', () => {
  it('parses a valid version payload', () => {
    expect(parseAppVersionSnapshot({
      version: '1.0.3+2026-06-07T12:00:00.000Z',
      appVersion: '1.0.3',
      buildStamp: '2026-06-07T12:00:00.000Z',
    })).toEqual({
      version: '1.0.3+2026-06-07T12:00:00.000Z',
      appVersion: '1.0.3',
      buildStamp: '2026-06-07T12:00:00.000Z',
    });
  });

  it('returns null for malformed payloads', () => {
    expect(parseAppVersionSnapshot(null)).toBeNull();
    expect(parseAppVersionSnapshot({})).toBeNull();
    expect(parseAppVersionSnapshot({ version: '   ' })).toBeNull();
  });

  it('detects when the deployed version changed', () => {
    expect(isAppVersionUpdate('1.0.3+old', '1.0.3+new')).toBe(true);
    expect(isAppVersionUpdate('1.0.3+same', '1.0.3+same')).toBe(false);
  });

  it('returns the remote version and stays silent on fetch failures', async () => {
    const fetchOk = vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: '1.0.3+2026-06-07T12:00:00.000Z' }),
    }));

    await expect(readRemoteAppVersion(fetchOk as unknown as typeof fetch)).resolves.toBe('1.0.3+2026-06-07T12:00:00.000Z');

    const fetchFail = vi.fn(async () => {
      throw new Error('network down');
    });

    await expect(readRemoteAppVersion(fetchFail as unknown as typeof fetch)).resolves.toBeNull();
  });
});
