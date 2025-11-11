#!/usr/bin/env python3
"""
Math rendering utility using MathJax v4.

Converts LaTeX math expressions to clean, responsive SVG.
Uses tex2svg.js which requires @mathjax/src and @mathjax/mathjax-pagella-font.
"""

import subprocess
import sys
from pathlib import Path
from html import escape


def render_math(latex: str) -> str:
    """Render LaTeX math to SVG using MathJax."""
    script_path = Path(__file__).parent / "tex2svg.js"
    latex = latex.strip()
    result = subprocess.run(
        ["node", str(script_path), "-"],
        input=latex,
        capture_output=True,
        text=True,
        check=True
    )
    return result.stdout.strip()


def format_math_block(latex: str) -> str:
    """Format LaTeX as a math display block with wrapper div."""
    svg = render_math(latex)
    return f'<div class="math-display">{svg}</div>'


def main():
    """CLI: read LaTeX from stdin, output formatted HTML to stdout."""
    if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        print("\nUsage:")
        print("  echo '\\int_0^\\infty e^{-x} dx' | python3 render_math.py")
        print("  python3 render_math.py < input.tex > output.html")
        return

    latex = sys.stdin.read()
    html = format_math_block(latex)
    print(html)


if __name__ == "__main__":
    main()
