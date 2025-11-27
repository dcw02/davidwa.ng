#!/usr/bin/env python3
"""Generate writing post HTML from Markdown sources."""

from __future__ import annotations

import argparse
import re
import sys
from collections import OrderedDict
from dataclasses import dataclass, field
from html import escape as html_escape
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

from highlight_code import format_code_block
from render_math import render_math_blocks

ROOT_DIR = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT_DIR / "content" / "writing"
OUTPUT_DIR = ROOT_DIR / "_content" / "writing"

EM_DASH_HTML = '<span class="emdash-box">&mdash;</span>'
EN_DASH_HTML = "&ndash;"

CODE_FENCE_RE = re.compile(r"^```(.*)$")
ORDERED_LIST_RE = re.compile(r"^(\d+)\.\s+(.*)")
IMAGE_BLOCK_RE = re.compile(
    r'!\[(?P<alt>.*?)\]\((?P<src>\S+?)(?:\s+"(?P<title>[^"]+)")?\)'
)
TABLE_DIVIDER_RE = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$")
SUBTITLE_KEY_RE = re.compile(r"^subtitle_(\d+)$", re.IGNORECASE)
FOOTNOTE_DEF_RE = re.compile(r"^\[\^(?P<label>[^\]]+)\]:\s*(?P<body>.*)$")
LINK_DEF_RE = re.compile(r'^\[(?P<label>[^\]]+)\]:\s*(?P<url>\S+)(?:\s+"(?P<title>[^"]*)")?$')


@dataclass
class ListItem:
    text: str
    children: Optional["Block"] = None


@dataclass
class Block:
    kind: str
    text: str = ""
    level: int = 0
    language: str = ""
    items: List[ListItem] = field(default_factory=list)
    paragraphs: List[List[str]] = field(default_factory=list)
    caption: str = ""
    headers: List[str] = field(default_factory=list)
    rows: List[List[str]] = field(default_factory=list)
    src: str = ""
    alt: str = ""


def parse_front_matter(raw: str) -> Tuple[dict, str]:
    lines = raw.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("Markdown file must start with '---' front matter delimiter")

    front_lines: List[str] = []
    end_index: Optional[int] = None
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            end_index = idx
            break
        front_lines.append(lines[idx])

    if end_index is None:
        raise ValueError("Front matter is not closed with '---'")

    metadata = {}
    for raw_line in front_lines:
        if not raw_line.strip():
            continue
        if ":" not in raw_line:
            raise ValueError(f"Invalid front matter line: {raw_line}")
        key, value = raw_line.split(":", 1)
        metadata[key.strip()] = value.strip()

    remainder = "\n".join(lines[end_index + 1:]).lstrip("\n")
    return metadata, remainder


def sanitize_slug(raw_slug: Optional[str], fallback: str) -> str:
    candidate = (raw_slug or fallback).strip().lower()
    candidate = re.sub(r"[^a-z0-9-]+", "-", candidate).strip("-")
    if not candidate:
        raise ValueError("Slug cannot be empty")
    return candidate


def collapse_text(value: str) -> str:
    if not value:
        return ""
    parts = [part.strip() for part in value.splitlines() if part.strip()]
    return " ".join(parts).strip()


def parse_markdown_body(body: str) -> Tuple[List[Block], Optional[str], str, dict[str, str], dict[str, dict[str, str]]]:
    blocks: List[Block] = []
    lines = body.splitlines()
    i = 0
    pending_table_caption: Optional[str] = None
    document_title: Optional[str] = None
    right_rail_chunks: List[str] = []
    footnote_defs: dict[str, str] = {}
    link_defs: dict[str, dict[str, str]] = {}

    # Extract footnote definitions (Markdown-style [^label]: text)
    while i < len(lines):
        match = FOOTNOTE_DEF_RE.match(lines[i])
        if match:
            label = match.group("label").strip()
            body_text = match.group("body").rstrip()
            collected: List[str] = []
            if body_text:
                collected.append(body_text.strip())
            lines[i] = ""
            i += 1
            while i < len(lines):
                continuation = lines[i]
                if not continuation.startswith("    ") and not continuation.startswith("\t"):
                    break
                collected.append(continuation.lstrip())
                lines[i] = ""
                i += 1
            footnote_defs[label] = "\n".join(collected).strip()
            continue
        i += 1

    # Extract link definitions ([label]: url "optional title")
    i = 0
    while i < len(lines):
        match = LINK_DEF_RE.match(lines[i])
        if match:
            label = match.group("label").strip().lower()
            url = match.group("url").strip()
            title = (match.group("title") or "").strip()
            link_defs[label] = {"url": url, "title": title}
            lines[i] = ""
        i += 1

    i = 0

    def upcoming_block_type(line: str) -> Optional[str]:
        stripped = line.strip()
        if not stripped:
            return None
        if stripped.startswith("# "):
            return "h1"
        if stripped == r"\[":
            return "math"
        if stripped.startswith("### "):
            return "h3"
        if stripped.startswith("## "):
            return "h2"
        if stripped.startswith("#"):
            raise ValueError(
                "Unsupported heading level; only a single '# ' title and h2/h3 are allowed"
            )
        # Horizontal rule: *** or ___ (not --- since that's em-dash)
        if re.match(r'^(\*{3,}|_{3,})$', stripped):
            return "hr"
        if stripped.startswith(">"):
            return "blockquote"
        if stripped.startswith("- "):
            return "ul"
        if ORDERED_LIST_RE.match(stripped):
            return "ol"
        if CODE_FENCE_RE.match(stripped):
            return "code"
        if IMAGE_BLOCK_RE.match(stripped):
            return "image"
        if is_table_start(lines, i):
            return "table"
        return None

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            i += 1
            continue

        if stripped.lower().startswith("table:"):
            caption_candidate = stripped.split(":", 1)[1].strip()
            next_idx = i + 1
            while next_idx < len(lines) and not lines[next_idx].strip():
                next_idx += 1
            if next_idx < len(lines) and is_table_start(lines, next_idx):
                pending_table_caption = caption_candidate
                i += 1
                continue
        if stripped.startswith(":::rail-right"):
            i += 1
            chunk_lines: List[str] = []
            while i < len(lines):
                if lines[i].strip() == ":::":  # closing fence
                    break
                chunk_lines.append(lines[i])
                i += 1
            if i >= len(lines) or lines[i].strip() != ":::":  # missing terminator
                raise ValueError("Unterminated :::rail-right block")
            right_rail_chunks.append("\n".join(chunk_lines).strip())
            i += 1
            continue

        if stripped.startswith("<"):
            raw_lines: List[str] = []
            while i < len(lines):
                current = lines[i]
                current_stripped = current.strip()
                if not current_stripped:
                    break
                if not current_stripped.startswith("<"):
                    break
                raw_lines.append(current)
                i += 1
            blocks.append(Block(kind="raw_html", text="\n".join(raw_lines)))
            continue

        block_type = upcoming_block_type(line)

        if block_type == "math":
            start = i + 1
            end = start
            while end < len(lines) and lines[end].strip() != r"\]":
                end += 1
            if end >= len(lines):
                raise ValueError("Unterminated math block (missing '\\]')")
            math_tex = "\n".join(lines[start:end]).strip()
            blocks.append(Block(kind="math", text=math_tex))
            i = end + 1
            continue

        if block_type == "h1":
            heading_text = line.strip()[2:].strip()
            if not heading_text:
                raise ValueError("Title heading cannot be empty")
            if document_title is not None:
                raise ValueError("Multiple H1 headings found; only one title heading is allowed")
            document_title = heading_text
            i += 1
            continue

        if block_type in {"h2", "h3"}:
            level = 2 if block_type == "h2" else 3
            heading_text = line.strip()[level + 1:].strip()
            blocks.append(Block(kind=block_type, level=level, text=heading_text))
            i += 1
            continue

        if block_type == "hr":
            blocks.append(Block(kind="hr"))
            i += 1
            continue

        if block_type == "blockquote":
            quote_lines: List[str] = []
            while i < len(lines) and lines[i].lstrip().startswith(">"):
                current = lines[i].lstrip()[1:]
                if current.startswith(" "):
                    current = current[1:]
                quote_lines.append(current)
                i += 1
            paragraphs: List[List[str]] = []
            current_para: List[str] = []
            for q_line in quote_lines:
                if not q_line.strip():
                    if current_para:
                        paragraphs.append(current_para)
                        current_para = []
                    continue
                current_para.append(q_line)
            if current_para:
                paragraphs.append(current_para)
            blocks.append(Block(kind="blockquote", paragraphs=paragraphs))
            continue

        if block_type == "ul":
            list_items, i = parse_list_items(lines, i, "ul", base_indent=0)
            blocks.append(Block(kind="ul", items=list_items))
            continue

        if block_type == "ol":
            list_items, i = parse_list_items(lines, i, "ol", base_indent=0)
            blocks.append(Block(kind="ol", items=list_items))
            continue

        if block_type == "code":
            fence_match = CODE_FENCE_RE.match(line.strip())
            language = fence_match.group(1).strip() if fence_match and fence_match.group(1) else "text"
            start = i + 1
            end = start
            while end < len(lines) and not CODE_FENCE_RE.match(lines[end].strip()):
                end += 1
            if end >= len(lines):
                raise ValueError("Unterminated code fence block")
            code_body = "\n".join(lines[start:end])
            blocks.append(Block(kind="code", language=language, text=code_body))
            i = end + 1
            continue

        if block_type == "image":
            match = IMAGE_BLOCK_RE.match(stripped)
            if not match:
                raise ValueError("Invalid image syntax")
            alt = match.group("alt") or ""
            src = match.group("src") or ""
            title = match.group("title") or ""
            blocks.append(
                Block(
                    kind="image",
                    alt=alt.strip(),
                    src=src.strip(),
                    caption=title.strip(),
                )
            )
            i += 1
            continue

        if block_type == "table":
            table_block, next_index = parse_table_block(lines, i)
            if not table_block:
                raise ValueError("Failed to parse markdown table")
            if pending_table_caption and not table_block.caption:
                table_block.caption = pending_table_caption
            pending_table_caption = None
            blocks.append(table_block)
            i = next_index
            continue

        # Paragraph fallback
        para_lines: List[str] = []
        while i < len(lines):
            current = lines[i]
            if not current.strip():
                break
            if upcoming_block_type(current):
                break
            para_lines.append(current)
            i += 1
        blocks.append(Block(kind="paragraph", text="\n".join(para_lines)))

    right_rail_html = "\n".join(chunk for chunk in right_rail_chunks if chunk)
    return blocks, document_title, right_rail_html, footnote_defs, link_defs


def is_table_start(lines: List[str], index: int) -> bool:
    if index + 1 >= len(lines):
        return False
    header = lines[index]
    divider = lines[index + 1]
    if "|" not in header:
        return False
    if not is_table_divider(divider):
        return False
    return True


def is_table_divider(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    return bool(TABLE_DIVIDER_RE.match(stripped))


def split_table_cells(line: str) -> List[str]:
    stripped = line.strip()
    if not stripped:
        return []
    working = stripped.strip("|")
    cells = [cell.strip() for cell in working.split("|")]
    return cells


def normalize_cells(cells: List[str], width: int) -> List[str]:
    if len(cells) < width:
        cells = cells + [""] * (width - len(cells))
    elif len(cells) > width:
        cells = cells[:width]
    return cells


def parse_table_block(lines: List[str], start: int) -> Tuple[Block, int]:
    header_cells = split_table_cells(lines[start])
    divider_idx = start + 1
    divider_line = lines[divider_idx]
    if not is_table_divider(divider_line):
        raise ValueError("Invalid table divider line")
    rows: List[List[str]] = []
    idx = divider_idx + 1
    while idx < len(lines):
        current = lines[idx]
        if not current.strip():
            break
        if "|" not in current:
            break
        row_cells = split_table_cells(current)
        rows.append(row_cells)
        idx += 1

    normalized_rows = [
        normalize_cells(row, len(header_cells)) for row in rows
    ]

    inline_caption = ""
    while idx < len(lines) and not lines[idx].strip():
        lines[idx] = ""
        idx += 1
    if idx < len(lines):
        caption_match = re.match(r"^\s*(?:Table|Caption)\s*:\s*(.+)$", lines[idx].strip(), re.IGNORECASE)
        if caption_match:
            inline_caption = caption_match.group(1).strip()
            lines[idx] = ""
            idx += 1

    block = Block(
        kind="table",
        headers=header_cells,
        rows=normalized_rows,
        caption=inline_caption,
    )
    return block, idx


def get_list_indent(line: str) -> int:
    """Return the number of leading spaces in a line."""
    return len(line) - len(line.lstrip())


def parse_list_items(lines: List[str], start: int, list_kind: str, base_indent: int = 0) -> Tuple[List[ListItem], int]:
    """Parse list items, handling nested lists recursively.

    Returns (items, next_index) where items is a list of ListItem objects.
    """
    items: List[ListItem] = []
    i = start

    # Pattern for detecting list markers
    ul_pattern = re.compile(r'^(\s*)- (.*)$')
    ol_pattern = re.compile(r'^(\s*)(\d+)\. (.*)$')

    while i < len(lines):
        line = lines[i]
        if not line.strip():
            # Empty line ends the list at this level
            break

        indent = get_list_indent(line)

        # If we encounter a line with less or equal indent that's not a list item, stop
        if indent < base_indent:
            break

        # Check for list markers at current or greater indent
        ul_match = ul_pattern.match(line)
        ol_match = ol_pattern.match(line)

        if ul_match and indent == base_indent and list_kind == "ul":
            item_text = ul_match.group(2)
            i += 1
            # Check for nested list
            if i < len(lines):
                next_line = lines[i]
                next_indent = get_list_indent(next_line)
                next_ul = ul_pattern.match(next_line)
                next_ol = ol_pattern.match(next_line)
                if next_indent > base_indent and (next_ul or next_ol):
                    nested_kind = "ul" if next_ul else "ol"
                    nested_items, i = parse_list_items(lines, i, nested_kind, next_indent)
                    items.append(ListItem(text=item_text, children=Block(kind=nested_kind, items=nested_items)))
                else:
                    items.append(ListItem(text=item_text))
            else:
                items.append(ListItem(text=item_text))
        elif ol_match and indent == base_indent and list_kind == "ol":
            item_text = ol_match.group(3)
            i += 1
            # Check for nested list
            if i < len(lines):
                next_line = lines[i]
                next_indent = get_list_indent(next_line)
                next_ul = ul_pattern.match(next_line)
                next_ol = ol_pattern.match(next_line)
                if next_indent > base_indent and (next_ul or next_ol):
                    nested_kind = "ul" if next_ul else "ol"
                    nested_items, i = parse_list_items(lines, i, nested_kind, next_indent)
                    items.append(ListItem(text=item_text, children=Block(kind=nested_kind, items=nested_items)))
                else:
                    items.append(ListItem(text=item_text))
            else:
                items.append(ListItem(text=item_text))
        elif indent > base_indent:
            # This is a nested item - it should have been handled above
            # If we're here, it means the nested list type doesn't match, so stop
            break
        else:
            # Not a list item at our level, stop
            break

    return items, i


def render_text_segment(segment: str) -> str:
    escaped = html_escape(segment)
    # Convert markdown-style dashes (must do --- before --)
    escaped = escaped.replace("---", EM_DASH_HTML)
    escaped = escaped.replace("--", EN_DASH_HTML)
    # Convert Unicode dashes to styled HTML
    escaped = escaped.replace("\u2014", EM_DASH_HTML)  # em-dash —
    escaped = escaped.replace("\u2013", EN_DASH_HTML)  # en-dash –
    return escaped


def render_inline(text: str, allow_links: bool = True, sidenotes: Optional["SidenoteRegistry"] = None, link_defs: Optional[dict[str, dict[str, str]]] = None) -> str:
    if not text:
        return ""
    result: List[str] = []
    i = 0
    start = 0

    def flush(end: int) -> None:
        nonlocal start
        if start < end:
            result.append(render_text_segment(text[start:end]))
        start = end

    while i < len(text):
        char = text[i]
        if char == "`":
            flush(i)
            i += 1
            code_start = i
            while i < len(text) and text[i] != "`":
                i += 1
            if i >= len(text):
                code_content = text[code_start:]
                start = i = len(text)
            else:
                code_content = text[code_start:i]
                i += 1
                start = i
            result.append(f"<code>{html_escape(code_content)}</code>")
            continue

        if allow_links and char == "[":
            close = find_closing(text, i + 1, "]")
            if close != -1 and close + 1 < len(text) and text[close + 1] == "(":
                # Inline link: [text](url)
                end = find_closing(text, close + 2, ")")
                if end != -1:
                    flush(i)
                    label = render_inline(text[i + 1:close], allow_links=False, link_defs=link_defs)
                    href = html_escape(text[close + 2:end], quote=True)
                    result.append(f"<a class=\"highlight\" href=\"{href}\">{label}</a>")
                    i = end + 1
                    start = i
                    continue
            if close != -1 and close + 1 < len(text) and text[close + 1] == "[" and link_defs:
                # Reference link: [text][ref]
                ref_close = find_closing(text, close + 2, "]")
                if ref_close != -1:
                    ref_key = text[close + 2:ref_close].strip().lower()
                    # Empty ref uses the link text as key: [text][]
                    if not ref_key:
                        ref_key = text[i + 1:close].strip().lower()
                    if ref_key in link_defs:
                        flush(i)
                        label = render_inline(text[i + 1:close], allow_links=False, link_defs=link_defs)
                        href = html_escape(link_defs[ref_key]["url"], quote=True)
                        result.append(f"<a class=\"highlight\" href=\"{href}\">{label}</a>")
                        i = ref_close + 1
                        start = i
                        continue

        if char == "[" and i + 1 < len(text) and text[i + 1] == "^":
            close = find_closing(text, i + 2, "]")
            if close != -1:
                label = (text[i + 2:close] or "").strip()
                if not label:
                    i += 1
                    continue
                if not sidenotes:
                    raise ValueError(f"Sidenote reference [^{label}] found but sidenotes are not enabled")
                flush(i)
                result.append(sidenotes.render_reference(label))
                i = close + 1
                start = i
                continue

        if char == "\\":
            flush(i)
            i += 1
            if i < len(text):
                result.append(render_text_segment(text[i]))
                i += 1
                start = i
            continue

        # Bold: **text**
        if char == "*" and i + 1 < len(text) and text[i + 1] == "*":
            close = text.find("**", i + 2)
            if close != -1:
                flush(i)
                inner = render_inline(text[i + 2:close], allow_links=allow_links, sidenotes=sidenotes, link_defs=link_defs)
                result.append(f"<strong>{inner}</strong>")
                i = close + 2
                start = i
                continue

        # Italic: *text* (but not **)
        if char == "*" and i + 1 < len(text) and text[i + 1] != "*":
            close = text.find("*", i + 1)
            if close != -1 and (close + 1 >= len(text) or text[close + 1] != "*"):
                flush(i)
                inner = render_inline(text[i + 1:close], allow_links=allow_links, sidenotes=sidenotes, link_defs=link_defs)
                result.append(f"<em>{inner}</em>")
                i = close + 1
                start = i
                continue

        # Strikethrough: ~~text~~
        if char == "~" and i + 1 < len(text) and text[i + 1] == "~":
            close = text.find("~~", i + 2)
            if close != -1:
                flush(i)
                inner = render_inline(text[i + 2:close], allow_links=allow_links, sidenotes=sidenotes, link_defs=link_defs)
                result.append(f"<del>{inner}</del>")
                i = close + 2
                start = i
                continue

        # Highlight: ==text==
        if char == "=" and i + 1 < len(text) and text[i + 1] == "=":
            close = text.find("==", i + 2)
            if close != -1:
                flush(i)
                inner = render_inline(text[i + 2:close], allow_links=allow_links, sidenotes=sidenotes, link_defs=link_defs)
                result.append(f"<mark>{inner}</mark>")
                i = close + 2
                start = i
                continue

        # Autolinks: <https://example.com> or <mailto:user@example.com>
        if char == "<" and i + 1 < len(text):
            close = text.find(">", i + 1)
            if close != -1:
                potential_url = text[i + 1:close]
                if potential_url.startswith(("http://", "https://", "mailto:")):
                    flush(i)
                    href = html_escape(potential_url, quote=True)
                    display = html_escape(potential_url)
                    result.append(f'<a class="highlight" href="{href}">{display}</a>')
                    i = close + 1
                    start = i
                    continue

        i += 1

    flush(len(text))
    return "".join(result)


class SidenoteRegistry:
    def __init__(self, definitions: Optional[dict[str, str]] = None) -> None:
        self._definitions: dict[str, str] = {k.strip(): v for k, v in (definitions or {}).items() if k}
        self._entries: "OrderedDict[str, dict[str, object]]" = OrderedDict()
        self._counter = 0

    def has_notes(self) -> bool:
        return bool(self._entries)

    def render_reference(self, label: str) -> str:
        key = label.strip()
        if not key:
            raise ValueError("Sidenote reference missing label")
        if key not in self._definitions:
            raise ValueError(f"Sidenote reference [^{key}] has no matching definition")
        entry = self._entries.get(key)
        if entry is None:
            self._counter += 1
            note_id = f"sn{self._counter - 1}"
            number = self._counter
            content_text = collapse_text(self._definitions[key])
            content_html = render_inline(content_text, sidenotes=None)
            entry = {"id": note_id, "number": number, "html": content_html}
            self._entries[key] = entry
        sn_id = entry["id"]
        number = entry["number"]
        content_html = entry["html"]
        return (
            f'<label for="{sn_id}" class="sidenote-number" data-number="{number}"></label>'
            f'<input type="checkbox" id="{sn_id}" class="margin-toggle">'
            f'<span class="sidenote sidenote--inline"><span class="sidenote__marker" data-number="{number}"></span>{content_html}</span>'
        )

    def render_rail_spans(self) -> str:
        if not self._entries:
            return ""
        parts = []
        for entry in self._entries.values():
            parts.append(
                f'<span class="sidenote sidenote--rail" data-sidenote-ref="{entry["id"]}"><span class="sidenote__marker" data-number="{entry["number"]}"></span>{entry["html"]}</span>'
            )
        return "\n".join(parts)


def find_closing(text: str, start: int, closing: str) -> int:
    i = start
    while i < len(text):
        if text[i] == "\\":
            i += 2
            continue
        if text[i] == closing:
            return i
        i += 1
    return -1


def indent_block(html: str, indent_level: int, *, indent_all: bool = True) -> List[str]:
    prefix = " " * (indent_level * 4)
    lines = html.splitlines()
    if not lines:
        return []
    if indent_all:
        return [prefix + line if line else "" for line in lines]
    first = prefix + lines[0] if lines[0] else prefix
    return [first, *lines[1:]]


def render_list_block(block: Block, indent_level: int, sidenotes: Optional["SidenoteRegistry"] = None, link_defs: Optional[dict[str, dict[str, str]]] = None) -> List[str]:
    """Render a list block (ul or ol), handling nested lists and task lists."""
    lines: List[str] = []
    indent = " " * (indent_level * 4)
    tag = block.kind  # "ul" or "ol"

    # Check if this is a task list (only for ul)
    is_task_list = tag == "ul" and any(
        item.text.startswith("[ ] ") or item.text.startswith("[x] ") or item.text.startswith("[X] ")
        for item in block.items
    )

    if is_task_list:
        lines.append(f"{indent}<ul class=\"task-list\">")
    else:
        lines.append(f"{indent}<{tag}>")

    for item in block.items:
        item_text = item.text
        rendered_children = ""

        # Handle nested lists
        if item.children:
            child_lines = render_list_block(item.children, indent_level + 1, sidenotes, link_defs)
            rendered_children = "\n" + "\n".join(child_lines) + f"\n{indent}    "

        # Handle task list items
        if is_task_list and item_text.startswith("[ ] "):
            content = render_inline(collapse_text(item_text[4:]), sidenotes=sidenotes, link_defs=link_defs)
            lines.append(f"{indent}    <li class=\"task-item\">{content}{rendered_children}</li>")
        elif is_task_list and (item_text.startswith("[x] ") or item_text.startswith("[X] ")):
            content = render_inline(collapse_text(item_text[4:]), sidenotes=sidenotes, link_defs=link_defs)
            lines.append(f"{indent}    <li class=\"task-item task-item--done\"><del>{content}</del>{rendered_children}</li>")
        else:
            content = render_inline(collapse_text(item_text), sidenotes=sidenotes, link_defs=link_defs)
            lines.append(f"{indent}    <li>{content}{rendered_children}</li>")

    lines.append(f"{indent}</{tag}>")
    return lines


def render_blocks(blocks: Sequence[Block], indent_level: int = 3, sidenotes: Optional[SidenoteRegistry] = None, link_defs: Optional[dict[str, dict[str, str]]] = None) -> List[str]:
    lines: List[str] = []
    indent = " " * (indent_level * 4)
    math_exprs = [block.text for block in blocks if block.kind == "math"]
    cache_svg = ""
    math_htmls: List[str] = []
    if math_exprs:
        cache_svg, math_htmls = render_math_blocks(math_exprs, reset_cache=True)
    math_index = 0
    cache_pending = bool(cache_svg)

    for block in blocks:
        if block.kind == "paragraph":
            lines.append(f"{indent}<p>{render_inline(collapse_text(block.text), sidenotes=sidenotes, link_defs=link_defs)}</p>")
            continue

        if block.kind in {"h2", "h3"}:
            tag = f"h{block.level or (2 if block.kind == 'h2' else 3)}"
            lines.append(f"{indent}<{tag}>{render_inline(block.text.strip(), sidenotes=sidenotes, link_defs=link_defs)}</{tag}>")
            continue

        if block.kind == "hr":
            lines.append(f"{indent}<hr>")
            continue

        if block.kind == "ul":
            lines.extend(render_list_block(block, indent_level, sidenotes, link_defs))
            continue

        if block.kind == "ol":
            lines.extend(render_list_block(block, indent_level, sidenotes, link_defs))
            continue

        if block.kind == "blockquote":
            lines.append(f"{indent}<blockquote>")
            for paragraph in block.paragraphs:
                text = collapse_text("\n".join(paragraph))
                lines.append(f"{indent}    <p>{render_inline(text, sidenotes=sidenotes, link_defs=link_defs)}</p>")
            lines.append(f"{indent}</blockquote>")
            continue

        if block.kind == "code":
            code_html = format_code_block(block.text, block.language or "text")
            lines.extend(indent_block(code_html, indent_level, indent_all=False))
            continue

        if block.kind == "raw_html":
            lines.extend(block.text.splitlines())
            continue

        if block.kind == "image":
            src = html_attr(block.src)
            alt = html_attr(block.alt)
            if block.caption:
                lines.append(f"{indent}<figure>")
                lines.append(f"{indent}    <img src=\"{src}\" alt=\"{alt}\">")
                lines.append(f"{indent}    <figcaption>{render_inline(block.caption, sidenotes=sidenotes, link_defs=link_defs)}</figcaption>")
                lines.append(f"{indent}</figure>")
            else:
                lines.append(f"{indent}<img src=\"{src}\" alt=\"{alt}\">")
            continue

        if block.kind == "table":
            lines.append(f"{indent}<table>")
            if block.caption:
                lines.append(f"{indent}    <caption>{render_inline(block.caption, sidenotes=sidenotes, link_defs=link_defs)}</caption>")
            if block.headers:
                lines.append(f"{indent}    <thead>")
                lines.append(f"{indent}        <tr>")
                for cell in block.headers:
                    lines.append(f"{indent}            <th>{render_inline(cell, sidenotes=sidenotes, link_defs=link_defs)}</th>")
                lines.append(f"{indent}        </tr>")
                lines.append(f"{indent}    </thead>")
            if block.rows:
                lines.append(f"{indent}    <tbody>")
                for row in block.rows:
                    lines.append(f"{indent}        <tr>")
                    for cell in row:
                        lines.append(f"{indent}            <td>{render_inline(cell, sidenotes=sidenotes, link_defs=link_defs)}</td>")
                    lines.append(f"{indent}        </tr>")
                lines.append(f"{indent}    </tbody>")
            lines.append(f"{indent}</table>")
            continue

        if block.kind == "math":
            if math_index >= len(math_htmls):
                raise RuntimeError("Math rendering state mismatch")
            block_lines = indent_block(math_htmls[math_index], indent_level)
            math_index += 1
            if cache_pending:
                block_lines = indent_block(cache_svg, indent_level) + block_lines
                cache_pending = False
            lines.extend(block_lines)
            continue

        raise ValueError(f"Unsupported block type: {block.kind}")

    return lines


def html_attr(value: str) -> str:
    return html_escape(value, quote=True)


def collect_subtitle_variants(metadata: dict) -> List[str]:
    explicit: List[Tuple[int, str]] = []
    for key, value in metadata.items():
        if value is None:
            continue
        match = SUBTITLE_KEY_RE.match(key)
        if match:
            idx = int(match.group(1))
            text = str(value).strip()
            if text:
                explicit.append((idx, text))
    if explicit:
        explicit.sort(key=lambda item: item[0])
        return [text for _, text in explicit]

    fallback_keys = ["subtitle_long", "subtitle_short", "subtitle"]
    fallback: List[str] = []
    for key in fallback_keys:
        value = metadata.get(key)
        if value:
            text = str(value).strip()
            if text:
                fallback.append(text)
    if fallback:
        return fallback

    date_value = str(metadata.get("date", "")).strip()
    return [date_value] if date_value else []


def build_article(
    metadata: dict,
    blocks: Sequence[Block],
    extracted_title: Optional[str] = None,
    right_rail_html: str = "",
    sidenote_definitions: Optional[dict[str, str]] = None,
    link_definitions: Optional[dict[str, dict[str, str]]] = None,
) -> str:
    title = (metadata.get("title") or extracted_title or "").strip()
    if not title:
        raise ValueError(
            "Missing title. Provide a 'title' in front matter or start the markdown with '# Title'."
        )

    subtitle_variants = collect_subtitle_variants(metadata)
    if not subtitle_variants:
        subtitle_variants = [title]

    sidenote_registry = SidenoteRegistry(sidenote_definitions or {})
    block_lines = render_blocks(blocks, sidenotes=sidenote_registry, link_defs=link_definitions)

    attr_parts = [f'data-page-title="{html_attr(title)}"']
    for idx, variant in enumerate(subtitle_variants):
        attr_parts.append(f'data-page-subtitle-{idx}="{html_attr(variant)}"')

    article_lines: List[str] = []
    article_lines.append(f"<article class=\"writing-post\" {' '.join(attr_parts)}>")
    article_lines.append("    <div class=\"writing-post__layout\">")
    article_lines.append("        <div class=\"writing-post__rail\">")
    article_lines.append("            <nav class=\"writing-toc\" data-toc></nav>")
    article_lines.append("        </div>")
    article_lines.append("        <div class=\"writing-post__content\" data-toc-intro>")
    if block_lines:
        article_lines.extend(block_lines)
    article_lines.append("        </div>")
    generated_rail = sidenote_registry.render_rail_spans()
    combined_right_rail = "\n".join(
        part for part in [right_rail_html.strip(), generated_rail.strip()] if part
    ).strip()

    if combined_right_rail:
        article_lines.append("        <div class=\"writing-post__rail-right\">")
        article_lines.extend(
            [
                f"            {line}" if line else ""
                for line in combined_right_rail.splitlines()
            ]
        )
        article_lines.append("        </div>")
    else:
        article_lines.append("        <div class=\"writing-post__rail-right\"></div>")
    article_lines.append("    </div>")
    article_lines.append("</article>")
    return "\n".join(article_lines) + "\n"


def process_markdown_file(path: Path, output_dir: Path) -> Path:
    raw = path.read_text(encoding="utf-8")
    metadata, body = parse_front_matter(raw)
    slug = sanitize_slug(metadata.get("slug"), path.stem)
    metadata["slug"] = slug
    blocks, extracted_title, right_rail_html, sidenote_defs, link_defs = parse_markdown_body(body)
    article_html = build_article(
        metadata,
        blocks,
        extracted_title,
        right_rail_html,
        sidenote_definitions=sidenote_defs,
        link_definitions=link_defs,
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{slug}.html"
    output_path.write_text(article_html, encoding="utf-8")
    return output_path


def resolve_targets(targets: Sequence[str], content_dir: Path) -> List[Path]:
    if not targets:
        return sorted(content_dir.glob("*.md"))

    resolved: List[Path] = []
    for target in targets:
        candidate = Path(target)
        if candidate.is_file():
            resolved.append(candidate)
            continue
        if candidate.suffix.lower() != ".md":
            candidate = content_dir / f"{target}.md"
        if not candidate.is_file():
            raise FileNotFoundError(f"Cannot locate markdown file for '{target}'")
        resolved.append(candidate)
    return resolved


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("targets", nargs="*", help="Optional list of slugs or markdown file paths to process")
    parser.add_argument("--content-dir", default=str(CONTENT_DIR), help="Directory containing writing markdown sources")
    parser.add_argument("--output-dir", default=str(OUTPUT_DIR), help="Directory for generated HTML fragments")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    content_dir = Path(args.content_dir)
    output_dir = Path(args.output_dir)

    try:
        target_files = resolve_targets(args.targets, content_dir)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if not target_files:
        print("No markdown files found", file=sys.stderr)
        return 1

    for path in target_files:
        try:
            output_path = process_markdown_file(path, output_dir)
        except Exception as exc:
            print(f"Failed to process {path}: {exc}", file=sys.stderr)
            return 1
        rel_output = output_path.relative_to(ROOT_DIR)
        print(f"Wrote {rel_output}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
