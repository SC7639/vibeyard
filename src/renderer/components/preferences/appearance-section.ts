import { appState } from '../../state.js';
import { createCustomSelect, type CustomSelectInstance } from '../custom-select.js';
import { applyZoom, getZoomFactor, ZOOM_STEPS } from '../../zoom.js';
import { t } from '../../i18n.js';
import type { PreferencesContext, SectionController } from './section.js';
import { toggleRow } from './shared.js';
import type { Preferences, TerminalBackgroundMode, TerminalBackdropPreferences } from '../../../shared/types.js';
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
  // Keep the profile list in sync when a profile/shortcut changes prefs while the modal is open.
  let unsubPrefsSync: (() => void) | null = null;
  let unsubProfilesSync: (() => void) | null = null;

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

  function unsubProfileSync() {
    unsubPrefsSync?.();
    unsubPrefsSync = null;
    unsubProfilesSync?.();
    unsubProfilesSync = null;
  }

  /** Backdrop snapshot from the current control values (saved prefs when controls aren't built). */
  function currentBackdropFromControls(): TerminalBackdropPreferences {
    const p = appState.preferences;
    if (!backdropModeSelect || !backdropDimSlider || !backdropSurfaceSlider) {
      return {
        terminalBackgroundMode: p.terminalBackgroundMode ?? 'none',
        terminalBackgroundPresetId: p.terminalBackgroundPresetId ?? 'metro',
        terminalBackgroundImagePath: p.terminalBackgroundImagePath ?? null,
        terminalBackgroundDim: p.terminalBackgroundDim ?? 0.28,
        terminalBackgroundSurfaceAlpha: p.terminalBackgroundSurfaceAlpha ?? 0.88,
      };
    }
    const mode = backdropModeSelect.getValue() as TerminalBackgroundMode;
    return {
      terminalBackgroundMode: mode,
      terminalBackgroundPresetId: backdropPresetSelect?.getValue() ?? p.terminalBackgroundPresetId ?? 'metro',
      terminalBackgroundImagePath: mode === 'custom' ? backdropImagePath : null,
      terminalBackgroundDim: Math.min(100, Math.max(0, Number.parseInt(backdropDimSlider.value, 10))) / 100,
      terminalBackgroundSurfaceAlpha: Math.min(100, Math.max(0, Number.parseInt(backdropSurfaceSlider.value, 10))) / 100,
    };
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

      // --- Appearance profiles (named backdrop snapshots) ---
      const profilesHeading = document.createElement('div');
      profilesHeading.className = 'preferences-subheading';
      profilesHeading.textContent = 'Appearance profiles';
      container.appendChild(profilesHeading);

      const profilesHint = document.createElement('div');
      profilesHint.style.color = 'var(--text-muted)';
      profilesHint.style.fontSize = '12px';
      profilesHint.style.lineHeight = '1.45';
      profilesHint.style.marginBottom = '10px';
      profilesHint.textContent =
        'Save backdrop settings as named profiles and switch before meetings or screen sharing. Shortcuts apply the 1st–4th saved profile in order (bind under Shortcuts → Appearance). Switching profiles does not update the previous one — use Save to overwrite a profile.';
      container.appendChild(profilesHint);

      const activeId = appState.activeAppearanceProfileId ?? null;
      const profiles = appState.appearanceProfiles ?? [];

      const profilesToolbar = document.createElement('div');
      profilesToolbar.className = 'pref-appearance-profiles-toolbar';

      if (activeId) {
        const active = profiles.find((p) => p.id === activeId);
        const activeWrap = document.createElement('div');
        activeWrap.className = 'pref-profile-active-toolbar';
        const banner = document.createElement('div');
        banner.className = 'pref-profile-active-banner';
        const badge = document.createElement('span');
        badge.className = 'pref-profile-active-badge';
        badge.textContent = 'Active';
        badge.title = "This profile's saved backdrop is applied to the terminal";
        const nameEl = document.createElement('span');
        nameEl.className = 'pref-profile-active-banner-label';
        nameEl.textContent = active?.name ?? '(unknown)';
        banner.appendChild(badge);
        banner.appendChild(nameEl);
        const saveActiveBtn = document.createElement('button');
        saveActiveBtn.type = 'button';
        saveActiveBtn.className = 'modal-btn';
        saveActiveBtn.textContent = 'Save current look to active profile';
        saveActiveBtn.disabled = !active;
        saveActiveBtn.addEventListener('click', () => {
          appState.saveActiveAppearanceProfileBackdrop(currentBackdropFromControls());
        });
        activeWrap.appendChild(banner);
        activeWrap.appendChild(saveActiveBtn);
        profilesToolbar.appendChild(activeWrap);
      }

      const addProfileBtn = document.createElement('button');
      addProfileBtn.type = 'button';
      addProfileBtn.className = 'modal-btn';
      addProfileBtn.textContent = 'Add profile from current look';
      addProfileBtn.addEventListener('click', () => {
        appState.addAppearanceProfile(currentBackdropFromControls());
      });
      profilesToolbar.appendChild(addProfileBtn);
      container.appendChild(profilesToolbar);

      const profileList = document.createElement('div');
      profileList.className = 'pref-profile-list';

      for (const profile of profiles) {
        const row = document.createElement('div');
        row.className = 'pref-profile-row';
        const isActiveProfile = profile.id === activeId;
        if (isActiveProfile) {
          row.classList.add('pref-profile-row-active');
          row.setAttribute('aria-current', 'true');
        }

        const nameCell = document.createElement('div');
        nameCell.className = 'pref-profile-name-cell';
        const nameLine = document.createElement('div');
        nameLine.className = 'pref-profile-name-line';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'pref-profile-name-text';
        nameSpan.textContent = profile.name;
        nameLine.appendChild(nameSpan);
        if (isActiveProfile) {
          const rowBadge = document.createElement('span');
          rowBadge.className = 'pref-profile-active-badge';
          rowBadge.textContent = 'Active';
          rowBadge.title = 'Applied backdrop profile';
          nameLine.appendChild(rowBadge);
        }
        nameCell.appendChild(nameLine);

        const actions = document.createElement('div');
        actions.className = 'pref-profile-actions';

        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'modal-field-btn';
        applyBtn.textContent = isActiveProfile ? 'Active' : 'Apply';
        applyBtn.disabled = isActiveProfile;
        applyBtn.title = isActiveProfile ? 'This profile is already applied' : "Apply this profile's backdrop";
        applyBtn.addEventListener('click', () => {
          if (applyBtn.disabled) return;
          appState.applyAppearanceProfile(profile.id);
        });

        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'modal-field-btn';
        renameBtn.textContent = 'Rename';
        renameBtn.addEventListener('click', () => {
          nameCell.textContent = '';
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'pref-profile-name-input';
          input.value = profile.name;
          input.setAttribute('aria-label', 'Profile name');

          const commitRename = (): void => {
            const trimmed = input.value.trim();
            if (!trimmed) return;
            appState.renameAppearanceProfile(profile.id, trimmed);
          };

          const okBtn = document.createElement('button');
          okBtn.type = 'button';
          okBtn.className = 'modal-field-btn';
          okBtn.textContent = 'OK';
          okBtn.addEventListener('click', () => commitRename());

          const cancelBtn = document.createElement('button');
          cancelBtn.type = 'button';
          cancelBtn.className = 'modal-field-btn';
          cancelBtn.textContent = 'Cancel';
          // No state change on cancel, so re-render explicitly to restore the row.
          cancelBtn.addEventListener('click', () => ctx.rerenderSection('appearance'));

          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitRename();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelBtn.click();
            }
          });

          const btnRow = document.createElement('div');
          btnRow.className = 'pref-profile-name-edit-actions';
          btnRow.appendChild(okBtn);
          btnRow.appendChild(cancelBtn);
          nameCell.appendChild(input);
          nameCell.appendChild(btnRow);
          requestAnimationFrame(() => {
            input.focus();
            input.select();
          });
        });

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'modal-field-btn';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => {
          appState.removeAppearanceProfile(profile.id);
        });

        actions.appendChild(applyBtn);
        actions.appendChild(renameBtn);
        actions.appendChild(delBtn);
        row.appendChild(nameCell);
        row.appendChild(actions);
        profileList.appendChild(row);
      }

      container.appendChild(profileList);

      // Profile mutations emit these events; re-render so the list and Active
      // banner reflect them (also covers a shortcut/menu apply while open).
      // Registered once per visit (onLeave clears them): re-subscribing on every
      // render would happen inside the very dispatch that triggered it.
      if (!unsubPrefsSync) {
        unsubPrefsSync = appState.on('preferences-changed', () => {
          if (ctx.isActiveSection('appearance')) ctx.rerenderSection('appearance');
        });
      }
      if (!unsubProfilesSync) {
        unsubProfilesSync = appState.on('appearance-profiles-changed', () => {
          if (ctx.isActiveSection('appearance')) ctx.rerenderSection('appearance');
        });
      }

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
      // Done is closing the modal: stop re-rendering on the preference writes below.
      unsubProfileSync();
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
      unsubProfileSync();
    },

    destroy() {
      unsubZoom();
      unsubProfileSync();
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
