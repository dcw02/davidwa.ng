#!/usr/bin/env node
// tex2svg.js (CommonJS)
// MathJax v4 TeX -> clean, responsive SVG (Pagella font), no menu/a11y.
// Requires: npm install in build/ directory

const { stdin, argv } = process;

function parseArgs(args) {
  return args.reduce(
    (acc, arg) => {
      if (acc.input == null) {
        acc.input = arg;
        return acc;
      }
      console.error(`Unexpected argument: ${arg}`);
      process.exit(1);
    },
    { input: null }
  );
}
const cli = parseArgs(argv.slice(2));

// --- helper: read input (arg or stdin) ---
function readStdin() {
  return new Promise((resolve) => {
    let s = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (c) => (s += c));
    stdin.on('end', () => resolve(s.trim()));
  });
}
async function getInput() {
  const a = cli.input;
  if (a === '-') return await readStdin();
  if (a) return a;
  return String.raw`\frac{1}{1+x^2}`;
}

async function main() {
  // Set up MathJax config (global) before loading startup.
  global.MathJax = {
    loader: {
      paths: { mathjax: '@mathjax/src/bundle' },
      load: ['input/tex', 'output/svg', 'adaptors/liteDOM'],
      // In CJS, dynamic import is fine; startup expects this.
      require: (file) => import(file),
    },
    output: { font: 'mathjax-pagella' },
    svg: { fontCache: 'global' },
  };

  // Load the component startup (ESM) via dynamic import in CJS:
  await import('@mathjax/src/bundle/startup.js');
  await MathJax.startup.promise;

  // Render
  const tex = await getInput();
  const container = MathJax.tex2svg(tex, { display: true });
  const adaptor = MathJax.startup.adaptor;
  const svgNode = adaptor.childNodes(container)[0];

  // Strip <title>/<desc>
  for (const tag of ['title', 'desc']) {
    adaptor.tags(svgNode, tag).forEach((el) => adaptor.remove(el));
  }

  // Serialize
  let svg = adaptor.outerHTML(svgNode);
  const glyphs = adaptor
    .childNodes(MathJax.startup.document.outputJax.fontCache.getCache())
    .map((node) => ({
      id: adaptor.getAttribute(node, 'id'),
      d: adaptor.getAttribute(node, 'd'),
    }))
    .filter(({ id, d }) => id && d);

  // --- Scrub: make inline-HTML friendly and responsive ---
  const stripRootAttr = (name) => {
    const re = new RegExp(`(<svg[^>]*?)\\s${name}="[^"]*"`, 'i');
    svg = svg.replace(re, '$1');
  };
  const stripGlobal = (regex) => (svg = svg.replace(regex, ''));

  // Root-only
  stripRootAttr('style');   // style="vertical-align: …"
  //stripRootAttr('width');   // intrinsic width
  //stripRootAttr('height');  // intrinsic height
  stripRootAttr('xmlns');   // drop xmlns for inline HTML5

  // Whole tree: remove a11y/metadata
  stripGlobal(/\srole="[^"]*"/g);
  stripGlobal(/\sfocusable="[^"]*"/g);
  stripGlobal(/\saria-[a-z0-9_-]+="[^"]*"/gi);
  stripGlobal(/\sdata-[a-z0-9_-]+="[^"]*"/gi);
  stripGlobal(/\sclass="[^"]*"/gi);

  // Tidy spaces
  svg = svg.replace(/\s{2,}/g, ' ').replace(/\s>/g, '>');

  console.log(JSON.stringify({ svg, glyphs }));
  MathJax.done();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
