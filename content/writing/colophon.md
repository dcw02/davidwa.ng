---
slug: colophon
date: 2025-11-02
subtitle_0: November 02, 2025
subtitle_1: Nov 02, 2025
description: Typography and layout reference page
---

# Colophon

This is a test page showcasing all the typography and design elements available on this site. There's an easter egg hidden somewhere if you look closely :)

## Layout and Typography

Content is constrained to 80 characters wide, similar to traditional terminal width. The site uses [Iosevka](#) with expanded font-stretch.

## Text and Links and Other Typography Elements

Regular paragraph text with [inline links](#) and `inline code`. Links have a subtle underline and highlight with a background color on hover.

## Code Blocks

Code blocks are syntax-highlighted at build time using [highlight.js](#) with the Catppuccin Mocha theme. Hover over a block to copy the code. Long lines trigger horizontal scrolling:

```cpp
#include <iostream>

auto main() -> int {
    std::cout << "Hello, world!" << std::endl;
    std::cout << "This is a deliberately long message to demonstrate how horizontal scrolling works when code extends beyond the typical viewport width" << std::endl;
    return 0;
}
```

## Lists

Ordered and unordered lists are supported:
- First item
- Second item with a [link](#)
- Third item
1. Numbered item
2. Another numbered item

## Blockquotes

> This is a blockquote. It has a left border and italic styling.

## Interactive Features

Headings automatically generate anchor links[^sn0] (hover over any heading to see the # symbol). The table of contents is built dynamically from h2 and h3 elements and, on wide viewports, becomes sticky in the left rail.

[^sn0]: The # symbol appears when you hover over any heading. Click it to get a direct link to that section.

## Sidenotes

This paragraph demonstrates the sidenote system[^sn1] with multiple references[^sn2] placed on consecutive lines to test the worst-case stacking scenario.

[^sn1]: This is a sidenote. On mobile it's expandable via checkbox, on desktop it floats in the margin.

[^sn2]: Multiple sidenotes in the same paragraph will stack vertically with spacing between them.

The selection lock system ensures you can select text in the main content or sidenotes independently, preventing awkward cross-container selections.

### This is a Longer Subheading Example to Test Wrapping

H3 headings are italic and slightly smaller than H2 headings[^sn3]. Both levels appear in the table of contents.

[^sn3]: Both h2 and h3 headings support the anchor link feature and appear in the table of contents with proper nesting.

## Tables

Tables are centered with a maximum width of 76ch. They can be displayed with or without captions:

| Feature | Chrome | Firefox | Safari |
| --- | --- | --- | --- |
| CSS Grid | 57+ | 52+ | 10.1+ |
| Flexbox | 29+ | 28+ | 9+ |
| Container Queries | 105+ | 110+ | 16+ |

Caption: Browser support for various CSS features

Tables without captions are also supported:

| Command | Description |
| --- | --- |
| `git status` | Show working tree status |
| `git commit` | Record changes to repository |
| `git push` | Update remote refs |

This text appears after the table to demonstrate the 1rem bottom margin spacing.

## Images

Images can be displayed with or without captions. They scale to a maximum width of 76ch and are centered on the page:

![Placeholder chart](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='400'%20height='400'%3E%3Crect%20width='400'%20height='400'%20fill='%232c2c2c'/%3E%3C/svg%3E "An example image with a caption below it")

Images without captions are also supported. This one is wider than 76ch to demonstrate automatic downscaling:

![Wide placeholder image](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1200'%20height='400'%3E%3Crect%20width='1200'%20height='400'%20fill='%232c2c2c'/%3E%3C/svg%3E)

This text appears after the image to demonstrate the 1rem bottom margin spacing.

## Mathematical Notation

Mathematical equations are pre-rendered as static SVG at build time using [MathJax v4](#) via `build/tex2svg.js`. Equations are rendered as display blocks only - inline math is intentionally not supported to maintain clean typography.

Block equations sit inside div.math-display containers and pick up the same custom scrollbar treatment as code blocks if they overflow.

The site uses TeX Gyre Pagella for math typography - an elegant Palatino-based font that provides nice contrast with the monospace body text.

### Examples

\[
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
\]
\[
\mathbf{A} = \begin{bmatrix} a_{11} & a_{12} \\ a_{21} & a_{22} \end{bmatrix}
\]
\[
\begin{aligned}
(x+\alpha)^n & =\sum_{k=0}^n\binom{n}{k} x^k \alpha^{n-k} \\
|x| & =\left\{\begin{array}{cc}
-x, & x<0 \\
x, & x \geq 0
\end{array}\right. \\
\nabla \cdot \nabla \psi & =\frac{\partial^2 \psi}{\partial x^2}+\frac{\partial^2 \psi}{\partial y^2}+\frac{\partial^2 \psi}{\partial z^2} \\
& =\frac{1}{r^2 \sin \theta}\left[\sin \theta \frac{\partial}{\partial r}\left(r^2 \frac{\partial \psi}{\partial r}\right)+\frac{\partial}{\partial \theta}\left(\sin \theta \frac{\partial \psi}{\partial \theta}\right)+\frac{1}{\sin \theta} \frac{\partial^2 \psi}{\partial \varphi^2}\right]
\end{aligned}
\]

## Future Enhancements

Eventually I'd like to add a static page generator from Markdown (or a custom format). But for now, this will do...
