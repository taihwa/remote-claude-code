// ============================================================
// WebSocket Message Protocol - Shared between server and client
// ============================================================

// --- Client → Server Messages ---

export interface CreateSessionMessage {
  type: 'create_session';
  prompt: string;
  projectDir: string;
}

export interface ResumeSessionMessage {
  type: 'resume_session';
  prompt: string;
  sessionId: string;
  projectDir?: string;
}

export interface ContinueSessionMessage {
  type: 'continue_session';
  prompt: string;
}

export interface CancelMessage {
  type: 'cancel';
}

export interface ListProjectsMessage {
  type: 'list_projects';
}

export interface PermissionResponseMessage {
  type: 'permission_response';
  id: string;
  granted: boolean;
  alwaysAllow?: boolean;
}

export type ClientMessage =
  | CreateSessionMessage
  | ResumeSessionMessage
  | ContinueSessionMessage
  | CancelMessage
  | ListProjectsMessage
  | PermissionResponseMessage;

// --- Server → Client Messages ---

export interface SessionCreatedMessage {
  type: 'session_created';
  sessionId: string;
}

export interface StreamEventMessage {
  type: 'stream_event';
  data: CliStreamEvent;
}

export interface TurnCompleteMessage {
  type: 'turn_complete';
  exitCode: number | null;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export interface ProjectsMessage {
  type: 'projects';
  projects: ProjectInfo[];
}

export interface PermissionRequestMessage {
  type: 'permission_request';
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
}

export type ServerMessage =
  | SessionCreatedMessage
  | StreamEventMessage
  | TurnCompleteMessage
  | ErrorMessage
  | ProjectsMessage
  | PermissionRequestMessage;

// --- CLI stream-json Event Types ---

export interface CliSystemInit {
  type: 'system';
  subtype: 'init';
  session_id: string;
  tools: string[];
  mcp_servers?: Record<string, unknown>[];
}

export interface CliAssistantMessage {
  type: 'assistant';
  message: {
    role: 'assistant';
    content: CliContentBlock[];
    stop_reason?: string;
    model?: string;
  };
}

export interface CliResultSuccess {
  type: 'result';
  subtype: 'success';
  session_id: string;
  total_cost_usd: number;
  duration_ms: number;
  num_turns: number;
  result?: string;
}

export interface CliResultError {
  type: 'result';
  subtype: 'error';
  session_id: string;
  error: string;
  total_cost_usd: number;
  duration_ms: number;
  num_turns: number;
}

export type CliStreamEvent =
  | CliSystemInit
  | CliAssistantMessage
  | CliResultSuccess
  | CliResultError;

// --- Content Blocks ---

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<{ type: string; text?: string }>;
  is_error?: boolean;
}

export type CliContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

// --- UI Display Types ---

export interface ProjectInfo {
  path: string;
  name: string;
}

export interface SessionInfo {
  sessionId: string;
  projectDir: string;
  title?: string;
  createdAt: string;
}

// --- AskUserQuestion Types ---

export interface AskUserQuestionOption {
  label: string;
  description: string;
}

export interface AskUserQuestionItem {
  question: string;
  header: string;
  options: AskUserQuestionOption[];
  multiSelect: boolean;
}

export interface AskUserQuestionInput {
  questions: AskUserQuestionItem[];
}

// --- Chat UI Types ---

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: CliContentBlock[];
  timestamp: number;
  model?: string;
}

export interface SessionState {
  sessionId: string | null;
  projectDir: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  costUsd: number;
  durationMs: number;
}
