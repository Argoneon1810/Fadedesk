/**
 * VU 갱신(80ms)처럼 자주 도는 그리기에서 "값이 바뀔 때만" DOM에 쓰는 도우미.
 *
 * 왜: 같은 글자를 textContent로 다시 넣어도 Chrome은 글자 노드를 갈아 끼우고 문서 배치(layout)를 다시 계산한다.
 * 인라인 스타일도 읽으면 "#aabbcc"가 "rgb(…)"로 바뀌어 돌아오므로 읽어서 비교할 수 없다. 그래서 마지막으로 쓴 값을 따로 기억한다.
 */

const lastStyle = new WeakMap<HTMLElement, Record<string, string>>();

/** 글자가 달라졌을 때만 바꾼다 */
export function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

/** 인라인 스타일 하나를 마지막으로 쓴 값과 다를 때만 바꾼다 */
export function setStyle(el: HTMLElement, prop: "color" | "backgroundColor" | "opacity", value: string): void {
  let cache = lastStyle.get(el);
  if (!cache) {
    cache = {};
    lastStyle.set(el, cache);
  }
  if (cache[prop] === value) return;
  cache[prop] = value;
  el.style[prop] = value;
}
