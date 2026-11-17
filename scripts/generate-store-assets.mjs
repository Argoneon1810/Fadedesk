import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import zlib from "node:zlib";

/** 1.2.0 "모든 채널" 고급 FX 층 (노멀라이저는 음악 프리셋 값) */
function globalFx(normOn) {
  return {
    norm: { enabled: normOn, presetId: "music", modified: false, targetLufs: -16, speed: "slow", rangeLowLufs: -32, rangeHighLufs: -10, zeroReturnRate: 0.35, minDwellBlocks: 16, maxBoostDb: 6 },
    gate: { enabled: false, thresholdDb: -48 },
    comp: { enabled: false, ratio: 4 },
  };
}

const execFileAsync = promisify(execFile);

/**
 * Fadedesk 크롬 웹 스토어 홍보 타일(440×280) 및 스크린샷 4종(1280×800) 생성 스크립트.
 * - 실제 dist/unpacked/ 번들을 헤드리스 Chrome(--force-device-scale-factor=1)으로 렌더링한다.
 * - 모든 예시 채널은 RFC 2606 예약 도메인(*.example)과 자체 기하 아이콘만 사용해 제3자 상표·저작권 요소를 0건으로 유지한다.
 * - 출력 PNG는 크롬 웹 스토어 규격에 맞춰 알파 채널이 없는 24-bit RGB(color_type=2) 및 정확한 픽셀 치수로 정규화한다.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const UNPACKED_DIR = path.join(ROOT, "dist", "unpacked");
const OUT_STORE_DIR = path.join(ROOT, "docs", "store");
const OUT_SHOTS_DIR = path.join(OUT_STORE_DIR, "screenshots");

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe") : "",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const CHROME_BIN = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!CHROME_BIN) {
  console.error("[ERROR] Chrome 실행 파일을 찾을 수 없습니다.");
  process.exit(1);
}

// --- 순수 Node.js PNG 디코더 & 24-bit RGB(color_type=2) 리패커 ---

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function normalizePngToRgb24(rawPngBuf, targetW, targetH, bgRgb = [9, 17, 18]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!rawPngBuf.subarray(0, 8).equals(sig)) {
    throw new Error("유효한 PNG 시그니처가 아닙니다.");
  }

  let offset = 8;
  let srcW = 0;
  let srcH = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatParts = [];

  while (offset < rawPngBuf.length) {
    const len = rawPngBuf.readUInt32BE(offset);
    const type = rawPngBuf.subarray(offset + 4, offset + 8).toString("ascii");
    const data = rawPngBuf.subarray(offset + 8, offset + 8 + len);
    offset += 12 + len;

    if (type === "IHDR") {
      srcW = data.readUInt32BE(0);
      srcH = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatParts.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`지원하지 않는 PNG 포맷: bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  const bpp = colorType === 6 ? 4 : 3;
  const stride = srcW * bpp;
  const inflated = zlib.inflateSync(Buffer.concat(idatParts));
  const recon = Buffer.alloc(srcH * stride);

  for (let y = 0; y < srcH; y++) {
    const rowIn = y * (stride + 1);
    const filter = inflated[rowIn];
    const rowOut = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = inflated[rowIn + 1 + i];
      const a = i >= bpp ? recon[rowOut + i - bpp] : 0;
      const b = y > 0 ? recon[rowOut - stride + i] : 0;
      const c = y > 0 && i >= bpp ? recon[rowOut - stride + i - bpp] : 0;
      let val = x;
      if (filter === 1) val = (x + a) & 0xff;
      else if (filter === 2) val = (x + b) & 0xff;
      else if (filter === 3) val = (x + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) val = (x + paethPredictor(a, b, c)) & 0xff;
      recon[rowOut + i] = val;
    }
  }

  const outStride = targetW * 3 + 1;
  const outRaw = Buffer.alloc(targetH * outStride);
  for (let y = 0; y < targetH; y++) {
    const outRow = y * outStride;
    outRaw[outRow] = 0; // Filter None
    for (let x = 0; x < targetW; x++) {
      let r = bgRgb[0];
      let g = bgRgb[1];
      let b = bgRgb[2];
      if (x < srcW && y < srcH) {
        const idx = y * stride + x * bpp;
        const sr = recon[idx];
        const sg = recon[idx + 1];
        const sb = recon[idx + 2];
        const sa = bpp === 4 ? recon[idx + 3] / 255 : 1;
        r = Math.round(sr * sa + r * (1 - sa));
        g = Math.round(sg * sa + g * (1 - sa));
        b = Math.round(sb * sa + b * (1 - sa));
      }
      const p = outRow + 1 + x * 3;
      outRaw[p] = r;
      outRaw[p + 1] = g;
      outRaw[p + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(targetW, 0);
  ihdr.writeUInt32BE(targetH, 4);
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 2; // Truecolor RGB (no alpha)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(outRaw, { level: 9 });
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function svgFavicon(bgHex, glyphSvg) {
  const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="${bgHex}"/>${glyphSvg}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(raw)}`;
}

const DEMO_CHANNELS_EN = [
  {
    tabId: 1, windowId: 1, title: "Acoustic Studio Session", domain: "audio.example", shortHost: "audio",
    favIconUrl: svgFavicon("#134e4a", '<circle cx="12" cy="12" r="5" fill="none" stroke="#2dd4bf" stroke-width="2.2"/><circle cx="12" cy="12" r="1.6" fill="#2dd4bf"/>'),
    playing: true, audible: true, mediaCount: 1, db: 0.0,
    muted: false, solo: false, focus: true, corsCap: false, vuLevel: 0.72, vuPeak: 0.81, firstSeenAt: 1,
    sortOrder: 1, normTrimDb: -1.4,
    fx: { own: {}, pan: 0 },
  },
  {
    tabId: 2, windowId: 1, title: "Live Dev Talk Stream", domain: "live.example", shortHost: "live",
    favIconUrl: svgFavicon("#1e3a8a", '<polygon points="9,7 18,12 9,17" fill="#60a5fa"/>'),
    playing: true, audible: true, mediaCount: 1, db: -3.5,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0.46, vuPeak: 0.56, firstSeenAt: 2,
    sortOrder: 2, normTrimDb: 2.3,
    fx: { own: { norm: { enabled: true, presetId: "", modified: false, targetLufs: -14, speed: "fast", rangeLowLufs: -32, rangeHighLufs: -10, zeroReturnRate: 0.35, minDwellBlocks: 2, maxBoostDb: 9 }, gate: { enabled: true, thresholdDb: -46 }, comp: { enabled: true, ratio: 4 } }, pan: -25 },
  },
  {
    tabId: 3, windowId: 1, title: "Architecture Lecture 04", domain: "video.example", shortHost: "video",
    favIconUrl: svgFavicon("#3f2e12", '<rect x="6" y="7" width="12" height="10" rx="2" fill="none" stroke="#fbbf24" stroke-width="2"/>'),
    playing: true, audible: true, mediaCount: 1, db: 4.5,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0.58, vuPeak: 0.68, firstSeenAt: 3,
    sortOrder: 3, normTrimDb: 1.8,
    fx: { own: {}, pan: 20 },
  },
  {
    tabId: 4, windowId: 2, title: "Protected Cinema Stream", domain: "cinema.example", shortHost: "cinema",
    favIconUrl: svgFavicon("#312e81", '<path d="M7 8h10v8H7z" fill="none" stroke="#a5b4fc" stroke-width="2"/>'),
    playing: true, audible: true, mediaCount: 1, db: 0.0,
    muted: false, solo: false, focus: false, corsCap: true, vuLevel: 0.51, vuPeak: 0.51, firstSeenAt: 4,
    sortOrder: 4, normTrimDb: 0.0,
    fx: { own: {}, pan: 0 },
  },
  {
    tabId: 5, windowId: 2, title: "Evening Synth Podcast", domain: "podcast.example", shortHost: "podcast",
    favIconUrl: svgFavicon("#1f2937", '<rect x="10" y="6" width="4" height="8" rx="2" fill="#9ca3af"/><path d="M8 12a4 4 0 0 0 8 0" fill="none" stroke="#9ca3af" stroke-width="1.8"/>'),
    playing: false, audible: false, mediaCount: 1, db: -6.0,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0, vuPeak: 0, firstSeenAt: 5,
    sortOrder: 5, normTrimDb: 0.0,
    fx: { own: { norm: { enabled: false, presetId: "", modified: false, targetLufs: -18, speed: "slow", rangeLowLufs: -32, rangeHighLufs: -10, zeroReturnRate: 0.35, minDwellBlocks: 16, maxBoostDb: 6 } }, pan: 0 },
  },
];

const DEMO_CHANNELS_KO = [
  {
    ...DEMO_CHANNELS_EN[0],
    title: "어쿠스틱 스튜디오 세션",
  },
  {
    ...DEMO_CHANNELS_EN[1],
    title: "라이브 개발 토크 방송",
  },
  {
    ...DEMO_CHANNELS_EN[2],
    title: "시스템 설계 강의 04",
  },
  {
    ...DEMO_CHANNELS_EN[3],
    title: "보호 스트리밍 영화",
  },
  {
    ...DEMO_CHANNELS_EN[4],
    title: "심야 라디오 팟캐스트",
  },
];

function buildPromoTileHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 440px; height: 280px; overflow: hidden;
    font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
    background: radial-gradient(circle at 76% 24%, #132c30 0%, #091112 70%);
    color: #e5edee;
  }
  .frame {
    position: relative; width: 440px; height: 280px; padding: 26px 28px;
    border: 1px solid #1f3337; display: flex; align-items: center; justify-content: space-between; gap: 18px;
  }
  .copy-col { display: flex; flex-direction: column; gap: 12px; max-width: 224px; z-index: 2; }
  .brand-pill {
    display: inline-flex; align-items: center; gap: 7px; align-self: flex-start;
    padding: 4px 10px; border-radius: 5px; border: 1px solid #14b8a6;
    background: #0f191b; color: #14b8a6; font-size: 12px; font-weight: 800; letter-spacing: 1.4px;
  }
  .brand-dot { width: 7px; height: 7px; border-radius: 50%; background: #14b8a6; box-shadow: 0 0 8px #14b8a6; }
  h1 { font-size: 24px; line-height: 1.2; font-weight: 800; color: #e5edee; letter-spacing: -0.3px; }
  p { font-size: 12.5px; line-height: 1.45; color: #88a0a4; }
  .tag-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  .tag {
    padding: 3px 8px; border-radius: 4px; font-size: 10.5px; font-weight: 700;
    background: #152326; border: 1px solid #1f3337; color: #cbd8da;
  }
  .tag.accent { border-color: rgba(245, 158, 11, 0.55); color: #fbbf24; }
  .deck-card {
    width: 152px; height: 220px; border-radius: 12px; padding: 14px 14px;
    background: #0f191b; border: 1px solid #1f3337;
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.55);
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .deck-top { display: flex; justify-content: space-between; align-items: center; font-size: 9.5px; font-weight: 700; color: #88a0a4; letter-spacing: 0.8px; }
  .deck-led { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 6px #22c55e; }
  .faders { display: flex; justify-content: space-between; align-items: stretch; height: 146px; padding: 4px 2px; }
  .slot { position: relative; width: 26px; display: flex; justify-content: center; }
  .rail { width: 6px; height: 100%; border-radius: 3px; background: #091112; border: 1px solid #1f3337; position: relative; overflow: hidden; }
  .fill { position: absolute; left: 0; right: 0; bottom: 0; background: #14b8a6; border-radius: 2px; }
  .fill.boost { background: linear-gradient(180deg, #f59e0b 0%, #14b8a6 42%); }
  .cap {
    position: absolute; left: 2px; width: 22px; height: 13px; border-radius: 3px;
    background: #1c2e32; border: 1.5px solid #14b8a6; box-shadow: 0 3px 8px rgba(0,0,0,0.55);
  }
  .cap::after { content: ""; position: absolute; left: 4px; right: 4px; top: 4.5px; height: 1.5px; background: #e5edee; }
  .cap.amber { border-color: #f59e0b; }
  .vu-col { width: 10px; display: flex; flex-direction: column; justify-content: space-between; padding: 2px 0; }
  .seg { height: 5px; border-radius: 1.5px; background: #152326; }
  .seg.on-g { background: #14b8a6; }
  .seg.on-a { background: #f59e0b; }
  .msf { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
  .msf span {
    height: 20px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800; background: #152326; border: 1px solid #1f3337; color: #88a0a4;
  }
  .msf span.f-on { background: #14b8a6; border-color: #14b8a6; color: #041311; }
</style>
</head>
<body>
  <div class="frame">
    <div class="copy-col">
      <div class="brand-pill"><span class="brand-dot"></span>FADEDESK</div>
      <h1>Per-Tab Studio Audio Mixer</h1>
      <p>Control every browser tab with logarithmic dB faders, Focus ducking, BS.1770 loudness leveling, and per-tab FX.</p>
      <div class="tag-row">
        <span class="tag accent">+12 dB Boost</span>
        <span class="tag">Focus · Solo</span>
        <span class="tag">BS.1770 LUFS</span>
        <span class="tag">0 Data Sent</span>
      </div>
    </div>
    <div class="deck-card">
      <div class="deck-top"><span>CH 01–03</span><span class="deck-led"></span></div>
      <div class="faders">
        <div class="slot">
          <div class="rail"><div class="fill boost" style="height:78%"></div></div>
          <div class="cap amber" style="top:24px"></div>
        </div>
        <div class="slot">
          <div class="rail"><div class="fill" style="height:60%"></div></div>
          <div class="cap" style="top:50px"></div>
        </div>
        <div class="slot">
          <div class="rail"><div class="fill" style="height:36%"></div></div>
          <div class="cap" style="top:84px"></div>
        </div>
        <div class="vu-col">
          <div class="seg"></div>
          <div class="seg on-a"></div>
          <div class="seg on-a"></div>
          <div class="seg on-g"></div>
          <div class="seg on-g"></div>
          <div class="seg on-g"></div>
          <div class="seg on-g"></div>
          <div class="seg on-g"></div>
          <div class="seg on-g"></div>
          <div class="seg on-g"></div>
          <div class="seg on-g"></div>
          <div class="seg on-g"></div>
        </div>
      </div>
      <div class="msf"><span>M</span><span>S</span><span class="f-on">F</span></div>
    </div>
  </div>
</body>
</html>`;
}

function buildStoreScreenshotHtml(basePopupHtml, spec) {
  const showcaseCss = `
  <style id="store-showcase-frame">
    *, *::before, *::after {
      transition: none !important;
      animation: none !important;
    }
    html, body {
      width: 1280px !important;
      height: 800px !important;
      overflow: hidden !important;
      background: radial-gradient(circle at 50% 18%, ${spec.glowHex} 0%, #091112 72%) !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 22px !important;
      padding: 24px !important;
    }
    .store-caption {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
      max-width: 980px;
    }
    .store-kicker {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.2px;
      background: #0f191b;
      border: 1px solid ${spec.accentHex};
      color: ${spec.accentHex};
    }
    .store-headline {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.3px;
      color: #e5edee;
    }
    .store-sub {
      margin: 0;
      font-size: 14px;
      color: #93aaae;
    }
    .store-stage {
      padding: 18px;
      border-radius: 14px;
      background: rgba(15, 25, 27, 0.72);
      border: 1px solid #1f3337;
      box-shadow: 0 28px 64px rgba(0, 0, 0, 0.65);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .store-browser-bar {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 12px;
      border-radius: 8px;
      background: #091112;
      border: 1px solid #1f3337;
      color: #88a0a4;
      font-size: 11px;
    }
    .store-tabs { display: flex; align-items: center; gap: 6px; }
    .store-tab-pill {
      padding: 3px 9px;
      border-radius: 5px;
      background: #152326;
      border: 1px solid #1f3337;
      color: #cbd8da;
      font-size: 10.5px;
      font-weight: 600;
    }
    .store-ext-badge {
      padding: 3px 9px;
      border-radius: 5px;
      background: ${spec.accentHex};
      color: #041311;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.6px;
    }
    #console-root {
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.58) !important;
      border-radius: 8px !important;
    }
  </style>
  <script>
    window.chrome = {
      i18n: {
        getUILanguage: () => ${JSON.stringify(spec.lang === "en" ? "en-US" : "ko-KR")},
      },
      runtime: {
        connect() {
          const listeners = [];
          setTimeout(() => {
            listeners.forEach((fn) => fn({ type: "SNAPSHOT", snapshot: ${JSON.stringify(spec.snap)} }));
            setTimeout(() => {
              ${spec.afterActionJs || ""}
            }, 30);
          }, 15);
          return {
            onMessage: { addListener: (fn) => listeners.push(fn) },
            onDisconnect: { addListener: () => {} },
            postMessage: () => {},
          };
        },
        sendMessage: async () => ({}),
      },
    };
  </script>`;

  const captionHtml = `
  <div class="store-caption">
    <span class="store-kicker">${spec.kicker}</span>
    <h1 class="store-headline">${spec.headline}</h1>
    <p class="store-sub">${spec.subtitle}</p>
  </div>
  <div class="store-stage">
    <div class="store-browser-bar">
      <div class="store-tabs">
        <span class="store-tab-pill">♪ audio.example</span>
        <span class="store-tab-pill">▶ live.example</span>
        <span class="store-tab-pill">▶ video.example</span>
        <span class="store-tab-pill">▶ cinema.example</span>
      </div>
      <span class="store-ext-badge">FADEDESK</span>
    </div>`;

  return basePopupHtml
    .replace("</head>", `${showcaseCss}\n</head>`)
    .replace('<div id="console-root"', `${captionHtml}\n<div id="console-root"`)
    .replace('<script src="popup.js"></script>', '</div>\n<script src="popup.js"></script>');
}

async function captureHtmlToPng(chromeBin, profileDir, htmlPath, query, width, height, rawPngOut, finalPngOut) {
  const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/") + (query || "");
  await execFileAsync(
    chromeBin,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--user-data-dir=${profileDir}`,
      `--window-size=${width},${height}`,
      "--virtual-time-budget=450",
      `--screenshot=${rawPngOut}`,
      fileUrl,
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );

  const rawBuf = fs.readFileSync(rawPngOut);
  const rgb24Buf = normalizePngToRgb24(rawBuf, width, height, [9, 17, 18]);
  fs.mkdirSync(path.dirname(finalPngOut), { recursive: true });
  fs.writeFileSync(finalPngOut, rgb24Buf);
}

const BASE_SETTINGS = {
  theme: "teal",
  modePref: "dark",
  alpha: 0.7,
  masterDb: 0,
  masterMuted: false,
  globalFx: globalFx(true), globalPan: 0, userPresets: [],
  advRackOpen: false,
  onboardingDone: true,
  popoutWidth: 780,
  popoutHeight: 480,
  domainDefaults: { "audio.example": 0, "live.example": -3.5 },
};

const SCREENSHOT_SPECS = [
  {
    fileName: "1-console-overview.png",
    lang: "en",
    glowHex: "#122b2f",
    accentHex: "#14b8a6",
    kicker: "FADEDESK · PER-TAB STUDIO AUDIO CONSOLE",
    headline: "Control Volume, Focus Ducking & Playback Across Every Tab",
    subtitle: "-60 to +12 dB logarithmic faders · Mute / Solo / Focus (α) · Domain Volume Pin · Zero data collection",
    snap: {
      settings: { ...BASE_SETTINGS, theme: "teal", modePref: "dark", globalFx: globalFx(true), globalPan: 0, userPresets: [] },
      channels: DEMO_CHANNELS_EN,
    },
    afterActionJs: "",
  },
  {
    fileName: "2-fx-rack.png",
    lang: "en",
    glowHex: "#13233b",
    accentHex: "#3b82f6",
    kicker: "BS.1770 LOUDNESS & PER-CHANNEL DSP RACK",
    headline: "Shape Each Tab with Loudness Target, Stereo Pan, Gate & Compressor",
    subtitle: "2-tier ITU-R BS.1770-4 gated normalizer (Music 9s · Std 3s · Night 0.4s) + non-destructive per-strip FX",
    snap: {
      settings: { ...BASE_SETTINGS, theme: "cobalt", modePref: "dark", advRackOpen: true, globalFx: globalFx(true), globalPan: 0, userPresets: [] },
      channels: DEMO_CHANNELS_EN,
    },
    afterActionJs: `
      const ch2 = document.querySelector('.channel-strip[data-tab-id="2"]');
      if (ch2) ch2.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    `,
  },
  {
    fileName: "3-spotlight-tour.png",
    lang: "ko",
    glowHex: "#122b2f",
    accentHex: "#14b8a6",
    kicker: "FADEDESK · 한·영 동시 지원 & 실화면 스포트라이트 투어",
    headline: "실제 콘솔 위에서 연관 조작부를 한눈에 비추는 7단계 인터랙티브 투어",
    subtitle: "하단 집중 청취(M·S·F)와 상단 Focus α 감쇠 슬라이더·직접 입력창을 다중 스포트라이트 홀로 안내",
    snap: {
      settings: { ...BASE_SETTINGS, theme: "teal", modePref: "dark", onboardingDone: false },
      channels: DEMO_CHANNELS_KO,
    },
    afterActionJs: `
      document.querySelector("[data-tour-start]")?.click();
      const nextBtn = document.querySelector("#tour-overlay [data-tour-next]");
      for (let i = 0; i < 4; i++) nextBtn?.click();
    `,
  },
  {
    fileName: "4-help-and-safety.png",
    lang: "ko",
    glowHex: "#2a2011",
    accentHex: "#f59e0b",
    kicker: "IN-APP CONSOLE GUIDE & SAFETY NOTICES",
    headline: "설치 후 언제든 열람 가능한 부품 도면 가이드와 안전·유의사항 고지",
    subtitle: "청력·스피커 보호, 통화·경보 감쇠 주의, 시험·보안 페이지 호환, BS.1770 계측 기준을 인앱 ? 버튼에 상시 수록",
    snap: {
      settings: { ...BASE_SETTINGS, theme: "amber", modePref: "dark", onboardingDone: true },
      channels: DEMO_CHANNELS_KO,
    },
    afterActionJs: `
      document.getElementById("help-btn")?.click();
      document.querySelector('[data-help-tab="easy"]')?.click();
      document.querySelector('[data-help-step="4"]')?.click();
    `,
  },
];

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fadedesk-store-assets-"));
try {
  for (const name of ["popup.html", "popup.css", "popup-strips.css", "popup-fx.css", "popup-fx-scope.css", "popup-help.css", "popup.js"]) {
    fs.copyFileSync(path.join(UNPACKED_DIR, name), path.join(tmpDir, name));
  }
  const basePopupHtml = fs.readFileSync(path.join(tmpDir, "popup.html"), "utf8");

  // 1) 440x280 프로모션 타일 생성
  const promoHtmlPath = path.join(tmpDir, "promo.html");
  fs.writeFileSync(promoHtmlPath, buildPromoTileHtml(), "utf8");
  const promoProfile = path.join(tmpDir, "profile_promo");
  fs.mkdirSync(promoProfile, { recursive: true });
  const promoOut = path.join(OUT_STORE_DIR, "promo-440x280.png");
  await captureHtmlToPng(
    CHROME_BIN,
    promoProfile,
    promoHtmlPath,
    "",
    440,
    280,
    path.join(tmpDir, "raw_promo.png"),
    promoOut,
  );
  console.log(`[PASS] Generated promo tile: ${path.relative(ROOT, promoOut)} (440x280 RGB24)`);

  // 2) 1280x800 스토어 스크린샷 4종 병렬 생성
  await Promise.all(
    SCREENSHOT_SPECS.map(async (spec) => {
      const shotHtmlPath = path.join(tmpDir, `shot_${spec.fileName}.html`);
      fs.writeFileSync(shotHtmlPath, buildStoreScreenshotHtml(basePopupHtml, spec), "utf8");
      const shotProfile = path.join(tmpDir, `profile_${spec.fileName}`);
      fs.mkdirSync(shotProfile, { recursive: true });
      const shotOut = path.join(OUT_SHOTS_DIR, spec.fileName);
      await captureHtmlToPng(
        CHROME_BIN,
        shotProfile,
        shotHtmlPath,
        `?lang=${spec.lang}`,
        1280,
        800,
        path.join(tmpDir, `raw_${spec.fileName}`),
        shotOut,
      );
      console.log(`[PASS] Generated screenshot: ${path.relative(ROOT, shotOut)} (1280x800 RGB24)`);
    }),
  );
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
