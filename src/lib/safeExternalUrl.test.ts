import { describe, expect, it } from 'vitest';
import { toSafeExternalUrl } from './safeExternalUrl';

describe('toSafeExternalUrl', () => {
  it('allows http and https links', () => {
    expect(toSafeExternalUrl('https://example.com/path')).toBe('https://example.com/path');
    expect(toSafeExternalUrl('http://example.com/path')).toBe('http://example.com/path');
  });

  it('defaults bare domains to https', () => {
    expect(toSafeExternalUrl('example.com/live')).toBe('https://example.com/live');
  });

  it('rejects script and non-web protocols', () => {
    expect(toSafeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(toSafeExternalUrl('data:text/html,hello')).toBeNull();
  });
});
