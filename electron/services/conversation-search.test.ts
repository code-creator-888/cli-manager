import { describe, expect, it } from 'vitest';
import { buildFTSQuery } from './conversation-search';

describe('buildFTSQuery', () => {
  it('builds safe prefix queries from words', () => {
    expect(buildFTSQuery('hello world')).toBe('"hello"* AND "world"*');
  });

  it('supports unicode terms', () => {
    expect(buildFTSQuery('退出 进程')).toBe('"退出"* AND "进程"*');
  });

  it('drops punctuation-only searches', () => {
    expect(buildFTSQuery('***')).toBeUndefined();
  });
});
