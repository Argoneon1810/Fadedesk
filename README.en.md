# Fadedesk

[한국어](README.md) | **English**

> A studio-style per-tab audio mixer console for Chrome (Manifest V3) that controls volume, listening balance, and real-time dynamics across browser windows and background tabs—without `chrome.tabCapture` or any network requests.

---

## 1. Key Features

- **Logarithmic Per-Tab dB Faders (`-60 dB` to `+12 dB`)**: Drag the fader cap directly (preventing accidental track-click jumps), scroll with the mouse wheel (`Shift+Wheel` for `0.5 dB` fine steps), double-click for `0.0 dB` unity, or click any digital readout to type an exact dB value.
- **Mute, Solo & Generalized Focus Ducking (`Focus α`)**: Isolate tabs with `S` (`Solo`, with `0.3s` smooth recovery when closed), or enable `F` (`Focus`) to keep primary tabs at full clarity while gently ducking background tabs by the top `Focus α` amount.
- **2-Tier BS.1770 Gated Loudness Normalizer (`Level N ▾`)**: Powered by a real-time ITU-R BS.1770-4 K-weighted engine with a `-10 LU` relative gate and EBU Tech 3341 windows. Switch globally among `Music (9s)`, `Standard (3s)`, and `Night (0.4s)` presets while preserving per-strip `Follow / On / Off` overrides.
- **Dockable Per-Channel FX Rack (`FX Rack ▸`)**: Shape individual tabs with custom target loudness (`-20` to `-12 LUFS`), `Stereo Pan` (`L100 – C – R100`), `Noise Gate` (`-65` to `-30 dB`), and a `Dynamic Compressor` (`2:1 / 4:1 / 8:1`) ahead of a `-1.0 dBFS` safety peak limiter.
- **Drag-Zone Playback, Tab Jump (`↗`) & Domain Pin (`📌`)**: Drag strips across the divider to pause or resume instantly, click a strip header to focus its browser tab and window, and pin per-domain default startup volumes locally.
- **Standalone Popout Window, 4 Studio Themes & Bilingual UI**: Detach Fadedesk into a resizable console window (auto-clamped above `520×420`), choose from 4 color themes in Dark, Light, or System mode, and use full English or Korean UI with a 7-step live Spotlight Tour.

---

## 2. Keyboard Shortcuts

| Scope | Windows / Linux | macOS | Action |
| --- | --- | --- | --- |
| Global | `Alt + Shift + M` | `Control + Shift + M` | Open Fadedesk console |
| Global | `Alt + Shift + 0` | `Control + Shift + 0` | Toggle Master Mute |
| Global | `Alt + Shift + F` | `Control + Shift + F` | Cycle Focus across active media tabs |
| In Console | `←` / `→` | `←` / `→` | Select previous / next channel strip |
| In Console | `↑` / `↓` (`Shift` fine) | `↑` / `↓` (`Shift` fine) | Adjust strip gain by `±1.5 dB` (`±0.5 dB`) |
| In Console | `0` / `Space` / `Enter` | `0` / `Space` / `Enter` | Reset `0.0 dB` / Play·Pause / Jump to tab |
| In Console | `M` / `S` / `F` / `P` | `M` / `S` / `F` / `P` | Toggle Mute / Solo / Focus / Domain Pin |

---

## 3. Build & Local Installation

### Prerequisites
- **Node.js**: `v18.0.0` or newer (`v20+` recommended)

```bash
git clone https://github.com/Argoneon1810/Fadedesk.git
cd Fadedesk
npm install
npm run build
```

Build outputs:
- `dist/unpacked/`: Whitelisted unpacked extension directory for Chrome Developer Mode
- `dist/fadedesk-<version>.zip`: Chrome Web Store upload archive

### Loading in Chrome

> [!IMPORTANT]
> Load **`dist/unpacked`** (not the repository root) in `chrome://extensions`.

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the **`dist/unpacked`** folder.
4. Optional: To control local media files (`file://`), enable **Allow access to file URLs** on the extension details page.

---

## 4. Verification Suite

```bash
npm test             # Typecheck + 27 unit/DOM/hot-swap tests + build + 17 headless Chrome ko/en UI audits
npm run typecheck    # TypeScript static check (tsc --noEmit)
npm run test:unit    # Audio math, state store, DOM hook, and hot-swap tests
npm run test:ui      # Headless Chrome layout & interaction audit (Korean + English)
```

---

## 5. Safety, Compatibility & Privacy

- **Hearing & Speaker Safety**: Boosting above `0 dB` (especially stacking channel, master, and normalizer gain) can produce high sound levels. Start at a low volume when wearing headphones.
- **Critical Alerts & Sensitive Pages**: Master Mute, `Solo`, `Focus` ducking, and `Noise Gate` also attenuate calls, meetings, alarms, and alerts in other tabs. Pause the extension or use Incognito during proctored online exams, strict banking security checks, or Web DAW sessions.
- **Content Respect & Zero Data Collection**: Fadedesk never records, extracts, or downloads streams and never circumvents DRM; cross-origin and DRM streams fall back automatically to standard `0 dB` volume control. Zero user data leaves your browser ([Privacy Policy](PRIVACY.md)).

---

## 6. License

Distributed under the **GNU General Public License v3.0 or later (`GPL-3.0-or-later`)** on an `"AS IS"` basis without warranty of any kind. See [LICENSE](LICENSE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and [CHANGELOG.md](CHANGELOG.md).
