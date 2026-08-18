#!/usr/bin/env node
/*
 * Fail a build whose chunks import each other in a cycle.
 *
 *   node scripts/check-chunk-cycles.mjs packages/orgadmin-shell/dist [...]
 *
 * WHY THIS EXISTS
 *
 * `manualChunks` decides which chunk a module lands in, and it is entirely
 * possible to write a rule that puts two mutually-dependent groups of modules
 * into two different chunks. Rollup emits that without complaint. The browser
 * then evaluates one of them before the other has initialised, and any module
 * reading a value from the other *at module scope* gets `undefined`.
 *
 * That is how `/orgadmin` shipped as a blank page: `manualChunks` matched
 * `node_modules/react` as a substring, which also catches
 * `react-transition-group` and `react-i18next`, dragging MUI's and i18next's
 * dependencies into `vendor-react` and creating
 *
 *     vendor-react <-> vendor-emotion
 *     vendor-react <-> vendor-mui-core
 *     vendor-react <-> vendor-utils
 *
 * `hoist-non-react-statics` reads `ReactIs.ForwardRef` as it initialises, got
 * `undefined`, and threw before React rendered anything:
 *
 *     Cannot read properties of undefined (reading 'ForwardRef')
 *
 * Nothing caught it earlier because a development server does not split chunks
 * — the fault existed only in the built artefact, and only became visible once
 * that artefact was deployed.
 *
 * WHAT IT DOES NOT CATCH
 *
 * A cycle is sufficient to be a bug here but not necessary: a cycle whose
 * modules only touch each other inside functions is harmless, and this reports
 * it anyway. That trade is deliberate — a false alarm costs a comment, a miss
 * costs a blank page in production. It also says nothing about cycles *within*
 * one chunk, which Rollup orders correctly by itself.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const dists = process.argv.slice(2);
if (dists.length === 0) {
  console.error('usage: check-chunk-cycles.mjs <dist-dir> [<dist-dir>...]');
  process.exit(2);
}

/** Static `import`/`export ... from` targets, which are what force evaluation order. */
function staticDeps(source) {
  const found = new Set();
  const patterns = [
    /\bfrom\s*["'](\.\/[^"']+\.js)["']/g,   // import x from "./chunk.js"
    /\bimport\s*["'](\.\/[^"']+\.js)["']/g, // import "./chunk.js"
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) found.add(basename(m[1]));
  }
  return found;
}

/** Every distinct cycle in the chunk graph, as arrays of file names. */
function cycles(graph) {
  const out = new Map();
  const stack = [];
  const onStack = new Set();
  const done = new Set();

  const visit = (node) => {
    stack.push(node);
    onStack.add(node);
    for (const dep of graph.get(node) ?? []) {
      if (onStack.has(dep)) {
        const cycle = stack.slice(stack.indexOf(dep));
        // One entry per set of participants, however it was entered.
        const key = [...cycle].sort().join('|');
        if (!out.has(key)) out.set(key, [...cycle, dep]);
      } else if (!done.has(dep) && graph.has(dep)) {
        visit(dep);
      }
    }
    stack.pop();
    onStack.delete(node);
    done.add(node);
  };

  for (const node of graph.keys()) if (!done.has(node)) visit(node);
  return [...out.values()];
}

// Strip Rollup's content hash so messages name the chunk, not the build.
// Exactly 8 characters, Vite's default: `{8,}` is greedy across hyphens and
// turns `vendor-mui-core-CKi-Dmlx.js` into `vendor`, which names nothing.
const label = (file) => file.replace(/-[A-Za-z0-9_-]{8}\.js$/, '');

let failed = false;

for (const dist of dists) {
  // Vite is configured here to emit chunks under assets/js; fall back to the
  // dist root so this is useful against a default layout too.
  const dir = ['assets/js', 'assets', '.']
    .map((d) => join(dist, d))
    .find((d) => existsSync(d) && readdirSync(d).some((f) => f.endsWith('.js')));

  if (!dir) {
    console.error(`✖ ${dist}: no JavaScript chunks found — was it built?`);
    failed = true;
    continue;
  }

  const graph = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    graph.set(file, staticDeps(readFileSync(join(dir, file), 'utf8')));
  }

  const found = cycles(graph);
  if (found.length === 0) {
    console.log(`✓ ${dist}: ${graph.size} chunks, no import cycles`);
    continue;
  }

  failed = true;
  console.error(`✖ ${dist}: ${found.length} import cycle(s) between chunks`);
  for (const cycle of found) {
    console.error('    ' + cycle.map(label).join(' -> '));
  }
  console.error(
    '\n  Chunks in a cycle are evaluated with one side uninitialised, so a\n' +
    '  module reading another chunk\'s export at module scope sees `undefined`.\n' +
    '  Fix the `manualChunks` rule that splits these apart — usually a\n' +
    '  substring match catching more packages than it means to.\n'
  );
}

process.exit(failed ? 1 : 0);
