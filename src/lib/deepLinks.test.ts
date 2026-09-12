import { describe, it, expect } from 'vitest';
import { boostContentPath, parseBoostParams, draftEditPath, parseDraftId } from './deepLinks';

describe('boost deep link', () => {
  it('carries the selected content through the link', () => {
    const path = boostContentPath('post', 'abc-123');
    expect(path).toBe('/studio/promotions?type=post&id=abc-123');

    const search = path.slice(path.indexOf('?'));
    expect(parseBoostParams(search)).toEqual({ contentType: 'post', contentId: 'abc-123' });
  });

  it('round-trips reels and ids that need encoding', () => {
    const id = 'id with/slash';
    const search = boostContentPath('reel', id).split('?')[1];
    expect(parseBoostParams(search)).toEqual({ contentType: 'reel', contentId: id });
  });

  it('returns undefined when no content was preselected', () => {
    expect(parseBoostParams('')).toEqual({ contentType: undefined, contentId: undefined });
  });
});

describe('draft deep link', () => {
  it('reopens the composer on the chosen draft', () => {
    const path = draftEditPath('draft-9');
    expect(path).toBe('/create?draft=draft-9');
    expect(parseDraftId(path.split('?')[1])).toBe('draft-9');
  });

  it('encodes ids safely and round-trips them', () => {
    const id = 'a&b=c';
    expect(parseDraftId(draftEditPath(id).split('?')[1])).toBe(id);
  });

  it('returns undefined for a fresh composer', () => {
    expect(parseDraftId('')).toBeUndefined();
  });
});
