import { execFile, spawnSync } from 'child_process';
import { shell } from 'electron';

function isWsl(): boolean {
  return process.platform === 'linux' && Boolean(process.env.WSL_DISTRO_NAME);
}

/**
 * WSL filesystem path → Windows path (e.g. `\\wsl.localhost\Distro\home\...`) for Warp, which runs on Windows.
 */
function wslPathToWindowsPath(cwd: string): string {
  const r = spawnSync('wslpath', ['-w', cwd], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    const err = r.stderr?.trim() || r.error?.message || 'wslpath failed';
    throw new Error(err);
  }
  return r.stdout.trim();
}

function buildWarpUrl(pathForWarp: string, mode: 'tab' | 'window'): string {
  const action = mode === 'window' ? 'new_window' : 'new_tab';
  return `warp://action/${action}?path=${encodeURIComponent(pathForWarp)}`;
}

/**
 * Open a `warp://` URI. In WSL, `shell.openExternal` uses Linux handlers and Warp is registered on
 * Windows — use `cmd.exe /c start` so the host OS opens the protocol handler.
 */
function execCmdStart(url: string, cmdPath: string, reject: (e: Error) => void, resolve: () => void): void {
  execFile(
    cmdPath,
    ['/c', 'start', '', url],
    { windowsHide: true },
    (err) => (err ? reject(err) : resolve()),
  );
}

function tryCmdStart(url: string, cmdPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execCmdStart(url, cmdPath, reject, resolve);
  });
}

export async function openWarpUrl(url: string): Promise<void> {
  if (!isWsl()) {
    await shell.openExternal(url);
    return;
  }
  try {
    await tryCmdStart(url, 'cmd.exe');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e?.code !== 'ENOENT') throw err;
    await tryCmdStart(url, '/mnt/c/Windows/System32/cmd.exe');
  }
}

/**
 * Open Warp at a directory (see https://docs.warp.dev/features/uri-scheme).
 */
export async function openInWarp(cwd: string, mode: 'tab' | 'window'): Promise<void> {
  if (typeof cwd !== 'string' || cwd.length === 0) {
    throw new Error('cwd is required');
  }
  const pathForWarp = isWsl() ? wslPathToWindowsPath(cwd) : cwd;
  const url = buildWarpUrl(pathForWarp, mode);
  await openWarpUrl(url);
}
