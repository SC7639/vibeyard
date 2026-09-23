import type { Preferences } from '../shared/types.js';
import {
  backdropIsActive,
  effectiveTerminalBackgroundMode,
  getPresetGradientCss,
  getTerminalBackgroundDim,
  normalizePresetId,
} from './terminal-background-helpers.js';
import { refreshTerminalSurfacesFromPreferences } from './refresh-terminal-surfaces.js';

const BACKDROP_PHOTO_ID = 'main-area-backdrop-photo';

/** Blob URL for custom photo; revoked when backdrop changes. */
let backdropPhotoObjectUrl: string | null = null;
/** Path of the photo currently on screen, so slider ticks don't reload it. */
let loadedPhotoPath: string | null = null;
/** Bumped per photo read so a slow read cannot overwrite a newer one. */
let photoLoadSeq = 0;

function revokeBackdropPhotoObjectUrl(): void {
  if (backdropPhotoObjectUrl) {
    URL.revokeObjectURL(backdropPhotoObjectUrl);
    backdropPhotoObjectUrl = null;
  }
}

function clearBackdropCssVars(main: HTMLElement): void {
  main.style.removeProperty('--vy-terminal-backdrop-image');
  main.style.removeProperty('--vy-terminal-backdrop-color');
  main.style.removeProperty('--vy-terminal-backdrop-size');
  main.style.removeProperty('--vy-terminal-backdrop-dim');
}

function clearCustomBackdropPhoto(main: HTMLElement): void {
  revokeBackdropPhotoObjectUrl();
  loadedPhotoPath = null;
  main.classList.remove('main-area-has-custom-photo');
  const img = document.getElementById(BACKDROP_PHOTO_ID) as HTMLImageElement | null;
  if (img) img.removeAttribute('src');
}

function ensureBackdropPhotoImg(main: HTMLElement): HTMLImageElement {
  let img = document.getElementById(BACKDROP_PHOTO_ID) as HTMLImageElement | null;
  if (!img) {
    img = document.createElement('img');
    img.id = BACKDROP_PHOTO_ID;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.decoding = 'async';
    main.prepend(img);
  }
  return img;
}

function toArrayBuffer(data: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  const view = data as ArrayBufferView;
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

/**
 * Applies backdrop visuals and syncs xterm surface colors from preferences.
 * Safe to call repeatedly (e.g. on `preferences-changed`).
 */
export async function refreshTerminalBackdropFromPreferences(prefs: Preferences): Promise<void> {
  const main = document.getElementById('main-area');
  if (!main) return;

  const active = backdropIsActive(prefs);
  main.classList.toggle('main-area-has-backdrop', active);
  refreshTerminalSurfacesFromPreferences(prefs);

  if (!active) {
    clearCustomBackdropPhoto(main);
    clearBackdropCssVars(main);
    return;
  }

  const dim = getTerminalBackgroundDim(prefs);
  main.style.setProperty('--vy-terminal-backdrop-dim', String(dim));

  const mode = effectiveTerminalBackgroundMode(prefs);
  if (mode === 'preset') {
    clearCustomBackdropPhoto(main);
    const grad = getPresetGradientCss(normalizePresetId(prefs.terminalBackgroundPresetId));
    main.style.setProperty('--vy-terminal-backdrop-image', grad);
    main.style.setProperty('--vy-terminal-backdrop-color', 'transparent');
    main.style.removeProperty('--vy-terminal-backdrop-size');
    return;
  }

  const path = prefs.terminalBackgroundImagePath;
  if (typeof path !== 'string' || path.length === 0) {
    return;
  }

  // Same photo already on screen: only dim / surface changed (a slider tick), so
  // leave the <img> alone. Reloading it here is what blanked the wallpaper.
  const existing = document.getElementById(BACKDROP_PHOTO_ID) as HTMLImageElement | null;
  if (loadedPhotoPath === path && existing?.getAttribute('src')) {
    return;
  }

  const seq = ++photoLoadSeq;
  let payload: { mime: string; data: ArrayBuffer } | null = null;
  try {
    const raw = await window.vibeyard.app.readBackgroundImage(path);
    if (raw?.mime && raw.data) {
      payload = { mime: raw.mime, data: toArrayBuffer(raw.data as ArrayBuffer | ArrayBufferView) };
    }
  } catch {
    payload = null;
  }
  if (seq !== photoLoadSeq) return; // A newer refresh has superseded this read.

  if (!payload) {
    clearCustomBackdropPhoto(main);
    main.style.setProperty('--vy-terminal-backdrop-image', 'none');
    main.style.setProperty('--vy-terminal-backdrop-color', 'var(--bg-primary)');
    main.style.removeProperty('--vy-terminal-backdrop-size');
    return;
  }

  // Swap in the new photo before releasing the old one: <img> keeps showing the
  // previous picture until the new src has decoded, so there is no blank frame.
  const previousUrl = backdropPhotoObjectUrl;
  const blob = new Blob([payload.data], { type: payload.mime });
  backdropPhotoObjectUrl = URL.createObjectURL(blob);
  const img = ensureBackdropPhotoImg(main);
  img.src = backdropPhotoObjectUrl;
  loadedPhotoPath = path;
  if (previousUrl) {
    const release = () => URL.revokeObjectURL(previousUrl);
    img.addEventListener('load', release, { once: true });
    img.addEventListener('error', release, { once: true });
  }
  main.classList.add('main-area-has-custom-photo');
  main.style.setProperty('--vy-terminal-backdrop-image', 'none');
  main.style.setProperty('--vy-terminal-backdrop-color', 'transparent');
  main.style.setProperty('--vy-terminal-backdrop-size', 'cover');
}
