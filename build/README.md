# Build

Build utilities for static site generation.

## Directory Structure

- `content/` - Source content (markdown files)
- `_content/` - Generated HTML fragments consumed by the SPA
- `build/` - Build scripts and utilities

## Requirements

- **Node.js** - For syntax highlighting
- **highlight.js** - Install globally: `npm install -g highlight.js`
- **Python 3** - For the markdown generator

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

## Usage in Build Scripts

Import the `highlight_code.py` module:

```python
from build.highlight_code import format_code_block

html = format_code_block("print('hello')", "python")
```
