#!/usr/bin/env python3
"""color-preset.md의 스튜디오 틸 토큰으로 확장 프로그램 PNG 아이콘(16/32/48/128)을 생성한다."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

# color-preset.md 스튜디오 틸 다크 토큰 바인딩
BG = (9, 17, 18, 255)          # #091112
SURFACE = (19, 29, 30, 255)    # #131d1e
RAISED = (29, 41, 42, 255)     # #1d292a
BORDER = (45, 59, 60, 255)     # #2d3b3c
PRIMARY = (0, 189, 206, 255)   # #00bdce
ACCENT = (230, 151, 50, 255)   # #e69732
TEXT = (229, 237, 238, 255)    # #e5edee
TRANSPARENT = (0, 0, 0, 0)


def in_rounded_rect(x: float, y: float, x0: float, y0: float, x1: float, y1: float, r: float) -> bool:
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def sample_console_pixel(u: float, v: float) -> tuple[int, int, int, int]:
    """정규화 좌표 (u, v) in [0, 1]^2 에서 콘솔 3-페이더 심볼 색상을 계산한다."""
    # 외곽 둥근 사각형 베젤
    if not in_rounded_rect(u, v, 0.04, 0.04, 0.96, 0.96, 0.20):
        return TRANSPARENT
    if not in_rounded_rect(u, v, 0.085, 0.085, 0.915, 0.915, 0.16):
        return BORDER
    if not in_rounded_rect(u, v, 0.11, 0.11, 0.89, 0.89, 0.14):
        return BG

    # 세 줄의 세로 페이더 트랙 (좌: Focus 주연 채널, 중: 감쇠 채널, 우: Solo/핀 포인트 채널)
    columns = [
        (0.28, 0.34, PRIMARY, True),
        (0.50, 0.62, RAISED, False),
        (0.72, 0.46, ACCENT, False),
    ]
    track_top, track_bot = 0.21, 0.79

    for cx, cap_y, cap_color, is_focus in columns:
        # 페이더 캡(노브)
        cap_w, cap_h = 0.082, 0.068
        if in_rounded_rect(u, v, cx - cap_w, cap_y - cap_h, cx + cap_w, cap_y + cap_h, 0.025):
            if abs(v - cap_y) <= 0.013 and abs(u - cx) <= 0.052:
                return BG if is_focus or cap_color == ACCENT else TEXT
            return cap_color

        # 슬롯 하단 활성 게인 바 / 상단 빈 슬롯
        slot_w = 0.026
        if in_rounded_rect(u, v, cx - slot_w, track_top, cx + slot_w, track_bot, 0.015):
            if v >= cap_y:
                return PRIMARY if is_focus else BORDER
            return BG

    return SURFACE


def render_icon(size: int) -> bytes:
    """2x2 슈퍼샘플링으로 계단 현상 없는 RGBA PNG 바이트열을 만든다."""
    ss = 3 if size <= 32 else 2
    rows: list[bytes] = []
    for py in range(size):
        row = bytearray([0])  # PNG filter type 0 (None)
        for px in range(size):
            r_sum = g_sum = b_sum = a_sum = 0
            for sy in range(ss):
                for sx in range(ss):
                    u = (px + (sx + 0.5) / ss) / size
                    v = (py + (sy + 0.5) / ss) / size
                    r, g, b, a = sample_console_pixel(u, v)
                    r_sum += r * a
                    g_sum += g * a
                    b_sum += b * a
                    a_sum += a
            total_samples = ss * ss
            if a_sum == 0:
                row.extend((0, 0, 0, 0))
            else:
                out_a = round(a_sum / total_samples)
                row.extend((
                    round(r_sum / a_sum),
                    round(g_sum / a_sum),
                    round(b_sum / a_sum),
                    out_a,
                ))
        rows.append(bytes(row))

    raw_data = b"".join(rows)

    def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw_data, level=9)
    return b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", idat) + png_chunk(b"IEND", b"")


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    icons_dir = root / "static" / "icons"
    icons_dir.mkdir(parents=True, exist_ok=True)
    for sz in (16, 32, 48, 128):
        target = icons_dir / f"icon{sz}.png"
        target.write_bytes(render_icon(sz))
        print(f"Generated {target.relative_to(root)} ({target.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
