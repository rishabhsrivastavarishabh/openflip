import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Multi-photo posts store their image URLs comma-separated in `media_url`.
 * Rendering that raw string as an <img src> breaks the post, so all read
 * sites should go through these helpers.
 */
export function getPostMediaUrls(mediaUrl: string | null | undefined): string[] {
  if (!mediaUrl) return [];
  return mediaUrl.includes(',')
    ? mediaUrl.split(',').map((u) => u.trim()).filter(Boolean)
    : [mediaUrl];
}

export function getFirstPostMediaUrl(mediaUrl: string | null | undefined): string {
  const urls = getPostMediaUrls(mediaUrl);
  return urls[0] ?? '';
}

