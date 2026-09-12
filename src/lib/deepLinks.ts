// Canonical builders/parsers for Studio deep links.
// Keeping these in one place prevents the "Boost loses the selected post" and
// "Draft edit opens a blank composer" regressions from coming back.

export type BoostContentType = 'post' | 'reel';

/** Link that opens the boost composer with a specific post or reel preselected. */
export function boostContentPath(type: string, id: string): string {
  return `/studio/promotions?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;
}

/** Reads the preselected boost target out of a `/studio/promotions` query string. */
export function parseBoostParams(search: string | URLSearchParams): {
  contentType?: string;
  contentId?: string;
} {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  return {
    contentType: params.get('type') || undefined,
    contentId: params.get('id') || undefined,
  };
}

/** Link that reopens the composer with a saved draft loaded. */
export function draftEditPath(draftId: string): string {
  return `/create?draft=${encodeURIComponent(draftId)}`;
}

/** Reads the draft id the composer should load. */
export function parseDraftId(search: string | URLSearchParams): string | undefined {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  return params.get('draft') || undefined;
}
