import * as fs from 'fs';
import type { ReadinessCheck } from '../../shared/types';
import { getGitTrackedFiles } from '../git-status';

export { readFileSafe, fileExists, dirExists, readDirSafe } from '../fs-utils';

export function getTrackedFiles(projectPath: string): string[] {
  return getGitTrackedFiles(projectPath);
}

/**
 * Counts lines in a file without reading the entire content into a single string.
 * Uses a buffer-based approach to avoid large string allocations.
 *
 * If `maxLines` is provided, stops reading once the count exceeds it and returns
 * `maxLines + 1`. Callers that only need a "≤ threshold or not" answer should
 * pass the threshold to skip scanning the rest of huge files.
 */
export function countFileLines(filePath: string, maxLines?: number): number {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(64 * 1024);
    let lines = 0;
    let bytesRead: number;
    outer: while ((bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0x0a) {
          lines++;
          if (maxLines !== undefined && lines > maxLines) break outer;
        }
      }
    }
    if (maxLines !== undefined && lines > maxLines) return lines;
    const stat = fs.fstatSync(fd);
    if (stat.size > 0) lines++;
    return lines;
  } finally {
    fs.closeSync(fd);
  }
}

export function computeCategoryScore(checks: ReadinessCheck[]): number {
  const totalMax = checks.reduce((sum, c) => sum + c.maxScore, 0);
  const totalScore = checks.reduce((sum, c) => sum + c.score, 0);
  return totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
}

