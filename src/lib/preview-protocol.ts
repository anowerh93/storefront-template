/**
 * postMessage contract between the myapp dashboard homepage builder and the
 * storefront live-preview island (src/views/home-preview.tsx).
 *
 * The dashboard scrapes its builder form into a HomepageConfig (the `forApi()`
 * shape — image_url, not image_path) and pushes it here on every edit. The
 * island replaces its config and re-renders using the same components the live
 * homepage uses.
 *
 * Both messages carry a fixed `source` tag so each side can ignore unrelated
 * postMessage traffic (extensions, other embeds). Origin is still checked
 * separately — the tag is a cheap filter, not a security boundary.
 */
import type { HomepageConfig } from './types';

/** Island → dashboard: "I'm mounted, send me the current draft." */
export const PREVIEW_READY = 'replybd:preview-ready';
/** Dashboard → island: "here is the latest draft config." */
export const PREVIEW_CONFIG = 'replybd:preview-config';

export type PreviewReadyMessage = {
  source: typeof PREVIEW_READY;
};

export type PreviewConfigMessage = {
  source: typeof PREVIEW_CONFIG;
  /** Full homepage config in forApi() shape (image_url, not image_path). */
  config: HomepageConfig;
};

export type PreviewMessage = PreviewReadyMessage | PreviewConfigMessage;

export function isPreviewConfigMessage(data: unknown): data is PreviewConfigMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: unknown }).source === PREVIEW_CONFIG &&
    typeof (data as { config?: unknown }).config === 'object' &&
    (data as { config?: unknown }).config !== null
  );
}

export function isPreviewReadyMessage(data: unknown): data is PreviewReadyMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: unknown }).source === PREVIEW_READY
  );
}
