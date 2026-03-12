# GitHub Pages 演示站点规范

## 目的
为当前项目创建并配置 GitHub Pages 演示站点，方便用户在线查看 `video-wall-player` 组件的实际效果，无需本地搭建环境。

## 变更内容
- 添加 `vite` 和 `@vitejs/plugin-vue` 作为开发依赖，用于构建演示页面。
- 创建 `demo/` 目录，包含演示应用的源代码（`index.html`, `main.ts`, `App.vue`）。
- 配置 `vite.config.ts`，将演示应用构建输出到 `docs/` 目录，以便 GitHub Pages 直接使用。
- 设置构建的 base URL 为 `/video-wall-player/`，确保在 GitHub Pages 上资源加载正确。
- 更新 `package.json`：
  - 添加 `demo:build` 脚本。
  - 更新 `author` 字段，包含演示地址。
- 更新 `README.md`：
  - 添加“在线演示”小节，并附上 GitHub Pages 链接。

## 影响范围
- **新增文件**: `demo/` 目录, `vite.config.ts`, `docs/` 目录（构建生成）。
- **修改文件**: `package.json`, `README.md`。
- **破坏性变更**: 无。

## 新增需求
### 需求：演示页面
系统应提供一个通过 GitHub Pages 访问的公开演示页面。

#### 场景：用户访问演示页面
- **当** 用户访问 `https://huangzida.github.io/video-wall-player/` 时
- **则** 视频墙播放器组件应正常显示并可用。
- **并且** 视频流（如测试流）应能自动播放或交互播放。

## 修改需求
### 需求：项目文档
- `README.md` 必须包含指向在线演示的直接链接。
- `package.json` 必须在 author 字段中包含演示 URL。
