// Shared type definitions used across main, preload, and renderer processes.

import type { TeamDomain } from './team-config.js';

export const ZOOM_MIN = 0.75;
export const ZOOM_MAX = 2.0;

// --- Provider ---

export type ProviderId = 'claude' | 'claude-ollama' | 'codex' | 'copilot' | 'gemini';

/** User settings for the Claude Code (Ollama) provider. @see https://docs.ollama.com/integrations/claude-code */
export interface ClaudeOllamaPreferences {
  /** Anthropic-compatible API base, e.g. `http://localhost:11434` */
  baseUrl: string;
  /** Local Ollama often uses the literal value `ollama` */
  authToken: string;
  /** Per Ollama docs, often left empty for local use */
  apiKey: string;
  /** Default `--model` when a session does not set one (free text; e.g. remote Ollama) */
  defaultModel: string;
}

export const DEFAULT_CLAUDE_OLLAMA_PREFERENCES: ClaudeOllamaPreferences = {
  baseUrl: 'http://localhost:11434',
  authToken: 'ollama',
  apiKey: '',
  defaultModel: 'qwen3.5',
};
export type PendingPromptTrigger = 'session-start' | 'first-output' | 'startup-arg';

export interface CliProviderCapabilities {
  sessionResume: boolean;
  costTracking: boolean;
  contextWindow: boolean;
  hookStatus: boolean;
  configReading: boolean;
  shiftEnterNewline: boolean;
  pendingPromptTrigger: PendingPromptTrigger;
  planModeArg?: string;
  systemPromptInjection: boolean;
}

export interface CliProviderMeta {
  id: ProviderId;
  displayName: string;
  binaryName: string;
  capabilities: CliProviderCapabilities;
  defaultContextWindowSize: number;
}

// --- Git ---

export interface GitWorktree {
  path: string;
  head: string;
  branch: string | null;
  isBare: boolean;
}

export interface GitFileEntry {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';
  area: 'staged' | 'working' | 'untracked' | 'conflicted';
}

// --- Provider Config ---

export interface McpServer { name: string; url: string; status: string; scope: 'user' | 'project'; filePath: string }
export interface Agent { name: string; model: string; category: 'plugin' | 'built-in'; scope: 'user' | 'project'; filePath: string }
export interface Skill { name: string; description: string; scope: 'user' | 'project'; filePath: string }
export interface Command { name: string; description: string; scope: 'user' | 'project'; filePath: string }
export interface ProviderConfig { mcpServers: McpServer[]; agents: Agent[]; skills: Skill[]; commands: Command[] }
export type ClaudeConfig = ProviderConfig;

// --- Cost / Context (shared with renderer modules) ---

export interface CostInfo {
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalDurationMs: number;
  totalApiDurationMs: number;
  model?: string;
}

export interface ContextWindowInfo {
  totalTokens: number;
  contextWindowSize: number;
  usedPercentage: number;
}

// --- Session / State ---

export type SessionType =
  | 'mcp-inspector'
  | 'diff-viewer'
  | 'file-reader'
  | 'remote-terminal'
  | 'browser-tab'
  | 'project-tab'
  | 'kanban'
  | 'team';

export interface SessionRecord {
  id: string;
  name: string;
  type?: SessionType;
  providerId?: ProviderId;
  args?: string;
  cliSessionId: string | null;
  mcpServerUrl?: string;
  diffFilePath?: string;
  diffArea?: string;
  /** Diff viewer only: repo root used for that diff tab. */
  worktreePath?: string;
  /**
   * Terminal tabs: git status / branch menu / sidebar root. When `gitWorktreeUserPinned`
   * is set, this path was chosen explicitly; otherwise it may be synced from PTY cwd.
   */
  gitWorktreePath?: string;
  /** True when the user pinned a worktree from the menu (not PTY sync). */
  gitWorktreeUserPinned?: boolean;
  fileReaderPath?: string;
  fileReaderLine?: number;
  createdAt: string;
  userRenamed?: boolean;
  cost?: CostInfo;
  contextWindow?: ContextWindowInfo;
  remoteHostName?: string;
  shareMode?: 'readonly' | 'readwrite';
  browserTabUrl?: string;
  /** Persisted: identifies which TeamMember spawned this session, if any. */
  teamMemberId?: string;
  /** Transient: initial prompt to inject on first spawn. Not persisted. */
  pendingInitialPrompt?: string;
  /** Transient: system prompt to attach on first spawn. Not persisted (resume must not re-inject). */
  pendingSystemPrompt?: string;
}

// --- Team ---

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  description?: string;
  domain?: TeamDomain;
  systemPrompt: string;
  source: 'predefined' | 'custom';
  sourceUrl?: string;
  createdAt: number;
  updatedAt: number;
  /** When true, member is mirrored as a CLI-provider agent file at ~/.<cli>/agents/<slug>.md. */
  installAsAgent?: boolean;
  /** Sticky slug assigned on first install; preserved across renames so the right file is removed. */
  agentSlug?: string;
}

export interface TeamData {
  members: TeamMember[];
  predefinedCache?: { fetchedAt: number; suggestions: TeamMember[] };
}

export interface ArchivedSession {
  id: string;
  name: string;
  providerId: ProviderId;
  cliSessionId: string | null;
  createdAt: string;
  closedAt: string;
  /** Git worktree cwd used for this CLI session (so resume spawns in the same checkout). */
  gitWorktreePath?: string;
  gitWorktreeUserPinned?: boolean;
  bookmarked?: boolean;
  teamMemberId?: string;
  cost: {
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalDurationMs: number;
  } | null;
}

export interface InitialContextSnapshot {
  sessionId: string;
  timestamp: string;
  totalTokens: number;
  contextWindowSize: number;
  usedPercentage: number;
}

export interface DeepSearchResult {
  providerId: ProviderId;
  cliSessionId: string;
  projectSlug: string;
  projectCwd: string;
  snippet: string;
  score: number;
  /** Title derived from the first user message — fallback when Vibeyard has no name for this session. */
  derivedName?: string;
}

export interface ProjectInsightsData {
  initialContextSnapshots: InitialContextSnapshot[];
  dismissed: string[];
}

// --- Board ---

export type ColumnBehavior = 'inbox' | 'active' | 'terminal' | 'none';

export interface BoardColumn {
  id: string;
  title: string;
  order: number;
  behavior: ColumnBehavior;
  color?: string;
  locked?: boolean;
}

export interface BoardTask {
  id: string;
  title: string;
  prompt: string;
  notes?: string;
  columnId: string;
  order: number;
  sessionId?: string;
  cliSessionId?: string;
  providerId?: ProviderId;
  planMode?: boolean;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface TagDefinition {
  name: string;
  color: string;
}

export interface BoardData {
  columns: BoardColumn[];
  tasks: BoardTask[];
  tags?: TagDefinition[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  sessions: SessionRecord[];
  activeSessionId: string | null;
  layout: {
    mode: 'tabs' | 'split' | 'swarm';
    splitPanes: string[];
    splitDirection: 'horizontal' | 'vertical';
  };
  board?: BoardData;
  sessionHistory?: ArchivedSession[];
  insights?: ProjectInsightsData;
  defaultArgs?: string;
  terminalPanelOpen?: boolean;
  terminalPanelHeight?: number;
  readiness?: ReadinessResult;
  readinessHistory?: ReadinessSnapshot[];
  overviewLayout?: OverviewLayout;
  githubLastSeen?: Record<string, string>;
}

// --- Overview Widgets ---

export type OverviewWidgetType =
  | 'readiness'
  | 'provider-tools'
  | 'github-prs'
  | 'github-issues'
  | 'team'
  | 'kanban'
  | 'sessions'
  | 'favorite-sessions'
  | 'usage-stats'
  | 'top-files-by-tokens';

export interface OverviewWidget {
  id: string;
  type: OverviewWidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
}

export interface OverviewLayout {
  gridVersion: 1;
  widgets: OverviewWidget[];
}

// --- GitHub ---

export interface GithubItem {
  number: number;
  title: string;
  state: 'open' | 'closed';
  user: { login: string; avatar_url: string } | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  /** Present on issues that are PRs (Issues API includes PRs); absent on real issues. */
  pull_request?: { url: string };
  /** Optional PR-only fields populated when fetching from /pulls. */
  draft?: boolean;
  merged_at?: string | null;
  comments?: number;
  labels?: { name: string; color: string }[];
}

export interface GithubFetchResult {
  ok: boolean;
  items?: GithubItem[];
  error?: string;
}

export interface GithubRepo {
  owner: string;
  repo: string;
}

export type TerminalBackgroundMode = 'none' | 'preset' | 'custom';

/** Snapshot of terminal backdrop fields (Phase 1 appearance profiles). */
export type TerminalBackdropPreferences = Pick<
  Preferences,
  | 'terminalBackgroundMode'
  | 'terminalBackgroundPresetId'
  | 'terminalBackgroundImagePath'
  | 'terminalBackgroundDim'
  | 'terminalBackgroundSurfaceAlpha'
>;

export interface AppearanceProfile {
  id: string;
  name: string;
  backdrop: TerminalBackdropPreferences;
}

export interface Preferences {
  soundOnSessionWaiting: boolean;
  notificationsDesktop: boolean;
  debugMode: boolean;
  sessionHistoryEnabled: boolean;
  insightsEnabled: boolean;
  autoTitleEnabled: boolean;
  confirmCloseWorkingSession: boolean;
  zoomFactor?: number;
  defaultProvider?: ProviderId;
  statusLineConsent?: 'granted' | 'declined' | null;
  // The foreign statusLine command the user was asked about when they made
  // the consent decision. Used to detect new conflicts (different command)
  // vs the previously-acknowledged one.
  statusLineConsentCommand?: string | null;
  copyOnSelect?: boolean;
  keybindings?: Record<string, string>;
  theme?: 'dark' | 'light';
  readinessExcludedProviders?: ProviderId[];
  sidebarViews?: {
    gitPanel: boolean;
    sessionHistory: boolean;
    costFooter: boolean;
    discussions: boolean;
    fileTree: boolean;
  };
  /**
   * When true on Windows (and WSL is installed), spawn CLI tools inside WSL2 and resolve
   * Linux-style paths. Leave false for native Windows or when syncing preferences to macOS/Linux.
   */
  wslEnabled?: boolean;
  /** WSL distro to use. When unset, the system default distro is used. */
  wslDistro?: string;
  /**
   * Whole-app UI scale (Chromium `zoom` on `#app`). 1 = 100%. Helps on high-DPI tablets.
   */
  uiZoom?: number;
  /** xterm.js font size in CSS pixels. Default 14. */
  terminalFontSize?: number;
  /** Backdrop behind the main column (tab bar + terminals + project shell). */
  terminalBackgroundMode?: TerminalBackgroundMode;
  /** Built-in gradient id when `terminalBackgroundMode` is `preset`. */
  terminalBackgroundPresetId?: string;
  /** Absolute filesystem path when `terminalBackgroundMode` is `custom`. */
  terminalBackgroundImagePath?: string | null;
  /**
   * Extra darkening on top of the image or preset (0 = none, 1 = heavy).
   * Defaults in renderer state when missing.
   */
  terminalBackgroundDim?: number;
  /**
   * Opacity of the xterm cell background black layer (0–1). Higher = more readable, less wallpaper bleed-through.
   */
  terminalBackgroundSurfaceAlpha?: number;
  /** Settings for the Claude Code (Ollama) integration only. */
  claudeOllama?: ClaudeOllamaPreferences;
  boardCardMetrics?: boolean;
}

/** Normalize optional preference fields into a full backdrop snapshot for profiles. */
export function terminalBackdropFromPreferences(p: Preferences): TerminalBackdropPreferences {
  return {
    terminalBackgroundMode: p.terminalBackgroundMode ?? 'none',
    terminalBackgroundPresetId: p.terminalBackgroundPresetId ?? 'metro',
    terminalBackgroundImagePath: p.terminalBackgroundImagePath ?? null,
    terminalBackgroundDim: p.terminalBackgroundDim ?? 0.28,
    terminalBackgroundSurfaceAlpha: p.terminalBackgroundSurfaceAlpha ?? 0.88,
  };
}

// --- Settings Validation ---

export interface SettingsValidationResult {
  statusLine: 'missing' | 'vibeyard' | 'foreign';
  hooks: 'missing' | 'complete' | 'partial';
  foreignStatusLineCommand?: string;
  hookDetails: Record<string, boolean>;
}

export interface SettingsWarningData {
  sessionId: string;
  statusLine: SettingsValidationResult['statusLine'];
  hooks: SettingsValidationResult['hooks'];
}

export interface StatusLineConflictData {
  foreignCommand: string;
}

export interface PersistedState {
  version: 1;
  projects: ProjectRecord[];
  activeProjectId: string | null;
  preferences: Preferences;
  sidebarWidth?: number;
  sidebarCollapsed?: boolean;
  lastSeenVersion?: string;
  appLaunchCount?: number;
  starPromptDismissed?: boolean;
  discussionsLastSeen?: string;
  /** Saved terminal backdrop bundles (Appearance profiles). */
  appearanceProfiles?: AppearanceProfile[];
  /** Last profile applied via Apply / shortcut / menu (for Save-to-profile and menu radio). */
  activeAppearanceProfileId?: string | null;
  team?: TeamData;
}

// --- AI Readiness ---

export type ReadinessCheckStatus = 'pass' | 'fail' | 'warning';

export type ReadinessEffort = 'low' | 'medium' | 'high';

export interface ReadinessCheck {
  id: string;
  name: string;
  status: ReadinessCheckStatus;
  description: string;
  score: number;
  maxScore: number;
  fixPrompt?: string;
  providerIds?: ProviderId[];
  effort?: ReadinessEffort;
  impact?: number;
  rationale?: string;
}

export interface ReadinessCategory {
  id: string;
  name: string;
  weight: number;
  score: number;
  checks: ReadinessCheck[];
}

export interface ReadinessResult {
  overallScore: number;
  categories: ReadinessCategory[];
  scannedAt: string;
}

export interface ReadinessSnapshot {
  timestamp: string;
  overallScore: number;
  categoryScores: Record<string, number>;
}

// --- Cost / Context ---

export interface CostData {
  cost: { total_cost_usd: number; total_duration_ms: number; total_api_duration_ms: number };
  model?: string;
  context_window: {
    total_input_tokens: number;
    total_output_tokens: number;
    context_window_tokens?: number;
    context_window_size?: number;
    used_percentage?: number;
    current_usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    };
  };
}

// --- Tool Failure ---

export interface ToolFailureData {
  tool_name: string;
  tool_input: Record<string, unknown>;
  error: string;
}

// --- Session Inspector ---

export type InspectorEventType =
  // Core 7 (status + inspector)
  | 'session_start' | 'user_prompt' | 'tool_use' | 'tool_failure'
  | 'stop' | 'stop_failure' | 'permission_request'
  // Inspector-only events
  | 'permission_denied'
  | 'pre_tool_use'
  | 'subagent_start' | 'subagent_stop'
  | 'notification'
  | 'pre_compact' | 'post_compact'
  | 'session_end'
  | 'task_created' | 'task_completed'
  | 'worktree_create' | 'worktree_remove'
  | 'cwd_changed' | 'file_changed' | 'config_change'
  | 'elicitation' | 'elicitation_result'
  | 'instructions_loaded'
  | 'teammate_idle'
  | 'status_update';

export interface InspectorEvent {
  type: InspectorEventType;
  timestamp: number;
  hookEvent: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  error?: string;
  cost_snapshot?: { total_cost_usd: number; total_duration_ms: number };
  context_snapshot?: { total_tokens: number; context_window_size: number; used_percentage: number };
  agent_id?: string;
  agent_type?: string;
  last_assistant_message?: string;
  agent_transcript_path?: string;
  message?: string;
  task_id?: string;
  worktree_path?: string;
  cwd?: string;
  file_path?: string;
  config_key?: string;
  question?: string;
  answer?: string;
}

export interface ToolUsageStats {
  tool_name: string;
  calls: number;
  failures: number;
  totalCost: number;
}

export interface ContextDataPoint {
  timestamp: number;
  usedPercentage: number;
  totalTokens: number;
}

// --- MCP ---

export interface McpResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// --- Usage Stats ---

export interface StatsDailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface StatsModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
}

export interface StatsCache {
  version: number;
  lastComputedDate: string;
  dailyActivity: StatsDailyActivity[];
  dailyModelTokens: { date: string; tokensByModel: Record<string, number> }[];
  modelUsage: Record<string, StatsModelUsage>;
  totalSessions: number;
  totalMessages: number;
  longestSession: { sessionId: string; duration: number; messageCount: number; timestamp: string };
  firstSessionDate: string;
  hourCounts: Record<string, number>;
}

// --- Filesystem IPC ---

export type ReadFileResult =
  | { ok: true; content: string }
  | { ok: false; reason: 'binary' | 'error' };

export type FileStatResult =
  | { ok: true; size: number; mtimeMs: number }
  | { ok: false };

export interface TopFile {
  path: string;
  tokens: number;
  size: number;
}

export type TopFilesResult =
  | { ok: true; files: TopFile[]; scanned: number; skipped: number }
  | { ok: false };
