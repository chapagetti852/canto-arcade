// Globals set by the classic scripts index.html loads before the game (public/js/*.js).
import type { HKData, Photo } from './types';

declare global {
  interface Window {
    HK_DATA: HKData;
    HK_PHOTOS?: Record<string, Photo>;
    /** extra photos per item: [url, author, licence] */
    HK_GAL?: Record<string, [string, string, string][]>;
    HK_ICONS?: Record<string, string>;
    /** the voice clips bundled in public/audio/ */
    HK_AUDIO?: string[];
    /** for the arcade's playtests */
    __hk?: unknown;
  }
}
export {};
