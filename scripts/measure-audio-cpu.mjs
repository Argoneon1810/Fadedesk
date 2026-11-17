#!/usr/bin/env node
/**
 * Fadedesk 확장이 소리 재생 탭에 얹는 CPU 부담을 잰다 (개발용 측정 도구, 배포물에 들어가지 않음).
 *
 * 왜: "영상 두 개 틀었는데 CPU가 높다"에서 영상 디코딩 몫과 확장 몫을 가르기 위해.
 * 어떻게: 새 프로필의 Chrome을 띄워 로컬 시험 페이지(<audio> 반복 재생, 영상 없음)를 탭 N개에 틀고
 *   시나리오마다 Chrome 전체 프로세스의 CPU 시간 증가량을 잰다.
 *   - off    : 확장 없음 (기준선)
 *   - on     : 확장 켬, 팝업 닫힘, 기본 설정(모든 채널 노멀라이저 켬)
 *   - popup  : 확장 켬, 팝업 열림 (VU·스펙트럼 계량 켜짐)
 *   - nonorm : 확장 켬, 팝업 닫힘, 노멀라이저 끔 (0.075초 계산이 멈추고 소리 처리 회로만 남음)
 *   주 지표는 탭(renderer)·오디오 서비스·GPU 프로세스 합이다. 브라우저·네트워크 프로세스는 새 프로필 Chrome의 자체 작업
 *   (구성 요소 갱신 등)이 섞여 회차마다 크게 흔들리므로 내역에만 적는다(확장 메시지는 초당 1회 미만이라 무시할 만함).
 *   확장 몫 = on − off. 내역은 오디오 스레드(WebAudio Render Capacity)와 기본 스레드 JS(프로파일러의 chrome-extension:// 몫)로 나눈다.
 * 유효성: 재생 시각이 흐르는지, 확장 회로가 running인지, 0.075초 계산이 실제 주기로 도는지 확인하고 아니면 INVALID로 찍는다.
 *
 * 사용: npm run build 뒤
 *   node scripts/measure-audio-cpu.mjs [--rounds 3] [--seconds 15] [--tabs 2]
 *     [--scenarios off,on,popup,nonorm] [--headed] [--audible] [--url <주소> ...] [--json <파일>]
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UNPACKED_DIR = path.join(ROOT, "dist", "unpacked");

// ── 인자 ──
const argv = process.argv.slice(2);
function argVal(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}
const ROUNDS = Number(argVal("rounds", "3"));
const SECONDS = Number(argVal("seconds", "15"));
const TABS = Number(argVal("tabs", "2"));
const WARMUP_SEC = 10;
const SCENARIOS = argVal("scenarios", "off,on,popup,nonorm").split(",").map((s) => s.trim()).filter(Boolean);
const HEADED = argv.includes("--headed");
const AUDIBLE = argv.includes("--audible");
const JSON_OUT = argVal("json", "");
const CUSTOM_URLS = argv.flatMap((a, i) => (a === "--url" && argv[i + 1] ? [argv[i + 1]] : []));
const NCPU = os.cpus().length;

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
  console.error("Chrome 실행 파일을 찾지 못했다. CHROME_BIN 환경 변수로 경로를 준다.");
  process.exit(1);
}
if (!fs.existsSync(path.join(UNPACKED_DIR, "manifest.json"))) {
  console.error("dist/unpacked가 없다. 먼저 npm run build를 돌린다.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 시험 음원: 48kHz 스테레오 8초, 음량이 오르내리는 화음 + 잡음 (노멀라이저가 실제로 일하게) ──
function makeWav() {
  const rate = 48000, secs = 8, n = rate * secs;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  let seed = 1;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = 0.25 + 0.2 * Math.sin(2 * Math.PI * 0.25 * t);
    const tone = Math.sin(2 * Math.PI * 220 * t) + 0.6 * Math.sin(2 * Math.PI * 277 * t) + 0.4 * Math.sin(2 * Math.PI * 330 * t);
    const l = env * (0.35 * tone + 0.15 * rnd());
    const r = env * (0.35 * tone * 0.8 + 0.15 * rnd());
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r)) * 32767), 46 + i * 4);
  }
  return buf;
}

function startServer() {
  const wav = makeWav();
  const html = '<!doctype html><meta charset="utf-8"><title>cpu-audit</title><audio src="/tone.wav" loop autoplay></audio>';
  const server = http.createServer((req, res) => {
    server.requests = (server.requests ?? 0) + 1;
    if (req.url.startsWith("/tone.wav")) {
      server.mediaRequests = (server.mediaRequests ?? 0) + 1;
      // 범위 요청을 받아야 반복 재생 때 파일 전체를 다시 받지 않는다 (실제 사이트와 같은 조건)
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
      const headers = { "Content-Type": "audio/wav", "Accept-Ranges": "bytes", "Cache-Control": "max-age=3600" };
      if (m) {
        const start = m[1] ? Number(m[1]) : 0;
        const end = m[2] ? Math.min(Number(m[2]), wav.length - 1) : wav.length - 1;
        res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${wav.length}`, "Content-Length": end - start + 1 });
        res.end(wav.subarray(start, end + 1));
      } else {
        res.writeHead(200, { ...headers, "Content-Length": wav.length });
        res.end(wav);
      }
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// ── CDP (파이프 방식: 상표 Chrome도 Extensions.loadUnpacked를 허용) ──
class Cdp {
  constructor(child) {
    this.out = child.stdio[3];
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    let acc = "";
    child.stdio[4].on("data", (chunk) => {
      acc += chunk.toString("utf8");
      let idx;
      while ((idx = acc.indexOf("\0")) >= 0) {
        const msg = JSON.parse(acc.slice(0, idx));
        acc = acc.slice(idx + 1);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          msg.error ? reject(new Error(`${msg.error.message} (${msg.error.code})`)) : resolve(msg.result);
        } else if (msg.method) {
          for (const fn of this.listeners) fn(msg);
        }
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.out.write(JSON.stringify(payload) + "\0");
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`CDP 시간 초과: ${method}`));
      }, 15000);
    });
  }
  on(fn) { this.listeners.push(fn); }
}

async function launchChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "fadedesk-cpu-audit-"));
  const args = [
    "--remote-debugging-pipe", "--enable-unsafe-extension-debugging",
    `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
    "--autoplay-policy=no-user-gesture-required",
    // 실제로 소리가 나는 탭은 타이머 억제를 받지 않으므로 같은 조건을 만든다
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
  ];
  if (!AUDIBLE) args.push("--mute-audio");
  if (!HEADED) args.push("--headless=new");
  args.push("about:blank");
  const child = spawn(CHROME_BIN, args, { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
  const cdp = new Cdp(child);
  await cdp.send("Browser.getVersion");
  const close = async () => {
    try { await cdp.send("Browser.close"); } catch {}
    await sleep(800);
    try { child.kill(); } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  };
  return { cdp, close };
}

async function openTab(cdp, url) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  return { targetId, sessionId, url };
}

async function evalIn(cdp, sessionId, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
  return r.result?.value;
}

async function perfMetrics(cdp, sessionId) {
  const { metrics } = await cdp.send("Performance.getMetrics", {}, sessionId);
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
}

async function gpuMode(cdp) {
  try {
    const { gpu } = await cdp.send("SystemInfo.getInfo");
    const fs = gpu.featureStatus ?? {};
    const dev = (gpu.devices ?? [])[0] ?? {};
    return `합성 ${fs.gpu_compositing ?? "?"} · 래스터 ${fs.rasterization ?? "?"} · ${dev.deviceString || dev.vendorString || "장치 정보 없음"}`;
  } catch {
    return "확인 실패";
  }
}

async function processCpu(cdp) {
  const { processInfo } = await cdp.send("SystemInfo.getProcessInfo");
  return new Map(processInfo.map((p) => [p.id, { type: p.type, cpu: p.cpuTime }]));
}

function summarizeProfile(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const out = { extensionMs: 0, pageMs: 0, idleMs: 0 };
  const { samples = [], timeDeltas = [] } = profile;
  for (let i = 0; i < samples.length; i++) {
    const node = byId.get(samples[i]);
    const ms = (timeDeltas[i] ?? 0) / 1000;
    const fn = node?.callFrame.functionName ?? "";
    const url = node?.callFrame.url ?? "";
    if (url.startsWith("chrome-extension://")) out.extensionMs += ms;
    else if (fn === "(idle)" || fn === "(program)") out.idleMs += ms;
    else out.pageMs += ms;
  }
  return out;
}

const TICK_COUNTER_ON = `(() => {
  const p = AnalyserNode.prototype;
  if (!p.__auditOrig) {
    const orig = p.getFloatTimeDomainData;
    p.__auditOrig = orig;
    p.getFloatTimeDomainData = function (...a) { window.__auditReads = (window.__auditReads || 0) + 1; return orig.apply(this, a); };
  }
  window.__auditReads = 0;
  return true;
})()`;
const TICK_COUNTER_OFF = `(() => {
  const p = AnalyserNode.prototype;
  const n = window.__auditReads || 0;
  if (p.__auditOrig) { p.getFloatTimeDomainData = p.__auditOrig; delete p.__auditOrig; }
  return n;
})()`;
// 훅 → 브리지 → 백그라운드로 가는 보고 수 (확장 메시지 중계 부담의 지표)
const HOOK_EVENT_COUNTER_ON = `(() => {
  window.__auditHookEvents = {};
  if (!window.__auditHookListener) {
    window.__auditHookListener = (ev) => {
      try { const t = JSON.parse(ev.detail).type; window.__auditHookEvents[t] = (window.__auditHookEvents[t] || 0) + 1; } catch {}
    };
    document.addEventListener("__sound_manager_hook_to_bridge__", window.__auditHookListener);
  }
  return true;
})()`;
const HOOK_EVENT_COUNTER_READ = `(() => window.__auditHookEvents || {})()`;
const MEDIA_TIME = `(() => { const m = document.querySelector("audio,video"); return m ? m.currentTime : -1; })()`;

async function runScenario(scenario, server) {
  const serverPort = server.address().port;
  const { cdp, close } = await launchChrome();
  const contexts = new Map(); // contextId -> { sessionId, state }
  cdp.on((msg) => {
    if (msg.method === "WebAudio.contextCreated" || msg.method === "WebAudio.contextChanged") {
      const c = msg.params.context;
      contexts.set(c.contextId, { sessionId: msg.sessionId, state: c.contextState });
    } else if (msg.method === "WebAudio.contextWillBeDestroyed") {
      contexts.delete(msg.params.contextId);
    }
  });
  const result = { scenario, valid: true, problems: [] };
  try {
    result.gpu = await gpuMode(cdp);
    let extId = "";
    if (scenario !== "off") {
      ({ id: extId } = await cdp.send("Extensions.loadUnpacked", { path: UNPACKED_DIR }));
      await sleep(1200);
    }
    if (scenario === "nonorm") {
      const pop = await openTab(cdp, "");
      await cdp.send("Page.navigate", { url: `chrome-extension://${extId}/popup.html` }, pop.sessionId);
      await sleep(1200);
      await evalIn(cdp, pop.sessionId, `chrome.runtime.sendMessage({ source: "popup", type: "TOGGLE_AUTO_NORM" }).catch(() => {}), true`);
      await sleep(500);
      await cdp.send("Target.closeTarget", { targetId: pop.targetId });
    }

    const urls = CUSTOM_URLS.length > 0
      ? Array.from({ length: TABS }, (_, i) => CUSTOM_URLS[i % CUSTOM_URLS.length])
      : Array.from({ length: TABS }, (_, i) => `http://127.0.0.1:${serverPort}/play.html?tab=${i}`);
    const tabs = [];
    for (const url of urls) {
      const tab = await openTab(cdp, url);
      await cdp.send("WebAudio.enable", {}, tab.sessionId);
      await cdp.send("Page.enable", {}, tab.sessionId);
      await cdp.send("Page.navigate", { url }, tab.sessionId);
      tabs.push(tab);
    }
    let popupSession = "";
    if (scenario === "popup") {
      const pop = await openTab(cdp, "");
      popupSession = pop.sessionId;
      await cdp.send("Performance.enable", {}, pop.sessionId);
      await cdp.send("Page.navigate", { url: `chrome-extension://${extId}/popup.html` }, pop.sessionId);
    }
    await sleep(WARMUP_SEC * 1000);

    // ── 유효성 확인 (측정 구간 밖) ──
    const t0s = await Promise.all(tabs.map((t) => evalIn(cdp, t.sessionId, MEDIA_TIME)));
    await Promise.all(tabs.map((t) => evalIn(cdp, t.sessionId, TICK_COUNTER_ON)));
    await sleep(3000);
    const reads = await Promise.all(tabs.map((t) => evalIn(cdp, t.sessionId, TICK_COUNTER_OFF)));
    const t1s = await Promise.all(tabs.map((t) => evalIn(cdp, t.sessionId, MEDIA_TIME)));
    result.analyserReadsPerSec = reads.map((n) => Math.round((n / 3) * 10) / 10);
    tabs.forEach((t, i) => {
      if (!(t1s[i] > t0s[i] + 1)) { result.valid = false; result.problems.push(`탭${i} 재생이 흐르지 않음`); }
    });
    if (scenario !== "off") {
      tabs.forEach((t, i) => {
        const running = [...contexts.values()].filter((c) => c.sessionId === t.sessionId && c.state === "running");
        if (running.length === 0) { result.valid = false; result.problems.push(`탭${i} 확장 소리 회로가 running 아님`); }
      });
      if (scenario !== "nonorm" && result.analyserReadsPerSec.some((r) => r < 8)) {
        result.valid = false;
        result.problems.push(`0.075초 계산 주기가 느림(${result.analyserReadsPerSec.join("/")}회/초)`);
      }
    }

    // ── 측정 구간 ──
    for (const t of tabs) {
      await cdp.send("Profiler.enable", {}, t.sessionId);
      await cdp.send("Profiler.setSamplingInterval", { interval: 500 }, t.sessionId);
      await cdp.send("Profiler.start", {}, t.sessionId);
    }
    const req0 = server.mediaRequests ?? 0;
    await Promise.all(tabs.map((t) => evalIn(cdp, t.sessionId, HOOK_EVENT_COUNTER_ON)));
    const pm0 = popupSession ? await perfMetrics(cdp, popupSession) : null;
    const p0 = await processCpu(cdp);
    const w0 = performance.now();
    const caps = [];
    for (let s = 0; s < SECONDS; s++) {
      await sleep(1000);
      for (const [contextId] of contexts) {
        try {
          const { realtimeData } = await cdp.send("WebAudio.getRealtimeData", { contextId }, contexts.get(contextId).sessionId);
          caps.push(realtimeData.renderCapacity);
        } catch {}
      }
    }
    const p1 = await processCpu(cdp);
    const wallSec = (performance.now() - w0) / 1000;
    if (pm0) {
      // 팝업 기본 스레드가 1초에 쓴 시간(ms): 스크립트 / 스타일 계산 / 배치 / 그 밖(그리기 기록 등) 
      const pm1 = await perfMetrics(cdp, popupSession);
      const per = (k) => ((pm1[k] - pm0[k]) * 1000) / wallSec;
      result.popupMsPerSec = {
        script: per("ScriptDuration"), style: per("RecalcStyleDuration"), layout: per("LayoutDuration"),
        task: per("TaskDuration"), styleCount: (pm1.RecalcStyleCount - pm0.RecalcStyleCount) / wallSec,
        layoutCount: (pm1.LayoutCount - pm0.LayoutCount) / wallSec,
      };
    }
    result.mediaRequestsPerSec = ((server.mediaRequests ?? 0) - req0) / wallSec;
    const hookEvents = await Promise.all(tabs.map((t) => evalIn(cdp, t.sessionId, HOOK_EVENT_COUNTER_READ)));
    result.hookEventsPerSec = {};
    for (const counts of hookEvents) {
      for (const [k, v] of Object.entries(counts ?? {})) result.hookEventsPerSec[k] = (result.hookEventsPerSec[k] ?? 0) + v / wallSec;
    }
    const prof = { extensionMs: 0, pageMs: 0 };
    for (const t of tabs) {
      const { profile } = await cdp.send("Profiler.stop", {}, t.sessionId);
      const s = summarizeProfile(profile);
      prof.extensionMs += s.extensionMs;
      prof.pageMs += s.pageMs;
    }

    const byType = {};
    let totalSec = 0;
    for (const [pid, after] of p1) {
      const before = p0.get(pid);
      const d = after.cpu - (before ? before.cpu : 0);
      byType[after.type] = (byType[after.type] ?? 0) + d;
      if (MEASURED_TYPES.has(after.type)) totalSec += d;
    }
    result.wallSec = wallSec;
    result.coreOf1Pct = (totalSec / wallSec) * 100;
    result.machinePct = result.coreOf1Pct / NCPU;
    result.byTypePct = Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, (v / wallSec) * 100]));
    result.extJsMsPerSec = prof.extensionMs / wallSec;
    result.pageJsMsPerSec = prof.pageMs / wallSec;
    result.contexts = contexts.size;
    // renderCapacity는 렌더 시간/허용 시간 비율(0~1). 문맥마다 표본이 섞이므로 평균 × 문맥 수 = 합계 부담
    result.renderCapacityAvgPct = caps.length ? (caps.reduce((a, b) => a + b, 0) / caps.length) * 100 : 0;
  } catch (err) {
    result.valid = false;
    result.problems.push(String(err.message || err));
  } finally {
    await close();
  }
  return result;
}

// 확장이 실제로 일하는 프로세스: 탭과 확장 서비스 워커(renderer), 소리 출력(audio), 팝업 그리기(GPU)
const MEASURED_TYPES = new Set(["renderer", "GPU", "audio.mojom.AudioService"]);

const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "-");
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

async function main() {
  const server = await startServer();
  const port = server.address().port;
  const est = Math.round((ROUNDS * SCENARIOS.length * (SECONDS + WARMUP_SEC + 7)) / 60 * 10) / 10;
  console.log(`측정: 탭 ${TABS}개 × 시나리오 [${SCENARIOS.join(", ")}] × ${ROUNDS}회, 구간 ${SECONDS}초 (예상 약 ${est}분)`);
  console.log(`Chrome: ${CHROME_BIN} | 논리 코어 ${NCPU}개 | ${HEADED ? "창 표시" : "헤드리스"} | ${AUDIBLE ? "소리 남" : "소리 끔(--mute-audio)"}`);
  console.log(`음원: ${CUSTOM_URLS.length ? CUSTOM_URLS.join(", ") : "로컬 <audio> 반복 재생 (영상 디코딩 제외)"}\n`);

  const runs = [];
  for (let r = 0; r < ROUNDS; r++) {
    for (const sc of SCENARIOS) {
      const res = await runScenario(sc, server);
      res.round = r + 1;
      runs.push(res);
      console.log(
        `[${r + 1}/${ROUNDS}] ${sc.padEnd(6)} ${res.valid ? "OK     " : "INVALID"} ` +
        `탭·오디오·GPU ${fmt(res.coreOf1Pct)}% (코어 1개 기준) = 기기 전체 ${fmt(res.machinePct, 2)}% | ` +
        `확장 JS ${fmt(res.extJsMsPerSec, 2)}ms/초 | 오디오 스레드 ${fmt(res.renderCapacityAvgPct)}% × 문맥 ${res.contexts ?? 0} | ` +
        `analyser 읽기 ${(res.analyserReadsPerSec ?? []).join("/")}회/초 | ` +
        `음원 요청 ${fmt(res.mediaRequestsPerSec, 2)}회/초 | 훅 보고 ${Object.entries(res.hookEventsPerSec ?? {}).map(([k, v]) => `${k} ${fmt(v)}`).join(", ") || "0"}/초` +
        (res.popupMsPerSec ? `
         팝업 기본 스레드 ms/초: 스크립트 ${fmt(res.popupMsPerSec.script)} · 스타일 ${fmt(res.popupMsPerSec.style)} (${fmt(res.popupMsPerSec.styleCount)}회) · 배치 ${fmt(res.popupMsPerSec.layout)} (${fmt(res.popupMsPerSec.layoutCount)}회) · 전체 작업 ${fmt(res.popupMsPerSec.task)} | GPU 프로세스 ${fmt(res.byTypePct?.GPU)}% | ${res.gpu}` : "") +
        (res.problems.length ? `\n         문제: ${res.problems.join("; ")}` : ""),
      );
    }
  }
  server.close();

  console.log("\n── 시나리오별 평균 (유효한 회차만) ──");
  const agg = {};
  for (const sc of SCENARIOS) {
    const ok = runs.filter((x) => x.scenario === sc && x.valid);
    if (ok.length === 0) { console.log(`${sc.padEnd(6)} 유효 회차 없음`); continue; }
    const c = ok.map((x) => x.coreOf1Pct);
    agg[sc] = { mean: mean(c), min: Math.min(...c), max: Math.max(...c), n: ok.length };
    const types = {};
    for (const x of ok) for (const [k, v] of Object.entries(x.byTypePct)) types[k] = (types[k] ?? 0) + v / ok.length;
    console.log(
      `${sc.padEnd(6)} 코어1개 ${fmt(agg[sc].mean)}% (범위 ${fmt(agg[sc].min)}~${fmt(agg[sc].max)}, ${ok.length}회) | ` +
      `기기 전체 ${fmt(agg[sc].mean / NCPU, 2)}% | 확장 JS ${fmt(mean(ok.map((x) => x.extJsMsPerSec)), 2)}ms/초 | ` +
      `오디오 스레드 ${fmt(mean(ok.map((x) => x.renderCapacityAvgPct)))}% | ` +
      Object.entries(types).map(([k, v]) => `${k} ${fmt(v)}`).join(", "),
    );
  }

  console.log("\n── 차이 (확장 몫) ──");
  const diff = (a, b, label) => {
    if (!agg[a] || !agg[b]) return;
    const d = agg[a].mean - agg[b].mean;
    const noise = Math.max(agg[a].max - agg[a].min, agg[b].max - agg[b].min);
    const verdict = Math.abs(d) <= noise ? "잡음 범위 안 — 잴 수 있는 차이 아님" : "잡음보다 큼";
    console.log(`${label}: 코어1개 ${d >= 0 ? "+" : ""}${fmt(d)}% = 기기 전체 ${d >= 0 ? "+" : ""}${fmt(d / NCPU, 2)}% (잡음 폭 ${fmt(noise)}%, ${verdict})`);
  };
  diff("on", "off", "확장 켬 − 없음        ");
  diff("popup", "on", "팝업 열림 − 닫힘      ");
  diff("on", "nonorm", "노멀라이저 켬 − 끔     ");
  diff("nonorm", "off", "소리 회로만 − 없음     ");

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({ ncpu: NCPU, tabs: TABS, seconds: SECONDS, runs }, null, 2));
    console.log(`\n원자료: ${JSON_OUT}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
