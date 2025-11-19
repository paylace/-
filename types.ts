
export interface TranslatedItem {
  original: string;
  translated: string;
  box_2d: number[]; // [ymin, xmin, ymax, xmax] normalized to 1000
}

export interface TranslationResult {
  items: TranslatedItem[];
  summary: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  summary: string;
  fullText: string; // Concatenated text for offline reading
}

export interface LanguagePack {
  id: string;
  name: string;
  size: string;
  isDownloaded: boolean;
  description: string;
}

export enum AppState {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  ERROR = 'ERROR',
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}
