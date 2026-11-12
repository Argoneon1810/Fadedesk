import {
  clampDb,
  focusDimDbToAlpha,
  getFocusDimDb,
  MAX_FOCUS_DIM_DB,
  MIN_DB,
  parseDbInput,
  parseFocusInput,
} from "../shared/mixer-math";

/**
 * 디지털 dB 수치창 클릭 시 의도치 않은 0dB 리셋 대신 인라인 숫자 편집기를 여는 모듈.
 * - 클릭(또는 포커스 후 Enter): 현재 dB 숫자를 전체 선택한 채 입력창 활성화
 * - Enter: 파싱된 dB 즉시 반영 (유효하지 않은 문자열이면 기존 볼륨 유지)
 * - Esc: 변경 취소 및 원래 표시로 복귀
 * - 외부 클릭(blur): 값을 수정한 경우에만 반영하고, 실수로 클릭했다가 빠져나간 경우 기존 볼륨 보존
 * - 입력 중 ↑/↓: ±0.5dB (Shift: ±0.1dB) 증감
 */

export interface DbInlineEditorOptions {
  box: HTMLElement;
  displayRow: HTMLElement;
  editRow: HTMLElement;
  input: HTMLInputElement;
  subEl: HTMLElement;
  getCurrentDb: () => number;
  isCorsCapped: () => boolean;
  onSelect?: () => void;
  onCommitDb: (nextDb: number) => void;
  onAfterExit: () => void;
}

export function attachDbInlineEditor(opts: DbInlineEditorOptions): void {
  const {
    box,
    displayRow,
    editRow,
    input,
    subEl,
    getCurrentDb,
    isCorsCapped,
    onSelect,
    onCommitDb,
    onAfterExit,
  } = opts;

  let initialText = "";
  let initialDb = 0;
  let handledExit = false;

  function openEditor(): void {
    if (box.dataset.editing === "true") return;
    onSelect?.();

    initialDb = getCurrentDb();
    initialText = !Number.isFinite(initialDb) || initialDb <= MIN_DB ? String(MIN_DB) : initialDb.toFixed(1);
    handledExit = false;

    box.dataset.editing = "true";
    displayRow.classList.add("hidden");
    editRow.classList.remove("hidden");
    subEl.textContent = "직접 입력";
    input.value = initialText;

    input.focus();
    input.select();
  }

  function closeEditor(mode: "commit" | "cancel" | "blur"): void {
    if (box.dataset.editing !== "true") return;
    const raw = input.value;

    delete box.dataset.editing;
    editRow.classList.add("hidden");
    displayRow.classList.remove("hidden");

    if (mode === "commit") {
      const parsed = parseDbInput(raw, isCorsCapped());
      if (parsed !== null) {
        onCommitDb(parsed);
      }
    } else if (mode === "blur") {
      // 실수로 클릭한 뒤 수정 없이 바깥을 누른 경우에는 기존 볼륨을 건드리지 않는다.
      if (raw.trim() !== initialText.trim()) {
        const parsed = parseDbInput(raw, isCorsCapped());
        if (parsed !== null && Math.abs(parsed - initialDb) > 1e-6) {
          onCommitDb(parsed);
        }
      }
    }

    onAfterExit();
  }

  box.addEventListener("click", (ev) => {
    if (box.dataset.editing === "true") return;
    ev.stopPropagation();
    openEditor();
  });

  box.addEventListener("keydown", (ev) => {
    if (box.dataset.editing === "true") return;
    if (ev.key === "Enter") {
      ev.preventDefault();
      ev.stopPropagation();
      openEditor();
    }
  });

  input.addEventListener("pointerdown", (ev) => {
    ev.stopPropagation();
  });

  input.addEventListener("click", (ev) => {
    ev.stopPropagation();
  });

  input.addEventListener("keydown", (ev) => {
    ev.stopPropagation();
    if (ev.key === "Enter") {
      ev.preventDefault();
      handledExit = true;
      closeEditor("commit");
      input.blur();
      return;
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      handledExit = true;
      closeEditor("cancel");
      input.blur();
      return;
    }
    if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
      ev.preventDefault();
      const base = parseDbInput(input.value, isCorsCapped()) ?? getCurrentDb();
      const step = ev.shiftKey ? 0.1 : 0.5;
      const next = clampDb(base + (ev.key === "ArrowUp" ? step : -step), isCorsCapped());
      input.value = next.toFixed(1);
      input.select();
    }
  });

  input.addEventListener("blur", () => {
    if (handledExit) {
      handledExit = false;
      return;
    }
    closeEditor("blur");
  });
}

export interface AlphaInlineEditorOptions {
  box: HTMLElement;
  displayEl: HTMLElement;
  editRow: HTMLElement;
  input: HTMLInputElement;
  getCurrentAlpha: () => number;
  onCommitAlpha: (nextAlpha: number) => void;
  onAfterExit: () => void;
}

/**
 * 상단 Focus α 수치창(예: "0.70 · -12dB") 클릭 시 감쇠 dB(또는 비율)를 직접 타이핑해 지정하는 편집기.
 * 다른 채널·마스터 페이더 수치창과 동일한 조작 경험(클릭 편집, Enter 적용, Esc 취소, ↑/↓ 증감)을 제공한다.
 */
export function attachAlphaInlineEditor(opts: AlphaInlineEditorOptions): void {
  const { box, displayEl, editRow, input, getCurrentAlpha, onCommitAlpha, onAfterExit } = opts;

  let initialText = "";
  let initialAlpha = 0.7;
  let handledExit = false;

  function currentDimText(alpha: number): string {
    const dim = getFocusDimDb(alpha);
    if (!Number.isFinite(dim) || dim <= -MAX_FOCUS_DIM_DB) return String(-MAX_FOCUS_DIM_DB);
    return dim.toFixed(1);
  }

  function openEditor(): void {
    if (box.dataset.editing === "true") return;
    initialAlpha = getCurrentAlpha();
    initialText = currentDimText(initialAlpha);
    handledExit = false;

    box.dataset.editing = "true";
    displayEl.classList.add("hidden");
    editRow.classList.remove("hidden");
    input.value = initialText;
    input.focus();
    input.select();
  }

  function closeEditor(mode: "commit" | "cancel" | "blur"): void {
    if (box.dataset.editing !== "true") return;
    const raw = input.value;

    delete box.dataset.editing;
    editRow.classList.add("hidden");
    displayEl.classList.remove("hidden");

    if (mode === "commit") {
      const parsed = parseFocusInput(raw);
      if (parsed !== null) onCommitAlpha(parsed);
    } else if (mode === "blur") {
      if (raw.trim() !== initialText.trim()) {
        const parsed = parseFocusInput(raw);
        if (parsed !== null && Math.abs(parsed - initialAlpha) > 1e-6) {
          onCommitAlpha(parsed);
        }
      }
    }
    onAfterExit();
  }

  box.addEventListener("click", (ev) => {
    if (box.dataset.editing === "true") return;
    ev.stopPropagation();
    openEditor();
  });

  box.addEventListener("keydown", (ev) => {
    if (box.dataset.editing === "true") return;
    if (ev.key === "Enter") {
      ev.preventDefault();
      ev.stopPropagation();
      openEditor();
    }
  });

  input.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  input.addEventListener("click", (ev) => ev.stopPropagation());

  input.addEventListener("keydown", (ev) => {
    ev.stopPropagation();
    if (ev.key === "Enter") {
      ev.preventDefault();
      handledExit = true;
      closeEditor("commit");
      input.blur();
      return;
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      handledExit = true;
      closeEditor("cancel");
      input.blur();
      return;
    }
    if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
      ev.preventDefault();
      const parsedAlpha = parseFocusInput(input.value) ?? getCurrentAlpha();
      const curDim = getFocusDimDb(parsedAlpha);
      const baseDim = Number.isFinite(curDim) ? curDim : -MAX_FOCUS_DIM_DB;
      const step = ev.shiftKey ? 0.1 : 1.0;
      const nextDim = Math.max(-MAX_FOCUS_DIM_DB, Math.min(0, Math.round((baseDim + (ev.key === "ArrowUp" ? step : -step)) * 10) / 10));
      const nextAlpha = focusDimDbToAlpha(nextDim);
      input.value = currentDimText(nextAlpha);
      input.select();
    }
  });

  input.addEventListener("blur", () => {
    if (handledExit) {
      handledExit = false;
      return;
    }
    closeEditor("blur");
  });
}
