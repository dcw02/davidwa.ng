#!/usr/bin/env node

/**
 * Static code highlighter using highlight.js
 * Requires: npm install in build/ directory
 *
 * Usage: node highlight.js <language>
 * Reads code from stdin, outputs highlighted HTML to stdout
 */

const hljs = require('highlight.js');

const lang = process.argv[2];
if (!lang) {
    console.error('Usage: node highlight.js <language>');
    process.exit(1);
}

let code = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
    code += chunk;
});

process.stdin.on('end', () => {
    try {
        const result = hljs.highlight(code, { language: lang, ignoreIllegals: true });
        console.log(result.value);
    } catch (error) {
        console.error(`Error highlighting code: ${error.message}`);
        // On error, output the code as-is (escaped)
        const escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        console.log(escaped);
    }
});
