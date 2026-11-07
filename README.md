# NETFLEX 🎬 - 极速流媒体视觉与多源聚合系统

> 遵循 Netflix 顶级工业设计规范构建的高颜值、丝滑流畅、多端响应式的流媒体聚合平台。
> 内置 31 路经过严格测速筛选的全网高清片源，支持秒播、多线路自动故障转移、豆瓣热门同步与日本新番周历。

---

## ✨ 核心特性

- 🔴 **Netflix 级沉浸式体验**
  - **Billboard 巨幕预告 Banner**：大图渐变遮罩、动态评分、高清标签与一键沉浸式播放。
  - **Top 10 热播榜单**：Netflix 标志性空心大数字排行与卡片悬停缩放（`Scale 1.05x`）。
  - **全端响应式**：从 4K 显示器、笔记本、iPad 平板到 iPhone 手机端均完美自适应，手机端独占底部原生导航栏。
  - **原生 `<dialog>` 详情模态窗**：支持多片源并发切换、选集网格、剧情简介及演职员表。

- ⚡ **影院级播放器 (Cinema Player)**
  - 基于 **HLS.js** 打造，全自动 `m3u8` 切片流缓冲与异常恢复机制，移动端及 Safari 原生硬件加速。
  - **跳过片头 (+90s)** 经典功能，双击/按钮快进快退 10 秒。
  - 倍速调节（`0.5x` ~ `2.0x`），画中画与原生全屏切换。
  - 空闲 3 秒自动隐去控制条，全键盘快捷键支持（空格暂停、方向键调音量/快进退、F键全屏、M键静音）。
  - 自动记录每部影片的播放进度（百分比进度条与上次退出时间），支持多集连播与自动下一集。

- 🌐 **31 路全网精选高速片源**
  - **🌸 动漫专线**：魔都动漫、樱花动漫、155动漫、U酷88
  - **🔴 奈飞/海外专区**：奈飞海外(ikun)、奈飞外剧(魔都)、电影天堂、优质1080P
  - **⚡ 极速切片秒播**：滴滴资源、天涯资源、豪华资源、极速资源、光速资源、红牛资源、无尽资源、玉兔资源、速播资源
  - **🎬 超全大厂全库**：量子大厂、非凡资源、暴风资源、乐播资源、百度资源、卧龙资源、虎牙资源、金鹰资源、最大资源、索尼资源、闪电资源、360资源、猫眼资源、丫丫资源

- 🚀 **零门槛 Netlify 云端一键托管**
  - 完整配置 `netlify.toml` 与 `netlify/functions/api.js` Serverless 函数，内置反向代理与反防盗链图片中继，摆脱前端跨域 (CORS) 限制。

---

## 🛠️ 技术栈

- **前端核心**：React 19 + TypeScript + Vite 6
- **样式方案**：Tailwind CSS + Lucide React 极简拟物图标
- **流媒体引擎**：HLS.js（带硬件加速与断点续播）
- **本地服务**：Express + CORS（用于本地全功能秒开运行）
- **云端服务**：Netlify Serverless Functions（一键部署免运维）

---

## 🚀 快速启动

### 本地启动

```bash
# 1. 克隆仓库
git clone https://github.com/li000592/netflex.git
cd netflex

# 2. 安装依赖
npm install

# 3. 编译前端
npm run build

# 4. 启动聚合服务（默认运行在 http://localhost:3001）
npm start
```

启动后在浏览器打开 `http://localhost:3001` 即可体验。

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
