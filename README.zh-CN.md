# NETFLEX 🎬 - 极速流媒体视觉与聚合系统

<p align="center">
  <a href="./README.md">English</a> | <strong>简体中文</strong>
</p>

> 遵循 Netflix 顶级工业设计规范构建的高颜值、丝滑流畅、多端响应式的流媒体聚合平台。
> 内置全网高速高清精选片源，支持秒播、多线路自动故障转移、独立会员登录、家庭档案隔离、豆瓣热门同步与日本新番周历。默认采用英文界面，支持一键切换中文。

---

## ✨ 核心特性

- 🔴 **Netflix 级沉浸式体验**
  - **Billboard 巨幕预告 Banner**：大图渐变遮罩、动态评分、4K 超清标签与一键沉浸式播放。
  - **Top 10 今日热播榜单**：Netflix 标志性空心大数字排行与卡片悬停缩放（`Scale 1.05x`）。
  - **全端自适应响应**：从 4K 显示器、笔记本、iPad 平板到手机均完美适配，手机端独占底部原生导航栏。
  - **原生 `<dialog>` 详情模态窗**：支持多线路并发切换、选集网格、剧情简介及演职员表。

- 👤 **Netflix 级登录与多档案管理**
  - **登录 / 注册模态框**：暗黑毛玻璃卡片设计，支持自定义账号密码注册登录与“记住我”。
  - **“正在使用的是谁？”档案切换器**：支持多头像多档案（如：主人、朋友、家庭影院、少儿专区 KIDS）。
  - **独立片单与观看历史隔离**：不同用户的片单与播放进度完全隔离，换设备随时同步。
  - **⚡ 一键免密体验账号**：点击即可 0 秒免密登录体验完整的会员个人空间。

- ⚡ **影院级播放器 (Cinema Player)**
  - 基于 **HLS.js** 打造，全自动 `m3u8` 切片流缓冲与异常恢复机制，移动端及 Safari 原生硬件加速。
  - **跳过片头 (+90s)** 经典功能，双击/按钮快进快退 10 秒。
  - 倍速调节（`0.5x` ~ `2.0x`），画中画与原生全屏切换。
  - 空闲 3 秒自动隐去控制条，全键盘快捷键支持（空格暂停、方向键调音量/快进退、F键全屏、M键静音）。
  - 自动记录每部影片的播放进度（百分比进度条与上次退出时间），支持多集连播与自动下一集。

- 🌐 **双语国际化 (i18n)**
  - **默认使用英文 (English)**，支持一键切换为中文 (`zh-CN`)。
  - 导航栏地球图标、个人资料菜单、登录弹窗和页脚均可自由切换，自动保存语言偏好到 `localStorage`。

- 🚀 **零门槛 Netlify 云端一键托管**
  - 完整配置 `netlify.toml` 与 `netlify/functions/api.js` Serverless 函数，内置反向代理与反防盗链图片中继，摆脱前端跨域 (CORS) 限制。

---

## 🛠️ 技术栈

- **前端核心**：React 19 + TypeScript + Vite 6
- **样式方案**：Tailwind CSS + Lucide React 极简拟物图标
- **流媒体引擎**：HLS.js（带硬件加速与断点续播）
- **本地服务**：Express + Vite 内嵌 API 中间件
- **云端服务**：Netlify Serverless Functions（一键部署免运维）

---

## 🚀 快速启动

### 本地开发

```bash
# 1. 克隆仓库
git clone https://github.com/li000592/netflex.git
cd netflex

# 2. 安装依赖
npm install

# 3. 启动开发服务器（单命令同时启动前端与 API 中间件）
npm run dev
```

启动后在浏览器打开 `http://localhost:3000` 即可体验。

### 生产构建与启动

```bash
# 编译生产资源包
npm run build

# 启动全功能服务
npm start
```

### 部署到 Netlify

1. 在 [Netlify 控制台](https://app.netlify.com/) 点击 **"Add new site" -> "Import an existing project"**。
2. 关联 GitHub 仓库 `https://github.com/li000592/netflex.git`。
3. Netlify 会自动识别 `netlify.toml`：
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
4. 点击 **"Deploy Netflex"**，大约 1 分钟即可生成全球 CDN HTTPS 访问网址！

---

## ⌨️ 播放器快捷键

| 按键 | 功能 |
| :--- | :--- |
| **Space** | 播放 / 暂停 |
| **← / →** | 快退 10 秒 / 快进 10 秒 |
| **↑ / ↓** | 音量增大 / 减小 (10%) |
| **F** | 进入 / 退出全屏 |
| **M** | 静音 / 恢复声音 |
| **Esc** | 退出全屏 / 关闭播放器 |

---

## 📜 开源协议

MIT License
