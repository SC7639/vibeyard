import { appState } from '../state.js';

let hideTimer: ReturnType<typeof setTimeout> | null = null;
let hostEl: HTMLDivElement | null = null;
let toastEl: HTMLDivElement | null = null;

/** Short non-blocking message at the top-right of the window. */
export function showToast(message: string, durationMs = 2800): void {
  const app = document.getElementById('app');
  if (!app) return;

  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (toastEl) {
    toastEl.remove();
    toastEl = null;
  }
  if (!hostEl || !app.contains(hostEl)) {
    hostEl = document.createElement('div');
    hostEl.className = 'app-toast-host';
    app.appendChild(hostEl);
  }

  const el = document.createElement('div');
  el.className = 'app-toast';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.textContent = message;
  hostEl.appendChild(el);
  toastEl = el;

  requestAnimationFrame(() => {
    el.classList.add('app-toast-visible');
  });

  hideTimer = setTimeout(() => {
    el.classList.remove('app-toast-visible');
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      el.remove();
      if (toastEl === el) toastEl = null;
    };
    el.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 400);
    hideTimer = null;
  }, durationMs);
}

export function initAppearanceProfileToast(): void {
  appState.on('appearance-profile-applied', (data) => {
    const name = (data as { name?: string })?.name;
    if (!name) return;
    showToast(`Appearance profile activated: ${name}`);
  });
}
