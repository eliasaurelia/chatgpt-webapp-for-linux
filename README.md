# ChatGPT WebApp

一个面向 Linux 的 ChatGPT 桌面 WebApp。应用基于 Electron/Chromium，主窗口加载官方 `https://chatgpt.com`，并使用独立持久会话保存网站登录态。

## 特性

- 独立 profile：ChatGPT 的 cookies、localStorage、IndexedDB 等保存在应用自己的 `userData` 目录，不共享系统浏览器数据。
- 不保存账号密码：应用只保存网站会话和本地偏好，不写入 OpenAI 账号、密码或聊天内容。
- 隐私隔离：主窗口使用 `persist:chatgpt-private` 分区，远程页面禁用 Node，启用 `contextIsolation`、`sandbox` 和 `webSecurity`。
- 平衡拦截：默认启用 Ghostery 引擎加载 EasyList 和 EasyPrivacy 网络规则，偏向拦截广告、分析和已知追踪资源，同时避免破坏 ChatGPT 登录、聊天、上传和下载。
- 外链策略：ChatGPT/OpenAI 核心登录与内容域留在应用内，普通外链交给系统浏览器。
- 聊天导出：ChatGPT 页面提供整段聊天和单条消息导出，支持 Markdown、HTML、JSON 和纯文本格式，文件通过系统保存对话框写入本地。
- Linux 桌面体验：系统标题栏、原生菜单、常用快捷键、下载保存对话框、单实例锁、窗口位置恢复、Wayland 友好启动参数。
- 启动优化：主窗口立即创建并加载 ChatGPT，追踪器规则在后台初始化，避免首次规则下载拖慢开窗。
- 无托盘：应用不会创建系统托盘图标。

## 开发

```bash
npm install
npm run dev
```

开发模式会启动 Vite 隐私面板和 Electron 主进程。主窗口仍然访问官方 `https://chatgpt.com`。

## 构建

```bash
npm run build
```

构建会输出到 `dist/`，包含主进程、预加载脚本和本地隐私面板。

## Linux 打包

```bash
npm run package:linux
```

产物输出到 `release/`：

- `ChatGPT WebApp-0.2.0.AppImage`
- `chatgpt-webapp-linux_0.2.0_amd64.deb`

## 本地数据

应用设置文件只包含窗口状态和拦截器开关，默认路径位于 Electron 的 `userData` 目录下：

- `settings.json`
- `blocker/engine-network-only.bin`
- Electron 会话目录，包括 ChatGPT 网站存储数据

隐私面板提供：

- 清除缓存
- 清除站点数据/退出登录
- 查看拦截状态
- 手动更新拦截规则
- 设置自动更新间隔

## 安全边界

这是非官方桌面封装，不使用 OpenAI 官方图标，也不会自动化或绕过 ChatGPT 登录。登录流程始终由官方网页完成。
