# Build

Build utilities for static site generation.

## Directory Structure

- `content/` - Source content (markdown files)
- `_content/` - Generated HTML fragments consumed by the SPA
- `build/` - Build scripts and utilities

## Requirements

- **Node.js** (>= 18.0.0) - For all build tooling
- **npm** - Package manager (comes with Node.js)
- **Python 3** - For build orchestration scripts

## Installation

Install all build dependencies locally:

```bash
make install
# or manually:
cd build && npm install
```

This installs all build tools locally in `build/node_modules/`:
- **highlight.js** - Syntax highlighting
- **MathJax** - Math rendering (with Pagella font)
- **CSSO** - CSS minification (produces smallest output)
- **uglify-js** - JavaScript minification

## Development Server

The dev server runs in the background, freeing up your terminal. It handles SPA routing by serving `index.html` for client-side routes.

### Commands

**Full syntax:**
```bash
make dev-start              # Start server (port 8000)
make dev-start PORT=3000    # Start on custom port
make dev-stop               # Stop server (port 8000)
make dev-stop PORT=3000     # Stop specific port
make dev-status             # List all running servers
```

## Code Highlighting

### highlight.js
Node.js wrapper for highlight.js. Reads code from stdin, outputs highlighted HTML.

```bash
echo 'int main() { return 0; }' | node build/highlight.js cpp
```

### highlight_code.py
Python wrapper that generates complete code block HTML structure.

```bash
echo 'int main() { return 0; }' | python3 build/highlight_code.py cpp
```

Returns HTML in the format:
```html
<div class="code-block">
    <span class="code-language-tag">cpp</span>
    <div class="code-scroll">
        <pre><code class="language-cpp"><!-- highlighted code --></code></pre>
    </div>
</div>
```

## Math Rendering

### mathjax.js
Node.js wrapper for MathJax v4. Reads LaTeX from stdin, outputs rendered SVG.

```bash
echo '\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}' | node build/mathjax.js
```

Returns inline SVG that can be embedded directly in HTML. No font files needed - math is rendered as vector graphics.

### render_math.py
Python wrapper that generates complete math block HTML structure.

```bash
echo '\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}' | python3 build/render_math.py
```

Returns HTML in the format:
```html
<div class="math-display">
    <!-- SVG content -->
</div>
```

## Usage in Build Scripts

Import modules as needed:

```python
from build.highlight_code import format_code_block
from build.render_math import format_math_block

code_html = format_code_block("print('hello')", "python")
math_html = format_math_block(r"\int_0^\infty e^{-x^2} dx")
```
