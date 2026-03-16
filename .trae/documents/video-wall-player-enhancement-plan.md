# Video Wall Player Enhancement Plan

## Current Status Review
- **Core Functionality**: Multi-video playback, synchronization, seeking, volume control.
- **Layout**: Auto-grid calculation, "Glass" theme, responsive sidebar.
- **Recent Updates**: Added `VideoWallLayoutMode` types and updated `useVideoWallLayout` hook logic (backend logic ready, frontend integration pending).

## Enhancement Roadmap

### Phase 1: Advanced Layout System Integration (Immediate Priority)
The backend logic for advanced layouts (`1+5`, `1+7`, fixed grids) is ready in `useVideoWallLayout.ts`. We need to expose this to the UI.
- [ ] **Component Update**: Update `VideoWallPlayer/index.vue` to accept `layoutMode` prop.
- [ ] **Grid Implementation**: Refactor the template to use `getItemStyle(index)` for dynamic grid spans (essential for `1+5` and `1+7` focus modes).
- [ ] **Demo Update**: Add controls in `demo/App.vue` to switch between layout modes.

### Phase 2: Spotlight & Focus Interaction
Enhance user interaction by allowing quick focus on specific content.
- [ ] **Double-Click to Focus**: Implement double-click on a video tile to temporarily maximize it (toggle `1x1` mode for that specific video).
- [ ] **Focus Transitions**: Add smooth CSS transitions when switching between grid and focus views.

### Phase 3: Keyboard Shortcuts
Power user features for professional monitoring environments.
- [ ] **Global Shortcuts**:
    - `Space`: Play/Pause all
    - `F`: Toggle Fullscreen
    - `M`: Mute/Unmute all
    - `Esc`: Exit Fullscreen / Exit Focus Mode
- [ ] **Navigation**: Arrow keys for seeking (Left/Right) and Volume (Up/Down).

### Phase 4: UX Polish & Documentation
- [ ] **Loading States**: Improve visual feedback when videos are buffering.
- [ ] **Hover Effects**: Refine hover states for controls and tiles (already started with Glass theme).
- [ ] **Documentation**: Update `README.md` and `README.zh-CN.md` with new props (`layoutMode`) and shortcut guides.

## Execution Strategy
1. **Complete Phase 1** immediately to unlock the layout capabilities already partially built.
2. **Execute Phase 2 & 3** to add the requested "User Experience" enhancements.
3. **Finalize with Phase 4**.
