

export enum AppView {
  TEMPLATES = 'TEMPLATES',
  PROJECTS = 'PROJECTS',
  ASSETS = 'ASSETS',
  SETTINGS = 'SETTINGS',
  HELP = 'HELP'
}

export enum ProjectStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  credits_balance: number;
}

export interface TemplateVariable {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'image';
  placeholder?: string;
  defaultValue?: string;
}

export interface Template {
  id: string;
  name: string;
  thumbnailUrl: string;
  category: string;
  variables: TemplateVariable[];
  defaultAvatarId?: string;
  defaultVoiceId?: string;
  mode?: 'AVATAR' | 'COMPOSITION' | 'SHORTS' | 'UGC_PRODUCT'; // Distinguish editor modes
}

export interface Project {
  id: string;
  templateId: string;
  templateName: string;
  thumbnailUrl: string;
  status: ProjectStatus;
  createdAt: number;
  videoUrl?: string;
  error?: string;
  type?: 'AVATAR' | 'UGC_PRODUCT'; // Track the type of project
  cost?: number; // Cost in credits
}

export interface HeyGenAvatar {
  id: string;
  name: string;
  previewUrl: string;
  gender: 'male' | 'female';
}

export interface HeyGenVoice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female';
  previewAudio?: string; // URL to audio sample
}

export interface ScriptGenerationRequest {
  topic: string;
  tone: string;
  templateVariables: TemplateVariable[];
}

// Interface for the AI Studio key selection global
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}