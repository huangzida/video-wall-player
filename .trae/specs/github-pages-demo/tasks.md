# 任务列表

- [x] 任务 1：搭建演示构建环境
  - [x] 安装 `vite` 和 `@vitejs/plugin-vue` 作为开发依赖。
  - [x] 创建 `vite.config.ts`，配置构建输出到 `docs/` 目录，并设置 base URL 为 `/video-wall-player/`。
  - [x] 在 `package.json` 中添加 `demo:build` 脚本。

- [x] 任务 2：创建演示应用
  - [x] 创建 `demo/index.html` 作为入口文件。
  - [x] 创建 `demo/main.ts` 用于挂载 Vue 应用。
  - [x] 创建 `demo/App.vue`，引入 `VideoWallPlayer` 组件并使用稳定测试视频流（如 `https://test-streams.mux.dev/x36xhzz/x36xhzz.mp4`）。
  - [x] 确保演示应用正确引入本地组件（从 `src` 或 `dist`）。

- [x] 任务 3：构建并验证演示
  - [x] 运行 `npm run demo:build` (或 `pnpm`)。
  - [x] 验证 `docs/` 目录下是否生成了 `index.html` 和相关资源。
  - [x] (可选) 本地预览 `docs/` 目录确保运行正常。

- [x] 任务 4：更新文档和元数据
  - [x] 更新 `package.json` 的 `author` 字段，格式："用户名 <邮箱> + 演示地址"。
  - [x] 更新 `README.md`，添加“## 在线演示”小节，并附上链接 `[点击查看 Live Demo](https://huangzida.github.io/video-wall-player/)`。

- [x] 任务 5：提交并推送
  - [x] 提交所有更改，包括生成的 `docs/` 文件夹。
  - [x] 推送到默认分支。
