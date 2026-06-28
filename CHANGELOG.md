# Changelog


## v0.1.0...main

[compare changes](https://github.com/huangzida/video-wall-player/compare/v0.1.0...main)

### 🚀 Enhancements

- 音频墙 — isAudioChunk 识别 mp3、demo mp3/wav 源切换、占位图标正圆 ([629a33b](https://github.com/huangzida/video-wall-player/commit/629a33b))

### 🩹 Fixes

- **core:** 同 URL 片段切换从头播放 — 音频墙单文件多片段 ([409e076](https://github.com/huangzida/video-wall-player/commit/409e076))
- **core:** 控制栏与 tile 静音冲突 — 单 perTile 真相去全局 OR ([7d0c57f](https://github.com/huangzida/video-wall-player/commit/7d0c57f))

### 💅 Refactors

- **demo:** CanvasWall 配置并入 DemoSettings + 分组折叠 ([04edd07](https://github.com/huangzida/video-wall-player/commit/04edd07))

### ❤️ Contributors

- Huangzida <398926656@qq.com>

## v0.0.12...main

[compare changes](https://github.com/huangzida/video-wall-player/compare/v0.0.12...main)

### 🚀 Enhancements

- **canvas-wall:** Add pixi.js dependency and type definitions ([28afcc1](https://github.com/huangzida/video-wall-player/commit/28afcc1))
- **canvas-wall:** Add useVideoSources hook for hidden video pool and batch loading ([4850ee1](https://github.com/huangzida/video-wall-player/commit/4850ee1))
- **canvas-wall:** Add useCanvasWall hook for pixijs rendering and layout ([8e0dd0b](https://github.com/huangzida/video-wall-player/commit/8e0dd0b))
- **canvas-wall:** Add useCanvasInteraction hook for double-tap focus ([00ef09c](https://github.com/huangzida/video-wall-player/commit/00ef09c))
- **canvas-wall:** Add CanvasWallPlayer component and export ([b767190](https://github.com/huangzida/video-wall-player/commit/b767190))
- **canvas-wall:** Add demo page for CanvasWallPlayer ([4fb73a7](https://github.com/huangzida/video-wall-player/commit/4fb73a7))
- **video-wall:** Add seek sync to VideoWallPlayer switchChunk ([0c2ae21](https://github.com/huangzida/video-wall-player/commit/0c2ae21))
- **canvas-wall:** Add useTextureMode prop to toggle bridge vs direct Texture.from(video) ([b359759](https://github.com/huangzida/video-wall-player/commit/b359759))
- ⚠️  Headless 重构 — 提取 useMediaSync/useVideoWall 核心并解耦 PlayerControls ([22306af](https://github.com/huangzida/video-wall-player/commit/22306af))
- 键盘快捷键 — 分段导航 / tile 聚焦 / Canvas 键盘补齐 ([eab4c54](https://github.com/huangzida/video-wall-player/commit/eab4c54))
- 自定义分段名 segmentNames + 音量图标两档视觉反馈 ([5fc386f](https://github.com/huangzida/video-wall-player/commit/5fc386f))

### 🔥 Performance

- **canvas-wall:** Seek sync fix + 3 performance optimizations ([73b4a3e](https://github.com/huangzida/video-wall-player/commit/73b4a3e))
- **canvas-wall:** Grill-me review optimizations ([8a56756](https://github.com/huangzida/video-wall-player/commit/8a56756))
- Remove debug logging, simplify stall recovery, optimize ticker ([dfd4a22](https://github.com/huangzida/video-wall-player/commit/dfd4a22))

### 🩹 Fixes

- **canvas-wall:** Fix PixiJS v8 async init, local test.mp4, tailwind styles ([126e908](https://github.com/huangzida/video-wall-player/commit/126e908))
- **canvas-wall:** Fix layout sizing, container positioning, controls placement ([5a8f55a](https://github.com/huangzida/video-wall-player/commit/5a8f55a))
- **canvas-wall:** Fix template ref binding for container elements ([6bd53a9](https://github.com/huangzida/video-wall-player/commit/6bd53a9))
- **canvas-wall:** Center layout, fix texture creation timing, fix settings overlap ([c1a611d](https://github.com/huangzida/video-wall-player/commit/c1a611d))
- **canvas-wall:** Use native ticker.maxFPS and Texture.from for correct GPU texture init ([9f09d52](https://github.com/huangzida/video-wall-player/commit/9f09d52))
- **canvas-wall:** Create texture only after video playing to fix GL_INVALID_OPERATION race ([7f1f31f](https://github.com/huangzida/video-wall-player/commit/7f1f31f))
- **demo:** Scope DemoSettings to DOM mode only ([bd9da7f](https://github.com/huangzida/video-wall-player/commit/bd9da7f))
- **demo:** Move switch button to end of DOM with z-index 99999 ([acc7760](https://github.com/huangzida/video-wall-player/commit/acc7760))
- **demo:** Move canvas settings panel to right side ([de6b270](https://github.com/huangzida/video-wall-player/commit/de6b270))
- **canvas-wall:** Use requestVideoFrameCallback to wait for first frame before texture creation ([1260763](https://github.com/huangzida/video-wall-player/commit/1260763))
- **canvas-wall:** Skip reload if same src already loaded or loading to prevent request cancellation ([b33d118](https://github.com/huangzida/video-wall-player/commit/b33d118))
- **canvas-wall:** Use PixiJS VideoSource.load() Promise for proper GPU texture allocation ([f62712a](https://github.com/huangzida/video-wall-player/commit/f62712a))
- **canvas-wall:** Use 2D canvas bridge to bypass Chrome video texture bug ([976523f](https://github.com/huangzida/video-wall-player/commit/976523f))
- **canvas-wall:** Manually update texture source after drawImage - CanvasSource doesn't auto-detect canvas changes ([cdcc54c](https://github.com/huangzida/video-wall-player/commit/cdcc54c))
- **canvas-wall:** Skip drawFrame when paused to avoid unnecessary range requests ([3b75119](https://github.com/huangzida/video-wall-player/commit/3b75119))
- **canvas-wall:** Implement double-tap focus with manual hit testing ([2bb123a](https://github.com/huangzida/video-wall-player/commit/2bb123a))
- **canvas-wall:** Reserve 48px bottom space for control bar to avoid overlap ([206f825](https://github.com/huangzida/video-wall-player/commit/206f825))
- **canvas-wall:** Use skipCache=true for Texture.from to avoid stale cache ([f58b8d3](https://github.com/huangzida/video-wall-player/commit/f58b8d3))
- Copy demo mp4 files to dist-pages during build ([fd76e6c](https://github.com/huangzida/video-wall-player/commit/fd76e6c))
- **VideoWallPlayer:** 修复全屏切换逻辑并补全主题样式引入 ([619d315](https://github.com/huangzida/video-wall-player/commit/619d315))
- **core:** Review 修复 — 卡顿退避/seek timer/resource 重载/ref 稳定 ([0955399](https://github.com/huangzida/video-wall-player/commit/0955399))
- **core:** 片段自然换段消除 seekAllLocal(0) 的 3s 超时 ([f40d90c](https://github.com/huangzida/video-wall-player/commit/f40d90c))
- Lib build 类型错误 — CanvasWallPlayer 传 wall.normalized 给 useCanvasWall ([8b1f02b](https://github.com/huangzida/video-wall-player/commit/8b1f02b))

### 📖 Documentation

- Add CanvasWallPlayer docs, fix demo video 404 on GitHub Pages ([1229c1b](https://github.com/huangzida/video-wall-player/commit/1229c1b))
- README 更新 — segmentNames 示例 + 键盘快捷键表补全 [ ] 1-9 0 ([35e3526](https://github.com/huangzida/video-wall-player/commit/35e3526))
- 修正 README peer deps — @vueuse/core 是 dependency 不是 peer ([d30be8a](https://github.com/huangzida/video-wall-player/commit/d30be8a))

### 🏡 Chore

- Upgrade Vite 5 → 8 (Rolldown bundler) + plugin-vue 6 + plugin-dts 5 ([458da5e](https://github.com/huangzida/video-wall-player/commit/458da5e))
- Remove dist-pages from git tracking (gitignored) ([e507e00](https://github.com/huangzida/video-wall-player/commit/e507e00))
- Add dist-pages to gitignore ([8bb91c8](https://github.com/huangzida/video-wall-player/commit/8bb91c8))

### 🎨 Styles

- **VideoWallPlayer:** 调整全屏和静音按钮的布局样式 ([ca2c6a9](https://github.com/huangzida/video-wall-player/commit/ca2c6a9))

#### ⚠️ Breaking Changes

- ⚠️  Headless 重构 — 提取 useMediaSync/useVideoWall 核心并解耦 PlayerControls ([22306af](https://github.com/huangzida/video-wall-player/commit/22306af))

### ❤️ Contributors

- Huangzida <398926656@qq.com>

## v0.0.12...main

[compare changes](https://github.com/huangzida/video-wall-player/compare/v0.0.12...main)

### 🚀 Enhancements

- **canvas-wall:** Add pixi.js dependency and type definitions ([28afcc1](https://github.com/huangzida/video-wall-player/commit/28afcc1))
- **canvas-wall:** Add useVideoSources hook for hidden video pool and batch loading ([4850ee1](https://github.com/huangzida/video-wall-player/commit/4850ee1))
- **canvas-wall:** Add useCanvasWall hook for pixijs rendering and layout ([8e0dd0b](https://github.com/huangzida/video-wall-player/commit/8e0dd0b))
- **canvas-wall:** Add useCanvasInteraction hook for double-tap focus ([00ef09c](https://github.com/huangzida/video-wall-player/commit/00ef09c))
- **canvas-wall:** Add CanvasWallPlayer component and export ([b767190](https://github.com/huangzida/video-wall-player/commit/b767190))
- **canvas-wall:** Add demo page for CanvasWallPlayer ([4fb73a7](https://github.com/huangzida/video-wall-player/commit/4fb73a7))
- **video-wall:** Add seek sync to VideoWallPlayer switchChunk ([0c2ae21](https://github.com/huangzida/video-wall-player/commit/0c2ae21))
- **canvas-wall:** Add useTextureMode prop to toggle bridge vs direct Texture.from(video) ([b359759](https://github.com/huangzida/video-wall-player/commit/b359759))
- ⚠️  Headless 重构 — 提取 useMediaSync/useVideoWall 核心并解耦 PlayerControls ([22306af](https://github.com/huangzida/video-wall-player/commit/22306af))
- 键盘快捷键 — 分段导航 / tile 聚焦 / Canvas 键盘补齐 ([eab4c54](https://github.com/huangzida/video-wall-player/commit/eab4c54))
- 自定义分段名 segmentNames + 音量图标两档视觉反馈 ([5fc386f](https://github.com/huangzida/video-wall-player/commit/5fc386f))

### 🔥 Performance

- **canvas-wall:** Seek sync fix + 3 performance optimizations ([73b4a3e](https://github.com/huangzida/video-wall-player/commit/73b4a3e))
- **canvas-wall:** Grill-me review optimizations ([8a56756](https://github.com/huangzida/video-wall-player/commit/8a56756))
- Remove debug logging, simplify stall recovery, optimize ticker ([dfd4a22](https://github.com/huangzida/video-wall-player/commit/dfd4a22))

### 🩹 Fixes

- **canvas-wall:** Fix PixiJS v8 async init, local test.mp4, tailwind styles ([126e908](https://github.com/huangzida/video-wall-player/commit/126e908))
- **canvas-wall:** Fix layout sizing, container positioning, controls placement ([5a8f55a](https://github.com/huangzida/video-wall-player/commit/5a8f55a))
- **canvas-wall:** Fix template ref binding for container elements ([6bd53a9](https://github.com/huangzida/video-wall-player/commit/6bd53a9))
- **canvas-wall:** Center layout, fix texture creation timing, fix settings overlap ([c1a611d](https://github.com/huangzida/video-wall-player/commit/c1a611d))
- **canvas-wall:** Use native ticker.maxFPS and Texture.from for correct GPU texture init ([9f09d52](https://github.com/huangzida/video-wall-player/commit/9f09d52))
- **canvas-wall:** Create texture only after video playing to fix GL_INVALID_OPERATION race ([7f1f31f](https://github.com/huangzida/video-wall-player/commit/7f1f31f))
- **demo:** Scope DemoSettings to DOM mode only ([bd9da7f](https://github.com/huangzida/video-wall-player/commit/bd9da7f))
- **demo:** Move switch button to end of DOM with z-index 99999 ([acc7760](https://github.com/huangzida/video-wall-player/commit/acc7760))
- **demo:** Move canvas settings panel to right side ([de6b270](https://github.com/huangzida/video-wall-player/commit/de6b270))
- **canvas-wall:** Use requestVideoFrameCallback to wait for first frame before texture creation ([1260763](https://github.com/huangzida/video-wall-player/commit/1260763))
- **canvas-wall:** Skip reload if same src already loaded or loading to prevent request cancellation ([b33d118](https://github.com/huangzida/video-wall-player/commit/b33d118))
- **canvas-wall:** Use PixiJS VideoSource.load() Promise for proper GPU texture allocation ([f62712a](https://github.com/huangzida/video-wall-player/commit/f62712a))
- **canvas-wall:** Use 2D canvas bridge to bypass Chrome video texture bug ([976523f](https://github.com/huangzida/video-wall-player/commit/976523f))
- **canvas-wall:** Manually update texture source after drawImage - CanvasSource doesn't auto-detect canvas changes ([cdcc54c](https://github.com/huangzida/video-wall-player/commit/cdcc54c))
- **canvas-wall:** Skip drawFrame when paused to avoid unnecessary range requests ([3b75119](https://github.com/huangzida/video-wall-player/commit/3b75119))
- **canvas-wall:** Implement double-tap focus with manual hit testing ([2bb123a](https://github.com/huangzida/video-wall-player/commit/2bb123a))
- **canvas-wall:** Reserve 48px bottom space for control bar to avoid overlap ([206f825](https://github.com/huangzida/video-wall-player/commit/206f825))
- **canvas-wall:** Use skipCache=true for Texture.from to avoid stale cache ([f58b8d3](https://github.com/huangzida/video-wall-player/commit/f58b8d3))
- Copy demo mp4 files to dist-pages during build ([fd76e6c](https://github.com/huangzida/video-wall-player/commit/fd76e6c))
- **VideoWallPlayer:** 修复全屏切换逻辑并补全主题样式引入 ([619d315](https://github.com/huangzida/video-wall-player/commit/619d315))
- **core:** Review 修复 — 卡顿退避/seek timer/resource 重载/ref 稳定 ([0955399](https://github.com/huangzida/video-wall-player/commit/0955399))
- **core:** 片段自然换段消除 seekAllLocal(0) 的 3s 超时 ([f40d90c](https://github.com/huangzida/video-wall-player/commit/f40d90c))

### 📖 Documentation

- Add CanvasWallPlayer docs, fix demo video 404 on GitHub Pages ([1229c1b](https://github.com/huangzida/video-wall-player/commit/1229c1b))
- README 更新 — segmentNames 示例 + 键盘快捷键表补全 [ ] 1-9 0 ([35e3526](https://github.com/huangzida/video-wall-player/commit/35e3526))
- 修正 README peer deps — @vueuse/core 是 dependency 不是 peer ([d30be8a](https://github.com/huangzida/video-wall-player/commit/d30be8a))

### 🏡 Chore

- Upgrade Vite 5 → 8 (Rolldown bundler) + plugin-vue 6 + plugin-dts 5 ([458da5e](https://github.com/huangzida/video-wall-player/commit/458da5e))
- Remove dist-pages from git tracking (gitignored) ([e507e00](https://github.com/huangzida/video-wall-player/commit/e507e00))
- Add dist-pages to gitignore ([8bb91c8](https://github.com/huangzida/video-wall-player/commit/8bb91c8))

### 🎨 Styles

- **VideoWallPlayer:** 调整全屏和静音按钮的布局样式 ([ca2c6a9](https://github.com/huangzida/video-wall-player/commit/ca2c6a9))

#### ⚠️ Breaking Changes

- ⚠️  Headless 重构 — 提取 useMediaSync/useVideoWall 核心并解耦 PlayerControls ([22306af](https://github.com/huangzida/video-wall-player/commit/22306af))

### ❤️ Contributors

- Huangzida <398926656@qq.com>

## v0.0.11...main

[compare changes](https://github.com/huangzida/video-wall-player/compare/v0.0.11...main)

### 🚀 Enhancements

- **video-player:** 新增视频卡顿自动跳帧恢复功能 ([f31ef27](https://github.com/huangzida/video-wall-player/commit/f31ef27))

### 🏡 Chore

- 更新 .cursorrules 文件中的注释格式 ([35fdf2c](https://github.com/huangzida/video-wall-player/commit/35fdf2c))

### ❤️ Contributors

- Huangzida <398926656@qq.com>

## v0.0.10...main

[compare changes](https://github.com/huangzida/video-wall-player/compare/v0.0.10...main)

### 🚀 Enhancements

- 新增玻璃主题样式 ([899a1c5](https://github.com/huangzida/video-wall-player/commit/899a1c5))
- **VideoWallPlayer:** 新增布局模式与键盘快捷键支持 ([bb352b6](https://github.com/huangzida/video-wall-player/commit/bb352b6))
- **video-wall:** 为视频格添加全屏按钮和错误处理 ([84e56c9](https://github.com/huangzida/video-wall-player/commit/84e56c9))
- 更新视频墙播放器配置与文档 ([4749e67](https://github.com/huangzida/video-wall-player/commit/4749e67))
- 更新视频墙播放器的样式和构建配置 ([798c87b](https://github.com/huangzida/video-wall-player/commit/798c87b))

### 📦 Build

- 更新构建产物的哈希值引用 ([d69d5df](https://github.com/huangzida/video-wall-player/commit/d69d5df))

### 🏡 Chore

- Update pnpm/action-setup to version 4 in workflows ([732aeb7](https://github.com/huangzida/video-wall-player/commit/732aeb7))

### ❤️ Contributors

- Huangzida <398926656@qq.com>

## v0.0.9...main

[compare changes](https://github.com/huangzida/video-wall-player/compare/v0.0.9...main)

### 🩹 Fixes

- **VideoWallPlayer:** 修复视频墙项目尺寸计算和演示资源生成 ([04d47c6](https://github.com/huangzida/video-wall-player/commit/04d47c6))

### ❤️ Contributors

- Huangzida <398926656@qq.com>

## v0.0.8...main

[compare changes](https://github.com/huangzida/video-wall-player/compare/v0.0.8...main)

### 🚀 Enhancements

- **controls:** 添加控制栏尺寸配置选项 ([a9a1bc0](https://github.com/huangzida/video-wall-player/commit/a9a1bc0))

### 📖 Documentation

- 更新中英文README文档 ([8175359](https://github.com/huangzida/video-wall-player/commit/8175359))

### ❤️ Contributors

- Huangzida <398926656@qq.com>

## v0.0.7...main

[compare changes](https://github.com/huangzida/video-wall-player/compare/v0.0.7...main)

### 🩹 Fixes

- Include tailwind styles in library bundle ([18ded0a](https://github.com/huangzida/video-wall-player/commit/18ded0a))

### ❤️ Contributors

- Huangzida <398926656@qq.com>

## v0.0.6...main

[compare changes](https://github.com/huangzida/video-wall-player/compare/v0.0.6...main)

### 🏡 Chore

- Use --all flag in bumpp to include changelog in release commit ([a1bb0e7](https://github.com/huangzida/video-wall-player/commit/a1bb0e7))

### ❤️ Contributors

- Huangzida <398926656@qq.com>

## v0.0.5...main

[compare changes](https://github.com/huangzida/video-wall-player/compare/v0.0.5...main)

### 🏡 Chore

- Ensure version bump creates a commit ([b371d37](https://github.com/huangzida/video-wall-player/commit/b371d37))

### ❤️ Contributors

- Huangzida <398926656@qq.com>

## v0.0.3...main

[compare changes](https://github.com/huangzida/video-wall-player/compare/v0.0.3...main)

### 🏡 Chore

- 添加 .nvmrc 文件以指定 Node.js 版本 ([0e4675c](https://github.com/huangzida/video-wall-player/commit/0e4675c))

### ❤️ Contributors

- Huangzida <398926656@qq.com>

## v0.0.3...v0.0.3

[compare changes](https://github.com/huangzida/video-wall-player/compare/v0.0.3...v0.0.3)

## v0.0.2...main

[compare changes](https://github.com/huangzida/video-wall-player/compare/v0.0.2...main)

### 🩹 Fixes

- **ci:** Add registry-url to setup-node for npm publish auth ([d81d9fc](https://github.com/huangzida/video-wall-player/commit/d81d9fc))

### ❤️ Contributors

- Huangzida <398926656@qq.com>

## v0.0.1...main

[compare changes](https://github.com/huangzida/video-wall-player/compare/v0.0.1...main)

### 📖 Documentation

- 更新文档中引用的构建资源文件名 ([2d2153e](https://github.com/huangzida/video-wall-player/commit/2d2153e))

### 🏡 Chore

- Track CHANGELOG.md and fix release script to include it ([34dd571](https://github.com/huangzida/video-wall-player/commit/34dd571))

### ❤️ Contributors

- Huangzida <398926656@qq.com>

## ...main


### 🚀 Enhancements

- Add github pages demo ([c0ca5a9](https://github.com/huangzida/video-wall-player/commit/c0ca5a9))
- **VideoWallPlayer:** 新增组件属性以增强配置灵活性 ([ab93036](https://github.com/huangzida/video-wall-player/commit/ab93036))
- Add tag color support and update docs ([03ec277](https://github.com/huangzida/video-wall-player/commit/03ec277))
- Add sidebarWidth and wallPadding props ([48ddc2f](https://github.com/huangzida/video-wall-player/commit/48ddc2f))
- Add videoWallPadding prop ([c4b92a6](https://github.com/huangzida/video-wall-player/commit/c4b92a6))

### 🩹 Fixes

- **播放器:** 修正视频墙自动播放和播放速率显示问题 ([1c3472d](https://github.com/huangzida/video-wall-player/commit/1c3472d))
- Resolve build errors and update types ([7ad0205](https://github.com/huangzida/video-wall-player/commit/7ad0205))

### 📖 Documentation

- Update README.zh-CN with live demo link ([0720455](https://github.com/huangzida/video-wall-player/commit/0720455))
- **github-pages-demo:** 更新任务和检查清单为已完成状态 ([582a22d](https://github.com/huangzida/video-wall-player/commit/582a22d))
- Update theme styles, add tags tooltips, and sync readmes ([e33f3ef](https://github.com/huangzida/video-wall-player/commit/e33f3ef))

### 🏡 Chore

- Remove wallPadding prop and set default videoWallPadding to 10 ([e0e76b6](https://github.com/huangzida/video-wall-player/commit/e0e76b6))
- 更新构建产物并调整样式类名 ([41babcb](https://github.com/huangzida/video-wall-player/commit/41babcb))

### 🎨 Styles

- **ui:** 更新 VideoWallPlayer 和 PlayerControls 的视觉样式 ([2ebe2cd](https://github.com/huangzida/video-wall-player/commit/2ebe2cd))

### ❤️ Contributors

- Huangzida <398926656@qq.com>

