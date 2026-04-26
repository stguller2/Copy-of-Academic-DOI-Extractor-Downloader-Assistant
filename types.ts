
export interface ReferenceItem {
  title: string;
  doi: string;
  isVerified?: boolean;
  source?: 'regex' | 'ai' | 'official';
}

export interface ExtractionResult {
  paperTitle?: string;
  references: ReferenceItem[];
  skippedCount: number;
  rawText?: string;
}

export enum AppState {
  IDLE = 'IDLE',
  EXTRACTING = 'EXTRACTING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export type CopiedState = number | string | null;
