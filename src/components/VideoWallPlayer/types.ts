export interface VideoWallTag {
  id?: string | number;
  time: number;
  name: string;
  color?: string;
}

export interface VideoWallResource {
  id: string;
  name: string;
  chunkUrls: string[];
  durations: number[];
  poster?: string;
}

export type VideoWallTheme = 'default' | 'cyberpunk' | 'industrial' | 'minimalist';
