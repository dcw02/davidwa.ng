#!/usr/bin/env python3
"""Math rendering utility using MathJax v4 with global SVG font cache."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import OrderedDict
from html import escape
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple


_FONT_CACHE: "OrderedDict[str, str]" = OrderedDict()


def render_math(latex: str) -> str:
    """Render LaTeX math to SVG using MathJax (global font cache aware)."""
    payload = _run_tex2svg(latex)
    _update_font_cache(payload.get("glyphs", []))
    return payload["svg"].strip()


def _run_tex2svg(latex: str) -> Dict[str, object]:
    script_path = Path(__file__).parent / "tex2svg.js"
    result = subprocess.run(
        ["node", str(script_path), "-"],
        input=latex.strip(),
        capture_output=True,
        text=True,
        check=True,
    )
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:  # pragma: no cover - diagnostic guard
        raise RuntimeError(result.stderr or "Failed to parse tex2svg output") from exc


def _update_font_cache(glyphs: Iterable[Dict[str, str]]) -> None:
    for glyph in glyphs:
        glyph_id = glyph.get("id")
        path_data = glyph.get("d")
        if glyph_id and path_data and glyph_id not in _FONT_CACHE:
            _FONT_CACHE[glyph_id] = path_data


def math_font_cache_svg() -> str:
    """Return the shared hidden SVG block that hosts cached glyphs."""
    if not _FONT_CACHE:
        return ""
    paths = "".join(
        f'<path id="{escape(gid)}" d="{escape(d, quote=True)}"></path>'
        for gid, d in _FONT_CACHE.items()
    )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" id="MJX-SVG-global-cache" '
        'focusable="false" style="display:none">'
        f"<defs>{paths}</defs></svg>"
    )


def reset_math_font_cache() -> None:
    """Clear the accumulated glyph cache (call once per page)."""
    _FONT_CACHE.clear()


def format_math_block(latex: str) -> str:
    """Format LaTeX as a math display block with wrapper div."""
    svg = render_math(latex)
    return f'<div class="math-display">{svg}</div>'


def render_math_blocks(
    latex_items: Sequence[str], *, reset_cache: bool = True
) -> Tuple[str, List[str]]:
    """Render multiple equations, returning (cache_svg, [block_html, ...])."""
    if reset_cache:
        reset_math_font_cache()
    blocks: List[str] = []
    for item in latex_items:
        tex = item.strip()
        if not tex:
            continue
        blocks.append(format_math_block(tex))
    cache_svg = math_font_cache_svg()
    return cache_svg, blocks


def _decode_delimiter(value: str) -> str:
    return value.encode("utf-8").decode("unicode_escape")


def _split_equations(raw: str, delimiter: str) -> List[str]:
    if not raw.strip():
        return []
    if delimiter:
        parts = raw.split(delimiter)
    else:
        parts = [raw]
    return [part.strip() for part in parts if part.strip()]


def main():
    """CLI: read LaTeX from stdin and emit cache + block list."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--delimiter",
        default="\n\n",
        help="Delimiter string (default blank line). Use escape sequences like \\n",
    )
    args = parser.parse_args()

    raw_input = sys.stdin.read()
    delimiter = _decode_delimiter(args.delimiter)
    equations = _split_equations(raw_input, delimiter)
    if not equations:
        return

    cache_svg, blocks = render_math_blocks(equations, reset_cache=True)
    print(json.dumps({"cache": cache_svg, "blocks": blocks}))


if __name__ == "__main__":
    main()
