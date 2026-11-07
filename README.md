# NETFLEX 🎬 - Ultra-Smooth Streaming Experience

<p align="center">
  <strong>English</strong> | <a href="./README.zh-CN.md">简体中文</a>
</p>

> A high-performance, responsive streaming platform built following Netflix's signature UI/UX standards.
> Features multi-line high-speed streaming, automatic failover, personal accounts with isolated watchlists and watch history, weekly anime calendar, and bilingual support (English default & Chinese toggle).

---

## ✨ Features

- 🔴 **Netflix-Grade Immersive Experience**
  - **Billboard Hero Banner**: Dynamic poster gradients, age rating badges, 4K Ultra HD labels, and one-click immersive playback.
  - **Top 10 Today**: Iconic Netflix hollow numbers and card hover zoom effects (`Scale 1.05x`).
  - **Responsive on All Devices**: Optimized for 4K displays, laptops, tablets, and mobile smartphones with a dedicated mobile bottom bar.
  - **Native `<dialog>` Detail Modal**: Overview, cast & crew, stream line switcher, and interactive episode grid.

- 👤 **Netflix-Style Authentication & Profiles**
  - **Sign In & Sign Up Modal**: Translucent dark card with Remember Me and ReCAPTCHA styling.
  - **"Who's watching?" Profile Switcher**: Multi-profile support (e.g. Primary, Friends, Kids Zone) with distinct avatars.
  - **Data Isolation**: Watchlist and playback progress are strictly isolated per user and profile.
  - **One-Click Guest Demo**: Test all features in 0 seconds with zero configuration.

- ⚡ **Cinema Video Player**
  - Powered by **HLS.js** with hardware acceleration, automatic `m3u8` playlist recovery, and Safari/iOS native streaming support.
  - **Skip Intro (+90s)** button, along with ±10s fast forward and rewind.
  - **Playback Speed Selector** (`0.5x` to `2.0x`), volume slider, picture-in-picture, and native fullscreen.
  - Auto-hides controls after 3 seconds of inactivity.
  - Full keyboard shortcuts support (Space, arrow keys, F, M, Esc).
  - Automatically records watch progress percentage and exact timestamps for continuous episode binge-watching.

- 🌐 **Bilingual (i18n) Support**
  - **Defaults to English**, with instant one-click switching to Chinese (`zh-CN`).
  - Accessible via the navbar globe selector, profile dropdown, sign-in modal, and footer.
  - Automatically persists user language preferences in `localStorage`.

- 🚀 **Zero-Config Netlify Deployment**
  - Built-in `netlify.toml` and `netlify/functions/api.js` serverless function with CORS bypassing and anti-hotlinking proxy.

---

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite 6
- **Styling**: Tailwind CSS + Lucide React
- **Video Engine**: HLS.js (with auto error recovery & resume)
- **Local Server**: Express + Vite API Middleware
- **Cloud Hosting**: Netlify Serverless Functions

---

## 🚀 Getting Started

### Local Development

```bash
# 1. Clone repository
git clone https://github.com/li000592/netflex.git
cd netflex

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open `http://localhost:3000/` in your browser. Both the frontend and API middleware will run seamlessly under a single process.

### Production Run

```bash
# Build production bundle
npm run build

# Start production server
npm start
```

### Deploy to Netlify

1. Go to the [Netlify Dashboard](https://app.netlify.com/) and click **"Add new site" -> "Import an existing project"**.
2. Connect your GitHub repository: `li000592/netflex`.
3. Netlify will auto-detect settings from `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
4. Click **"Deploy Netflex"**. Your global HTTPS streaming site will be live within 1 minute!

---

## ⌨️ Player Shortcuts

| Key | Action |
| :--- | :--- |
| **Space** | Play / Pause |
| **← / →** | Rewind 10s / Fast Forward 10s |
| **↑ / ↓** | Volume Up / Down (10%) |
| **F** | Toggle Fullscreen |
| **M** | Mute / Unmute |
| **Esc** | Exit Fullscreen / Close Player |

---

## 📜 License

MIT License
