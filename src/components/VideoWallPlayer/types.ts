// Wall-specific types (theme + layout mode).
//
// The generic media types — MediaResource, PlayerState, ControlSize, TimelineTag —
// live in ../../core/types and players import directly from there. This file
// holds only DOM-player-only concepts that have no meaning outside a video wall.

export type VideoWallTheme = 'default' | 'cyberpunk' | 'industrial' | 'minimalist' | 'glass';

export type VideoWallLayoutMode = 'auto' | '1x1' | '2x2' | '3x3' | '4x4' | '1+5' | '1+7';
