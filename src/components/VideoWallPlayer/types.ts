export interface VideoWallTag {
  time: number;
  name: string;
}

export interface VideoWallResource {
  id: string;
  name: string;
  chunkUrls: string[];
  durations: number[];
  poster?: string;
}

export type VideoWallTheme = 'default' | 'cyberpunk' | 'industrial' | 'minimalist';
