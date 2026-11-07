import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function walkDir(dir: string, extensions: string[]): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        files.push(...walkDir(fullPath, extensions));
      }
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Architecture & SSOT Guards', () => {
  it('1. Zero TODO or FIXME in src/, tests/, and scripts/', () => {
    const rootFiles = [
      ...walkDir('src', ['.ts', '.tsx', '.json', '.css']),
      ...walkDir('tests', ['.ts', '.tsx']).filter((f) => !f.endsWith('architectureGuards.test.ts')),
      ...walkDir('scripts', ['.mjs', '.js']),
    ];

    const violations: { file: string; line: number; text: string }[] = [];
    const pattern = ['TO', 'DO'].join('') + '|' + ['FIX', 'ME'].join('');
    const todoRegex = new RegExp('\\b(' + pattern + ')\\b');

    for (const file of rootFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line: string, idx: number) => {
        if (todoRegex.test(line)) {
          violations.push({ file, line: idx + 1, text: line.trim() });
        }
      });
    }

    expect(violations, `Found TODO/FIXME comments:\n${JSON.stringify(violations, null, 2)}`).toHaveLength(0);
  });

  it('2. Zero external CDN scripts or stylesheet links in index.html and zero external download links in src/', () => {
    // index.html checks
    const indexHtml = fs.readFileSync('index.html', 'utf-8');
    const externalScriptOrLink = /<(script|link)[^>]*(src|href)=["'](https?:\/\/|\/\/)[^"']*["']/gi;
    const indexViolations = indexHtml.match(externalScriptOrLink) || [];
    expect(indexViolations, `index.html contains external CDN link: ${indexViolations.join(', ')}`).toHaveLength(0);

    // src/ check: no remote download/runtime fetch URLs, allowing $schema in schemas, and safe documentation/SSRF test placeholders
    const srcFiles = walkDir('src', ['.ts', '.tsx']);
    const cdnUrlRegex = /https?:\/\/(cdn|unpkg|cdnjs|jsdelivr|cdn\.jsdelivr|raw\.githubusercontent)\./i;
    const cdnViolations: string[] = [];

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (cdnUrlRegex.test(content)) {
        cdnViolations.push(file);
      }
    }

    expect(cdnViolations, `Found external CDN URLs in src:\n${cdnViolations.join('\n')}`).toHaveLength(0);
  });

  it('3. Zero unjustified any (: any or as any) in src/', () => {
    const srcFiles = walkDir('src', ['.ts', '.tsx']);
    const anyRegex = /(:[ ]*any\b|as[ ]+any\b)/;
    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line: string, idx: number) => {
        // Exclude comments that merely discuss the word "any" in prose
        const codeOnly = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
        if (anyRegex.test(codeOnly)) {
          violations.push({ file, line: idx + 1, text: line.trim() });
        }
      });
    }

    expect(violations, `Found unjustified 'any' type casts in src/:\n${JSON.stringify(violations, null, 2)}`).toHaveLength(0);
  });

  it('4. src/engine/** has zero value imports of react, react-dom, or @xyflow and zero DOM window/document globals', () => {
    const engineFiles = walkDir('src/engine', ['.ts']);
    const valueImportRegex = /import\s+(?!type\s)(?:{[^}]*}|[A-Za-z0-9_$*]+)\s+from\s+['"](react|react-dom|@xyflow\/[^'"]+|@xyflow\/react)['"]/;
    const domGlobalRegex = /\b(window|document)\.[A-Za-z0-9_$]+/;
    const violations: { file: string; line: number; reason: string }[] = [];

    for (const file of engineFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line: string, idx: number) => {
        const codeOnly = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
        if (valueImportRegex.test(codeOnly)) {
          violations.push({ file, line: idx + 1, reason: `Value import of UI library: ${line.trim()}` });
        }
        if (domGlobalRegex.test(codeOnly)) {
          violations.push({ file, line: idx + 1, reason: `DOM global used in pure engine: ${line.trim()}` });
        }
      });
    }

    expect(violations, `Engine layer violations:\n${JSON.stringify(violations, null, 2)}`).toHaveLength(0);
  });

  it('5. Root is clean: zero metadata.json or .env* files exist in root', () => {
    const forbidden = ['metadata.json', '.env', '.env.example', '.env.local', '.env.production'];
    for (const name of forbidden) {
      expect(fs.existsSync(name), `Forbidden AI Studio / secret file found in root: ${name}`).toBe(false);
    }
  });
});
