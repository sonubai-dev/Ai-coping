export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  language: 'javascript' | 'typescript' | 'python' | 'html';
  lastModified: number;
}

export interface File {
  id: string;
  projectId: string;
  name: string;
  content: string;
  language: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string;
  timestamp: number;
  thinking?: boolean;
}

export type AIComplexity = 'low' | 'high' | 'research';

export interface ExecutionResult {
  output: string;
  error?: string;
  executionTime: string;
}

export interface DebugStep {
  line: number;
  variables: Record<string, string>;
  output?: string;
}

export interface DebugState {
  isActive: boolean;
  isPaused: boolean;
  currentStepIndex: number;
  trace: DebugStep[];
  breakpoints: number[];
  variables: Record<string, string>;
}

export interface ExecutionLogEntry {
  id: string;
  projectId: string;
  timestamp: number;
  codeSnippet: string;
  language: string;
  output: string;
  executionTimeStr: string;
}