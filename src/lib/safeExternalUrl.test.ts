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

  it('returns null for empty input', () => {
    expect(toSafeExternalUrl(null)).toBeNull();
    expect(toSafeExternalUrl(undefined)).toBeNull();
    expect(toSafeExternalUrl('')).toBeNull();
    expect(toSafeExternalUrl('   ')).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    expect(toSafeExternalUrl('http://')).toBeNull();
    expect(toSafeExternalUrl('://bad')).toBeNull();
  });

  it('preserves paths, query strings, and fragments', () => {
    expect(toSafeExternalUrl('https://example.com/path?x=1#frag')).toBe('https://example.com/path?x=1#frag');
    expect(toSafeExternalUrl('example.com/path?x=1#frag')).toBe('https://example.com/path?x=1#frag');
  });

  it('rejects other non-web protocols', () => {
    expect(toSafeExternalUrl('file:///tmp/secret')).toBeNull();
    expect(toSafeExternalUrl('blob:https://example.com/id')).toBeNull();
    expect(toSafeExternalUrl('ftp://example.com/file')).toBeNull();
  });
});
