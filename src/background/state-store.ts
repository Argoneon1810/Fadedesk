import {
  clampAlpha,
  clampDb,
  computeAppliedLinearGain,
  extractDomainInfo,
  isChannelPinned,
  toggleExclusiveFlags,
  type MixerContextInput,
} from "../shared/mixer-math";
import { DEFAULT_SETTINGS } from "../shared/palettes";
import type {
  ConsoleSnapshot,
  ExclusiveMode,
  FrameMediaPayload,
  ModePref,
  PersistedSettings,
  TabChannelState,
  ThemeKey,
} from "../shared/types";

/**
 * 백그라운드 믹서 상태 저장소.
 * Chrome API 의존성을 분리해 단위 테스트에서도 동일한 도메인 독립성·배타 모드·스냅샷 정렬을 검증한다.
 */

export interface TabMetaInput {
  tabId: number;
  windowId: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
  audible?: boolean;
}

export interface SerializedTabSession {
  tabId: number;
  windowId: number;
  url: string;
  domain: string;
  shortHost: string;
  boundDomain: string;
  userAdjusted: boolean;
  tabTitle: string;
  favIconUrl: string;
  audible: boolean;
  db: number;
  muted: boolean;
  solo: boolean;
  focus: boolean;
  firstSeenAt: number;
  frames: Array<[number, FrameMediaPayload]>;
}

interface InternalTabRecord {
  tabId: number;
  windowId: number;
  url: string;
  domain: string;
  shortHost: string;
  boundDomain: string;
  userAdjusted: boolean;
  tabTitle: string;
  favIconUrl: string;
  audible: boolean;
  db: number;
  muted: boolean;
  solo: boolean;
  focus: boolean;
  firstSeenAt: number;
  frames: Map<number, FrameMediaPayload>;
  frameVu: Map<number, { vuLevel: number; vuPeak: number }>;
}

export class MixerStateStore {
  private settings: PersistedSettings = {
    ...DEFAULT_SETTINGS,
    domainDefaults: { ...DEFAULT_SETTINGS.domainDefaults },
  };

  private tabs = new Map<number, InternalTabRecord>();
  private seqCounter = 1;

  getSettings(): PersistedSettings {
    return {
      ...this.settings,
      domainDefaults: { ...this.settings.domainDefaults },
    };
  }

  hydrateSettings(raw?: Partial<PersistedSettings> | null): void {
    if (!raw) return;
    const validThemes: ThemeKey[] = ["teal", "amber", "cobalt", "emerald"];
    const validModes: ModePref[] = ["dark", "light", "system"];

    if (raw.theme && validThemes.includes(raw.theme)) this.settings.theme = raw.theme;
    if (raw.modePref && validModes.includes(raw.modePref)) this.settings.modePref = raw.modePref;
    if (typeof raw.alpha === "number") this.settings.alpha = clampAlpha(raw.alpha);
    if (typeof raw.masterDb === "number") this.settings.masterDb = clampDb(raw.masterDb, false);
    if (typeof raw.masterMuted === "boolean") this.settings.masterMuted = raw.masterMuted;
    if (raw.domainDefaults && typeof raw.domainDefaults === "object") {
      const cleaned: Record<string, number> = {};
      for (const [domain, val] of Object.entries(raw.domainDefaults)) {
        if (domain && typeof val === "number" && Number.isFinite(val)) {
          cleaned[domain] = clampDb(val, false);
        }
      }
      this.settings.domainDefaults = cleaned;
    }
  }

  exportSession(): SerializedTabSession[] {
    const out: SerializedTabSession[] = [];
    for (const rec of this.tabs.values()) {
      out.push({
        tabId: rec.tabId,
        windowId: rec.windowId,
        url: rec.url,
        domain: rec.domain,
        shortHost: rec.shortHost,
        boundDomain: rec.boundDomain,
        userAdjusted: rec.userAdjusted,
        tabTitle: rec.tabTitle,
        favIconUrl: rec.favIconUrl,
        audible: rec.audible,
        db: rec.db,
        muted: rec.muted,
        solo: rec.solo,
        focus: rec.focus,
        firstSeenAt: rec.firstSeenAt,
        frames: Array.from(rec.frames.entries()),
      });
    }
    return out;
  }

  importSession(items?: SerializedTabSession[] | null): void {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (typeof item?.tabId !== "number") continue;
      this.tabs.set(item.tabId, {
        ...item,
        frames: new Map(Array.isArray(item.frames) ? item.frames : []),
        frameVu: new Map(),
      });
      if (item.firstSeenAt >= this.seqCounter) {
        this.seqCounter = item.firstSeenAt + 1;
      }
    }
  }

  upsertTabMeta(meta: TabMetaInput): InternalTabRecord {
    const { domain, shortHost } = extractDomainInfo(meta.url);
    let rec = this.tabs.get(meta.tabId);

    if (!rec) {
      const initialDb =
        domain && Object.prototype.hasOwnProperty.call(this.settings.domainDefaults, domain)
          ? clampDb(this.settings.domainDefaults[domain]!, false)
          : 0.0;

      rec = {
        tabId: meta.tabId,
        windowId: meta.windowId,
        url: meta.url ?? "",
        domain,
        shortHost,
        boundDomain: domain,
        userAdjusted: false,
        tabTitle: meta.title ?? "",
        favIconUrl: meta.favIconUrl ?? "",
        audible: Boolean(meta.audible),
        db: initialDb,
        muted: false,
        solo: false,
        focus: false,
        firstSeenAt: this.seqCounter++,
        frames: new Map(),
        frameVu: new Map(),
      };
      this.tabs.set(meta.tabId, rec);
      return rec;
    }

    rec.windowId = meta.windowId;
    if (meta.url !== undefined) {
      rec.url = meta.url;
      if (domain && domain !== rec.boundDomain) {
        rec.domain = domain;
        rec.shortHost = shortHost;
        rec.boundDomain = domain;
        // 다른 도메인으로 이동한 탭은 새 도메인의 기본 볼륨으로 초기화
        rec.db = Object.prototype.hasOwnProperty.call(this.settings.domainDefaults, domain)
          ? clampDb(this.settings.domainDefaults[domain]!, false)
          : 0.0;
        rec.userAdjusted = false;
      } else if (domain) {
        rec.domain = domain;
        rec.shortHost = shortHost;
      }
    }
    if (meta.title !== undefined) rec.tabTitle = meta.title;
    if (meta.favIconUrl !== undefined) rec.favIconUrl = meta.favIconUrl;
    if (meta.audible !== undefined) rec.audible = meta.audible;
    return rec;
  }

  updateFrameReport(meta: TabMetaInput, frameId: number, payload: FrameMediaPayload): void {
    const rec = this.upsertTabMeta(meta);
    if (payload.hasMedia) {
      rec.frames.set(frameId, payload);
      if (payload.corsRestricted && rec.db > 0) {
        rec.db = 0;
      }
    } else {
      rec.frames.delete(frameId);
      rec.frameVu.delete(frameId);
    }
  }

  removeFrame(tabId: number, frameId: number): void {
    const rec = this.tabs.get(tabId);
    if (!rec) return;
    rec.frames.delete(frameId);
    rec.frameVu.delete(frameId);
  }

  removeTab(tabId: number): void {
    this.tabs.delete(tabId);
  }

  updateFrameVu(tabId: number, frameId: number, vuLevel: number, vuPeak: number): void {
    const rec = this.tabs.get(tabId);
    if (!rec) return;
    rec.frameVu.set(frameId, { vuLevel, vuPeak });
  }

  hasKnownTab(tabId: number): boolean {
    return this.tabs.has(tabId);
  }

  getTrackedTabIds(): number[] {
    return Array.from(this.tabs.keys());
  }

  setTabDb(tabId: number, nextDb: number): boolean {
    const rec = this.tabs.get(tabId);
    if (!rec) return false;
    const isCors = this.isRecordCorsCapped(rec);
    rec.db = clampDb(nextDb, isCors);
    rec.userAdjusted = true;
    return true;
  }

  toggleTabMute(tabId: number): boolean {
    const rec = this.tabs.get(tabId);
    if (!rec) return false;
    rec.muted = !rec.muted;
    return true;
  }

  toggleTabMode(tabId: number, mode: ExclusiveMode, shiftKey: boolean): boolean {
    const visibleRecords = this.getVisibleRecords();
    if (!visibleRecords.some((r) => r.tabId === tabId)) return false;
    // 숨겨진 비미디어 레코드의 잔여 플래그도 함께 정리
    for (const r of this.tabs.values()) {
      if (!visibleRecords.includes(r)) {
        r.solo = false;
        r.focus = false;
      }
    }
    toggleExclusiveFlags(visibleRecords, tabId, mode, shiftKey);
    return true;
  }

  cycleFocusChannel(): number | null {
    const playing = this.getVisibleRecords()
      .filter((r) => this.isRecordPlaying(r))
      .sort((a, b) => a.firstSeenAt - b.firstSeenAt);
    if (playing.length === 0) return null;

    const currentIdx = playing.findIndex((r) => r.focus);
    for (const r of this.tabs.values()) {
      r.solo = false;
      r.focus = false;
    }
    const nextIdx = currentIdx < 0 ? 0 : currentIdx + 1;
    if (nextIdx >= playing.length) {
      // 마지막 채널 다음 차례에는 Focus를 해제해 전체 밸런스로 복귀
      return null;
    }
    playing[nextIdx]!.focus = true;
    return playing[nextIdx]!.tabId;
  }

  clearModes(): void {
    for (const r of this.tabs.values()) {
      r.solo = false;
      r.focus = false;
    }
  }

  /**
   * 도메인 기본 볼륨 핀 토글.
   * 열린 다른 동일 도메인 탭의 현재 볼륨은 덮어쓰지 않고 새 탭 초기값만 갱신·삭제한다.
   */
  toggleDomainPin(tabId: number): { domain: string; pinned: boolean; db: number } | null {
    const rec = this.tabs.get(tabId);
    if (!rec || !rec.domain) return null;
    if (isChannelPinned(this.settings.domainDefaults, rec.domain, rec.db)) {
      delete this.settings.domainDefaults[rec.domain];
      return { domain: rec.domain, pinned: false, db: rec.db };
    }
    this.settings.domainDefaults[rec.domain] = rec.db;
    return { domain: rec.domain, pinned: true, db: rec.db };
  }

  setAlpha(alpha: number): void {
    this.settings.alpha = clampAlpha(alpha);
  }

  setMasterDb(masterDb: number): void {
    this.settings.masterDb = clampDb(masterDb, false);
  }

  toggleMasterMute(): boolean {
    this.settings.masterMuted = !this.settings.masterMuted;
    return this.settings.masterMuted;
  }

  setTheme(theme: ThemeKey, modePref: ModePref): void {
    this.settings.theme = theme;
    this.settings.modePref = modePref;
  }

  private isRecordPlaying(rec: InternalTabRecord): boolean {
    for (const f of rec.frames.values()) {
      if (f.playingCount > 0) return true;
    }
    return rec.frames.size === 0 && rec.audible;
  }

  private isRecordCorsCapped(rec: InternalTabRecord): boolean {
    if (rec.frames.size === 0) return false;
    let hasAnyMedia = false;
    for (const f of rec.frames.values()) {
      if (f.hasMedia) {
        hasAnyMedia = true;
        if (!f.corsRestricted) return false;
      }
    }
    return hasAnyMedia;
  }

  private getVisibleRecords(): InternalTabRecord[] {
    const list: InternalTabRecord[] = [];
    for (const rec of this.tabs.values()) {
      let mediaCount = 0;
      for (const f of rec.frames.values()) {
        mediaCount += f.playingCount + f.pausedCount;
      }
      if (mediaCount > 0 || rec.audible) {
        list.push(rec);
      }
    }
    return list;
  }

  private buildMixerContext(visible: InternalTabRecord[]): MixerContextInput {
    return {
      alpha: this.settings.alpha,
      masterDb: this.settings.masterDb,
      masterMuted: this.settings.masterMuted,
      anySolo: visible.some((r) => r.solo),
      anyFocus: visible.some((r) => r.focus),
    };
  }

  computeTargetGainForTab(tabId: number): number {
    const rec = this.tabs.get(tabId);
    if (!rec) return this.settings.masterMuted ? 0 : 1;
    const visible = this.getVisibleRecords();
    const ctx = this.buildMixerContext(visible);
    return computeAppliedLinearGain(
      {
        tabId: rec.tabId,
        db: rec.db,
        muted: rec.muted,
        solo: rec.solo,
        focus: rec.focus,
        playing: this.isRecordPlaying(rec),
        corsCap: this.isRecordCorsCapped(rec),
      },
      ctx,
    );
  }

  collectVuLevels(): Array<{ tabId: number; vuLevel: number; vuPeak: number }> {
    const visible = this.getVisibleRecords();
    return visible.map((rec) => {
      const playing = this.isRecordPlaying(rec);
      if (!playing || rec.muted || this.settings.masterMuted) {
        return { tabId: rec.tabId, vuLevel: 0, vuPeak: 0 };
      }
      let vuLevel = 0;
      let vuPeak = 0;
      for (const v of rec.frameVu.values()) {
        if (v.vuLevel > vuLevel) vuLevel = v.vuLevel;
        if (v.vuPeak > vuPeak) vuPeak = v.vuPeak;
      }
      return { tabId: rec.tabId, vuLevel, vuPeak };
    });
  }

  buildSnapshot(): ConsoleSnapshot {
    const visible = this.getVisibleRecords();
    const channels: TabChannelState[] = visible.map((rec) => {
      let mediaCount = 0;
      let richTitle = "";
      for (const f of rec.frames.values()) {
        mediaCount += f.playingCount + f.pausedCount;
        if (!richTitle && f.mediaTitle) richTitle = f.mediaTitle;
      }
      const playing = this.isRecordPlaying(rec);
      const corsCap = this.isRecordCorsCapped(rec);
      let vuLevel = 0;
      let vuPeak = 0;
      if (playing && !rec.muted && !this.settings.masterMuted) {
        for (const v of rec.frameVu.values()) {
          if (v.vuLevel > vuLevel) vuLevel = v.vuLevel;
          if (v.vuPeak > vuPeak) vuPeak = v.vuPeak;
        }
      }

      return {
        tabId: rec.tabId,
        windowId: rec.windowId,
        title: richTitle || rec.tabTitle || rec.shortHost || "미디어 탭",
        domain: rec.domain,
        shortHost: rec.shortHost || "tab",
        favIconUrl: rec.favIconUrl,
        playing,
        audible: rec.audible,
        mediaCount: Math.max(mediaCount, rec.audible ? 1 : 0),
        db: corsCap ? Math.min(0, rec.db) : rec.db,
        muted: rec.muted,
        solo: rec.solo,
        focus: rec.focus,
        corsCap,
        vuLevel,
        vuPeak,
        firstSeenAt: rec.firstSeenAt,
      };
    });

    // 좌측: 재생 중(최초 등장 순) -> 우측: 일시정지(최초 등장 순)
    channels.sort((a, b) => {
      if (a.playing !== b.playing) return a.playing ? -1 : 1;
      return a.firstSeenAt - b.firstSeenAt;
    });

    return {
      settings: this.getSettings(),
      channels,
    };
  }
}
