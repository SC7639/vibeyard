import type { ITheme } from '@xterm/xterm';
import type { Preferences } from '../shared/types.js';
import { backdropIsActive, getTerminalSurfaceBackgroundColor } from './terminal-background-helpers.js';

/**
 * Theme for a live terminal surface: the base theme, with a translucent
 * background while a backdrop is active so the wallpaper shows through.
 * Every place that assigns `terminal.options.theme` must go through this,
 * otherwise a plain theme re-apply paints the terminal opaque again.
 */
export function getTerminalThemeForSurface(theme: 'dark' | 'light', prefs: Preferences | undefined): ITheme {
  const base = getTerminalTheme(theme);
  return backdropIsActive(prefs) ? { ...base, background: getTerminalSurfaceBackgroundColor(prefs) } : base;
}

export const darkTerminalTheme: ITheme = {
  background: '#0e0f13',
  foreground: '#e9eaf1',
  cursor: '#8588f2',
  selectionBackground: '#8588f259',
  black: '#0e0f13',
  red: '#e94560',
  green: '#0f9b58',
  yellow: '#f4b400',
  blue: '#4285f4',
  magenta: '#ab47bc',
  cyan: '#00acc1',
  white: '#e9eaf1',
  brightBlack: '#5d6172',
  brightRed: '#ff6b85',
  brightGreen: '#2dbf73',
  brightYellow: '#f6c453',
  brightBlue: '#6ea8ff',
  brightMagenta: '#c36be0',
  brightCyan: '#39d3e3',
  brightWhite: '#ffffff',
};

export const lightTerminalTheme: ITheme = {
  background: '#f7f7fb',
  foreground: '#1c1e26',
  cursor: '#5a5ee6',
  selectionBackground: '#5a5ee633',
  black: '#1c1e26',
  red: '#e94560',
  green: '#0f7a46',
  yellow: '#b07800',
  blue: '#1a5cbf',
  magenta: '#7b27a0',
  cyan: '#0080a0',
  white: '#6b7280',
  brightBlack: '#8b8b99',
  brightRed: '#c83f56',
  brightGreen: '#0b6a3d',
  brightYellow: '#8d6200',
  brightBlue: '#144c9f',
  brightMagenta: '#67208a',
  brightCyan: '#006c88',
  brightWhite: '#2c2c2c',
};

export function getTerminalTheme(theme: 'dark' | 'light'): ITheme {
  return theme === 'light' ? lightTerminalTheme : darkTerminalTheme;
}
