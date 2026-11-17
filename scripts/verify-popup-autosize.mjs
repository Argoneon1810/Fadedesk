import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 실제 Chrome 확장 팝업(Extensions.loadUnpacked + chrome.action.openPopup) AutoResize 검증 도구.
 * 외부 --window-size 고정 탭이 놓치는 확장 팝업 초기 뷰포트(100vw) 수축 및 우측 잘림을 실측·캡처한다.
 */

/** 1.2.0 "모든 채널" 고급 FX 층 (노멀라이저는 음악 프리셋 값) */
function globalFx(normOn) {
  return {
    norm: { enabled: normOn, presetId: "music", modified: false, targetLufs: -16, speed: "slow", rangeLowLufs: -32, rangeHighLufs: -10, zeroReturnRate: 0.35, minDwellBlocks: 16, maxBoostDb: 6 },
    gate: { enabled: false, thresholdDb: -48 },
    comp: { enabled: false, ratio: 4 },
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const UNPACKED = path.join(ROOT, "dist", "unpacked");

const CHROME_BIN = [
  process.env.CHROME_BIN,
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe") : "",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean).find((p) => fs.existsSync(p));

if (!CHROME_BIN) {
  console.error("[SKIP] Chrome 실행 파일을 찾지 못했습니다.");
  process.exit(0);
}
if (!fs.existsSync(path.join(UNPACKED, "manifest.json"))) {
  console.error("[FAIL] dist/unpacked가 없습니다. 먼저 npm run build를 실행하세요.");
  process.exit(1);
}

function getFreePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

class CdpSession {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      }
    };
  }
  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws.close(); }
}

const SAMPLE_SNAP = {
  settings: {
    theme: "teal", modePref: "dark", alpha: 0.25,
    masterDb: 0, masterMuted: false, globalFx: globalFx(false), globalPan: 0, userPresets: [], advRackOpen: false,
    domainDefaults: { "music.youtube.com": 0, "youtube.com": 0 },
  },
  channels: [
    {
      tabId: 1, windowId: 1, title: "청혼", domain: "music.youtube.com", favIconUrl: "",
      audible: true, playing: true, mediaCount: 1, db: 0, muted: false, solo: false, focus: false,
      vuLevel: 0.35, vuPeak: 0.40, ampBlocked: false, pinned: true, normTrimDb: 0,
      fx: { own: { gate: { enabled: false, thresholdDb: -50 } }, pan: 0 },
    },
    {
      tabId: 2, windowId: 1, title: "(PAPER CREW) 라이브", domain: "youtube.com", favIconUrl: "",
      audible: true, playing: true, mediaCount: 1, db: 0, muted: false, solo: false, focus: false,
      vuLevel: 0.50, vuPeak: 0.55, ampBlocked: false, pinned: true, normTrimDb: 0,
      fx: { own: { gate: { enabled: false, thresholdDb: -50 } }, pan: 0 },
    },
    {
      tabId: 3, windowId: 1, title: "[16기] 11월 공지", domain: "job.ssafy.com", favIconUrl: "",
      audible: false, playing: false, mediaCount: 1, db: 0, muted: false, solo: false, focus: false,
      vuLevel: 0, vuPeak: 0, ampBlocked: false, pinned: false, normTrimDb: 0,
      fx: { own: { gate: { enabled: false, thresholdDb: -50 } }, pan: 0 },
    },
  ],
};

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sm-popup-autosize-"));
const extDir = path.join(tmpDir, "ext");
const profileDir = path.join(tmpDir, "profile");
fs.cpSync(UNPACKED, extDir, { recursive: true });
fs.mkdirSync(profileDir, { recursive: true });

const origJs = fs.readFileSync(path.join(extDir, "popup.js"), "utf8");
const mockPrefix = `
const __origConnect = chrome.runtime.connect.bind(chrome.runtime);
chrome.runtime.connect = function(info) {
  const realPort = __origConnect(info);
  return {
    name: realPort.name, postMessage: () => {}, disconnect: () => realPort.disconnect(), onDisconnect: realPort.onDisconnect,
    onMessage: { addListener: (fn) => setTimeout(() => fn({ type: "SNAPSHOT", snapshot: ${JSON.stringify(SAMPLE_SNAP)} }), 20) }
  };
};
`;
fs.writeFileSync(path.join(extDir, "popup.js"), mockPrefix + "\n" + origJs, "utf8");

const port = await getFreePort();
const proc = spawn(CHROME_BIN, [
  "--headless=new", "--enable-unsafe-extension-debugging", "--no-sandbox", "--disable-gpu",
  "--window-size=1280,800", `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, "about:blank",
], { stdio: "ignore" });

async function fetchJson(url) { return (await fetch(url)).json(); }

try {
  let ver = null;
  for (let i = 0; i < 40; i++) {
    try { ver = await fetchJson(`http://127.0.0.1:${port}/json/version`); break; }
    catch { await new Promise((r) => setTimeout(r, 150)); }
  }
  const browserCdp = new CdpSession(ver.webSocketDebuggerUrl);
  const extRes = await browserCdp.send("Extensions.loadUnpacked", { path: extDir });
  await new Promise((r) => setTimeout(r, 300));
  const list = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  const sw = list.find((t) => t.url.includes(extRes.id));
  const swCdp = new CdpSession(sw.webSocketDebuggerUrl);
  await swCdp.send("Runtime.evaluate", { expression: `chrome.action.openPopup()`, awaitPromise: true });
  await new Promise((r) => setTimeout(r, 350));
  const list2 = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  const pop = list2.find((t) => t.url.endsWith("/popup.html"));
  const popCdp = new CdpSession(pop.webSocketDebuggerUrl);
  const res = await popCdp.send("Runtime.evaluate", {
    expression: `(() => {
      const root = document.getElementById("console-root");
      const td = document.querySelector(".top-deck");
      const dr = document.querySelector(".deck-right");
      const cs = document.getElementById("channels-scroll");
      return JSON.stringify({
        innerWidth: window.innerWidth, innerHeight: window.innerHeight,
        rootW: Math.round(root.getBoundingClientRect().width), rootScrollW: root.scrollWidth,
        topDeckH: Math.round(td.getBoundingClientRect().height),
        deckRightRight: Math.round(dr.getBoundingClientRect().right),
        channelsClientW: cs.clientWidth, channelsScrollW: cs.scrollWidth,
      });
    })()`,
    returnByValue: true,
  });
  console.log("[Real ExtensionPopup Metrics]", res.result.value);
  popCdp.close(); swCdp.close(); browserCdp.close();
} finally {
  proc.kill();
  await new Promise((r) => setTimeout(r, 200));
  try { fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
}
