#!/usr/bin/env python3
"""
Static code block generator using highlight.js
Converts code blocks to the HTML structure expected by the site.
"""

import subprocess
import sys
from pathlib import Path
from html import escape


def highlight_code(code: str, language: str) -> str:
    """
    Highlight code using the Node.js highlight.js wrapper.

    Args:
        code: The source code to highlight
        language: Programming language identifier

    Returns:
        HTML string with syntax highlighting applied
    """
    script_path = Path(__file__).parent / "highlight.js"

    # Strip trailing newlines to avoid extra blank lines in output
    code = code.rstrip('\n')

    try:
        result = subprocess.run(
            ["node", str(script_path), language],
            input=code,
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.rstrip('\n')
    except subprocess.CalledProcessError as e:
        print(f"Warning: Failed to highlight {language} code: {e.stderr}", file=sys.stderr)
        # Fallback to escaped plain text
        return escape(code)
    except FileNotFoundError:
        print("Error: Node.js not found. Please install Node.js and highlight.js globally.", file=sys.stderr)
        print("  npm install -g highlight.js", file=sys.stderr)
        return escape(code)


def format_code_block(code: str, language: str) -> str:
    """
    Generate complete HTML structure for a code block.

    Args:
        code: The source code
        language: Programming language identifier

    Returns:
        Complete HTML with proper structure matching site design
    """
    highlighted = highlight_code(code, language)

    return f"""<div class="code-block">
    <span class="code-language-tag">{escape(language)}</span>
    <div class="code-scroll">
        <pre><code class="language-{escape(language)} hljs">{highlighted}</code></pre>
    </div>
</div>"""


if __name__ == "__main__":
    # Test/CLI usage
    if len(sys.argv) < 2:
        print("Usage: python highlight_code.py <language>", file=sys.stderr)
        print("  Reads code from stdin, outputs HTML to stdout", file=sys.stderr)
        sys.exit(1)

    language = sys.argv[1]
    code = sys.stdin.read()

    print(format_code_block(code, language))
