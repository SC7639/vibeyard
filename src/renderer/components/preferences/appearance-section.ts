import { appState } from '../../state.js';
import { createCustomSelect, type CustomSelectInstance } from '../custom-select.js';
import { applyZoom, getZoomFactor, ZOOM_STEPS } from '../../zoom.js';
import { t } from '../../i18n.js';
import type { PreferencesContext, SectionController } from './section.js';
import { toggleRow } from './shared.js';
import type { Preferences, TerminalBackgroundMode } from '../../../shared/types.js';
import { DEFAULT_ACTIVE_SESSION_STATUSES } from '../active-sessions-panel.js';
import { TERMINAL_BG_PRESETS } from '../../terminal-background-helpers.js';
import { refreshTerminalBackdropFromPreferences } from '../../terminal-backdrop.js';

type SidebarViews = { gitPanel: boolean; sessionHistory: boolean; discussions: boolean; fileTree: boolean; costFooter: boolean; activeSessions: boolean };
type ActiveStatuses = NonNullable<Preferences['activeSessionStatuses']>;

export function createAppearanceSection(ctx: PreferencesContext): SectionController {
  let themeSelect: CustomSelectInstance | null = null;
  let zoomSelect: CustomSelectInstance | null = null;
  let zoomPrefUnsub: (() => void) | null = null;
  let sidebarCheckboxes: Record<keyof SidebarViews, HTMLInputElement> | null = null;
  let statusCheckboxes: Record<keyof ActiveStatuses, HTMLInputElement> | null = null;
  let boardCardMetricsCheckbox: HTMLInputElement | null = null;
  let backdropModeSelect: CustomSelectInstance | null = null;
  let backdropPresetSelect: CustomSelectInstance | null = null;
  let backdropDimSlider: HTMLInputElement | null = null;
  let backdropSurfaceSlider: HTMLInputElement | null = null;
  let backdropImagePath: string | null = null;
  let backdropImageLabel: HTMLDivElement | null = null;
  let backdropPresetRow: HTMLElement | null = null;
  let backdropImageRow: HTMLElement | null = null;

  function unsubZoom() {
    zoomPrefUnsub?.();
    zoomPrefUnsub = null;
  }

  /** Show preset picker only in 'preset' mode, image picker only in 'custom' mode. */
  function updateBackdropRowVisibility(mode: TerminalBackgroundMode) {
    if (backdropPresetRow) backdropPresetRow.style.display = mode === 'preset' ? '' : 'none';
    if (backdropImageRow) backdropImageRow.style.display = mode === 'custom' ? '' : 'none';
  }

  /** Live-preview the backdrop from the current control values (does not persist). */
  function applyBackdropPreview() {
    if (!backdropModeSelect || !backdropDimSlider || !backdropSurfaceSlider) return;
    const mode = backdropModeSelect.getValue() as TerminalBackgroundMode;
    const dim = Math.min(100, Math.max(0, Number.parseInt(backdropDimSlider.value, 10))) / 100;
    const surf = Math.min(100, Math.max(0, Number.parseInt(backdropSurfaceSlider.value, 10))) / 100;
    const merged: Preferences = {
      ...appState.preferences,
      terminalBackgroundMode: mode,
      terminalBackgroundPresetId: backdropPresetSelect?.getValue() ?? appState.preferences.terminalBackgroundPresetId,
      terminalBackgroundImagePath: mode === 'custom' ? backdropImagePath : null,
      terminalBackgroundDim: dim,
      terminalBackgroundSurfaceAlpha: surf,
    };
    void refreshTerminalBackdropFromPreferences(merged);
  }

  return {
    render(container) {
      if (themeSelect) themeSelect.destroy();
      if (zoomSelect) zoomSelect.destroy();

      const themeRow = document.createElement('div');
      themeRow.className = 'modal-toggle-field';
      const themeLabel = document.createElement('label');
      themeLabel.textContent = t('appearance.theme');
      themeSelect = createCustomSelect(
        'pref-theme',
        [{ value: 'dark', label: t('appearance.themeDark') }, { value: 'light', label: t('appearance.themeLight') }],
        ctx.originalTheme,
        (value) => { document.documentElement.dataset.theme = value; },
      );
      themeRow.appendChild(themeLabel);
      themeRow.appendChild(themeSelect.element);
      container.appendChild(themeRow);

      const zoomRow = document.createElement('div');
      zoomRow.className = 'modal-toggle-field';
      const zoomLabel = document.createElement('label');
      zoomLabel.textContent = t('appearance.zoom');
      const zoomOptions = ZOOM_STEPS.map((v) => ({ value: String(v), label: `${Math.round(v * 100)}%` }));
      zoomSelect = createCustomSelect('pref-zoom', zoomOptions, String(getZoomFactor()), (value) => {
        const n = parseFloat(value);
        if (!Number.isNaN(n)) applyZoom(n);
      });
      zoomRow.appendChild(zoomLabel);
      zoomRow.appendChild(zoomSelect.element);
      container.appendChild(zoomRow);

      unsubZoom();
      zoomPrefUnsub = appState.on('preferences-changed', () => {
        zoomSelect?.setValue(String(getZoomFactor()));
      });

      // --- Terminal backdrop ---
      const backdropHeading = document.createElement('div');
      backdropHeading.className = 'preferences-subheading';
      backdropHeading.textContent = 'Terminal backdrop';
      container.appendChild(backdropHeading);

      const bp = appState.preferences;

      const modeRow = document.createElement('div');
      modeRow.className = 'modal-toggle-field';
      const modeLabel = document.createElement('label');
      modeLabel.textContent = 'Background';
      backdropModeSelect = createCustomSelect(
        'pref-backdrop-mode',
        [
          { value: 'none', label: 'None' },
          { value: 'preset', label: 'Preset gradient' },
          { value: 'custom', label: 'Custom image' },
        ],
        bp.terminalBackgroundMode ?? 'none',
        (value) => {
          updateBackdropRowVisibility(value as TerminalBackgroundMode);
          applyBackdropPreview();
        },
      );
      modeRow.appendChild(modeLabel);
      modeRow.appendChild(backdropModeSelect.element);
      container.appendChild(modeRow);

      backdropPresetRow = document.createElement('div');
      backdropPresetRow.className = 'modal-toggle-field';
      const presetLabel = document.createElement('label');
      presetLabel.textContent = 'Preset';
      backdropPresetSelect = createCustomSelect(
        'pref-backdrop-preset',
        TERMINAL_BG_PRESETS.map((p) => ({ value: p.id, label: p.label })),
        bp.terminalBackgroundPresetId ?? TERMINAL_BG_PRESETS[0].id,
        () => applyBackdropPreview(),
      );
      backdropPresetRow.appendChild(presetLabel);
      backdropPresetRow.appendChild(backdropPresetSelect.element);
      container.appendChild(backdropPresetRow);

      backdropImagePath = bp.terminalBackgroundImagePath ?? null;
      backdropImageRow = document.createElement('div');
      backdropImageRow.className = 'pref-slider-field';
      const imgBtn = document.createElement('button');
      imgBtn.className = 'modal-btn';
      imgBtn.textContent = 'Choose image…';
      backdropImageLabel = document.createElement('div');
      backdropImageLabel.className = 'pref-image-path';
      backdropImageLabel.textContent = backdropImagePath ?? 'No image selected';
      imgBtn.addEventListener('click', async () => {
        const picked = await window.vibeyard.app.browseImageFile();
        if (picked) {
          backdropImagePath = picked;
          if (backdropImageLabel) backdropImageLabel.textContent = picked;
          applyBackdropPreview();
        }
      });
      backdropImageRow.appendChild(imgBtn);
      backdropImageRow.appendChild(backdropImageLabel);
      container.appendChild(backdropImageRow);

      const dimField = document.createElement('div');
      dimField.className = 'pref-slider-field';
      const dimLabel = document.createElement('label');
      dimLabel.textContent = 'Darken';
      backdropDimSlider = document.createElement('input');
      backdropDimSlider.type = 'range';
      backdropDimSlider.min = '0';
      backdropDimSlider.max = '100';
      backdropDimSlider.value = String(Math.round((bp.terminalBackgroundDim ?? 0.28) * 100));
      backdropDimSlider.addEventListener('input', () => applyBackdropPreview());
      dimField.appendChild(dimLabel);
      dimField.appendChild(backdropDimSlider);
      container.appendChild(dimField);

      const surfField = document.createElement('div');
      surfField.className = 'pref-slider-field';
      const surfLabel = document.createElement('label');
      surfLabel.textContent = 'Terminal opacity';
      backdropSurfaceSlider = document.createElement('input');
      backdropSurfaceSlider.type = 'range';
      backdropSurfaceSlider.min = '0';
      backdropSurfaceSlider.max = '100';
      backdropSurfaceSlider.value = String(Math.round((bp.terminalBackgroundSurfaceAlpha ?? 0.88) * 100));
      backdropSurfaceSlider.addEventListener('input', () => applyBackdropPreview());
      surfField.appendChild(surfLabel);
      surfField.appendChild(backdropSurfaceSlider);
      container.appendChild(surfField);

      updateBackdropRowVisibility(bp.terminalBackgroundMode ?? 'none');

      const sidebarHeading = document.createElement('div');
      sidebarHeading.className = 'preferences-subheading';
      sidebarHeading.textContent = t('appearance.sidebarViews');
      container.appendChild(sidebarHeading);

      const views = appState.preferences.sidebarViews ?? { gitPanel: true, sessionHistory: true, discussions: true, fileTree: true, costFooter: true, activeSessions: true };
      const toggles: { key: keyof SidebarViews; label: string }[] = [
        { key: 'fileTree', label: t('appearance.fileTree') },
        { key: 'gitPanel', label: t('appearance.gitPanel') },
        { key: 'sessionHistory', label: t('appearance.sessionHistory') },
        { key: 'discussions', label: t('appearance.discussions') },
        { key: 'costFooter', label: 'Cost footer' },
        { key: 'activeSessions', label: t('appearance.activeSessions') },
      ];

      const checkboxes = {} as Record<keyof SidebarViews, HTMLInputElement>;
      for (const toggle of toggles) {
        const { row, checkbox } = toggleRow(`pref-sidebar-${toggle.key}`, toggle.label, views[toggle.key] ?? true);
        container.appendChild(row);
        checkboxes[toggle.key] = checkbox;
      }
      sidebarCheckboxes = checkboxes;

      const statusHeading = document.createElement('div');
      statusHeading.className = 'preferences-subheading';
      statusHeading.textContent = t('appearance.activeSessionStatuses');
      container.appendChild(statusHeading);

      const statuses = appState.preferences.activeSessionStatuses ?? DEFAULT_ACTIVE_SESSION_STATUSES;
      const statusToggles: { key: keyof ActiveStatuses; label: string }[] = [
        { key: 'working', label: t('help.status.working') },
        { key: 'input', label: t('help.status.input') },
        { key: 'waiting', label: t('help.status.waiting') },
        { key: 'completed', label: t('help.status.completed') },
      ];
      const statusBoxes = {} as Record<keyof ActiveStatuses, HTMLInputElement>;
      for (const toggle of statusToggles) {
        const { row, checkbox } = toggleRow(`pref-active-status-${toggle.key}`, toggle.label, statuses[toggle.key] ?? DEFAULT_ACTIVE_SESSION_STATUSES[toggle.key]);
        container.appendChild(row);
        statusBoxes[toggle.key] = checkbox;
      }
      statusCheckboxes = statusBoxes;

      const boardHeading = document.createElement('div');
      boardHeading.className = 'preferences-subheading';
      boardHeading.textContent = t('appearance.board');
      container.appendChild(boardHeading);

      const boardMetrics = toggleRow('pref-board-card-metrics', t('appearance.showMetricsOnCards'), appState.preferences.boardCardMetrics ?? true);
      boardCardMetricsCheckbox = boardMetrics.checkbox;
      container.appendChild(boardMetrics.row);
    },

    save() {
      if (themeSelect) appState.setPreference('theme', themeSelect.getValue() as 'dark' | 'light');
      if (sidebarCheckboxes) {
        appState.setPreference('sidebarViews', {
          gitPanel: sidebarCheckboxes.gitPanel.checked,
          sessionHistory: sidebarCheckboxes.sessionHistory.checked,
          discussions: sidebarCheckboxes.discussions.checked,
          fileTree: sidebarCheckboxes.fileTree.checked,
          costFooter: sidebarCheckboxes.costFooter.checked,
          activeSessions: sidebarCheckboxes.activeSessions.checked,
        });
      }
      if (backdropModeSelect && backdropDimSlider && backdropSurfaceSlider) {
        const mode = backdropModeSelect.getValue() as TerminalBackgroundMode;
        appState.setPreference('terminalBackgroundMode', mode);
        appState.setPreference('terminalBackgroundPresetId', backdropPresetSelect?.getValue() ?? 'metro');
        appState.setPreference('terminalBackgroundImagePath', mode === 'custom' ? backdropImagePath : null);
        appState.setPreference('terminalBackgroundDim', Math.min(100, Math.max(0, Number.parseInt(backdropDimSlider.value, 10))) / 100);
        appState.setPreference('terminalBackgroundSurfaceAlpha', Math.min(100, Math.max(0, Number.parseInt(backdropSurfaceSlider.value, 10))) / 100);
      }
      if (statusCheckboxes) {
        appState.setPreference('activeSessionStatuses', {
          working: statusCheckboxes.working.checked,
          waiting: statusCheckboxes.waiting.checked,
          input: statusCheckboxes.input.checked,
          completed: statusCheckboxes.completed.checked,
        });
      }
      if (boardCardMetricsCheckbox && boardCardMetricsCheckbox.checked !== (appState.preferences.boardCardMetrics ?? true)) {
        appState.setPreference('boardCardMetrics', boardCardMetricsCheckbox.checked);
      }
    },

    onLeave() {
      unsubZoom();
    },

    destroy() {
      unsubZoom();
      if (themeSelect) themeSelect.destroy();
      if (zoomSelect) zoomSelect.destroy();
      if (backdropModeSelect) backdropModeSelect.destroy();
      if (backdropPresetSelect) backdropPresetSelect.destroy();
      themeSelect = null;
      zoomSelect = null;
      backdropModeSelect = null;
      backdropPresetSelect = null;
      // Re-apply the persisted backdrop so a cancelled live-preview is reverted
      // (on Save, appState already holds the new values, so this is a no-op paint).
      void refreshTerminalBackdropFromPreferences(appState.preferences);
    },
  };
}
