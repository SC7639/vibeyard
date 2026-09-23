// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Preferences } from '../shared/types.js';

vi.mock('./refresh-terminal-surfaces.js', () => ({
  refreshTerminalSurfacesFromPreferences: vi.fn(),
}));

const readBackgroundImage = vi.fn();
let objectUrlCounter = 0;
const revokeObjectURL = vi.fn();

function customPrefs(overrides: Partial<Preferences> = {}): Preferences {
  return {
    terminalBackgroundMode: 'custom',
    terminalBackgroundImagePath: '/pics/a.png',
    terminalBackgroundDim: 0.3,
    terminalBackgroundSurfaceAlpha: 0.5,
    ...overrides,
  } as Preferences;
}

describe('refreshTerminalBackdropFromPreferences with a custom photo', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    objectUrlCounter = 0;
    document.body.innerHTML = '<div id="main-area"></div>';
    readBackgroundImage.mockResolvedValue({ mime: 'image/png', data: new ArrayBuffer(4) });
    (window as unknown as { vibeyard: unknown }).vibeyard = { app: { readBackgroundImage } };
    URL.createObjectURL = vi.fn(() => `blob:vy/${++objectUrlCounter}`);
    URL.revokeObjectURL = revokeObjectURL;
  });

  it('only updates the dim variable when a slider changes, without reloading the photo', async () => {
    const { refreshTerminalBackdropFromPreferences } = await import('./terminal-backdrop.js');
    const main = document.getElementById('main-area')!;

    await refreshTerminalBackdropFromPreferences(customPrefs({ terminalBackgroundDim: 0.3 }));
    const img = document.getElementById('main-area-backdrop-photo') as HTMLImageElement;
    const removeSrc = vi.spyOn(img, 'removeAttribute');

    await refreshTerminalBackdropFromPreferences(customPrefs({ terminalBackgroundDim: 0.6 }));

    expect(readBackgroundImage).toHaveBeenCalledTimes(1);
    expect(removeSrc).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(img.src).toBe('blob:vy/1');
    expect(main.style.getPropertyValue('--vy-terminal-backdrop-dim')).toBe('0.6');
  });

  it('swaps to a new photo before revoking the old one when the path changes', async () => {
    const { refreshTerminalBackdropFromPreferences } = await import('./terminal-backdrop.js');

    await refreshTerminalBackdropFromPreferences(customPrefs({ terminalBackgroundImagePath: '/pics/a.png' }));
    const img = document.getElementById('main-area-backdrop-photo') as HTMLImageElement;
    const removeSrc = vi.spyOn(img, 'removeAttribute');

    await refreshTerminalBackdropFromPreferences(customPrefs({ terminalBackgroundImagePath: '/pics/b.png' }));

    expect(readBackgroundImage).toHaveBeenCalledTimes(2);
    expect(removeSrc).not.toHaveBeenCalled();
    expect(img.src).toBe('blob:vy/2');
    // The old blob is only released once the new picture is on screen.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    img.dispatchEvent(new Event('load'));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:vy/1');
  });

  it('clears the photo when the backdrop is switched off', async () => {
    const { refreshTerminalBackdropFromPreferences } = await import('./terminal-backdrop.js');
    const main = document.getElementById('main-area')!;

    await refreshTerminalBackdropFromPreferences(customPrefs());
    await refreshTerminalBackdropFromPreferences(customPrefs({ terminalBackgroundMode: 'none' }));

    const img = document.getElementById('main-area-backdrop-photo') as HTMLImageElement;
    expect(img.getAttribute('src')).toBeNull();
    expect(main.classList.contains('main-area-has-custom-photo')).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:vy/1');
  });
});
