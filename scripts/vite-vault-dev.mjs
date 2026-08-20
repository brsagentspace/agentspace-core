/**
 * Vite dev-only middleware mirroring the Tauri `vault_scan` command, so the
 * memory map can load a markdown folder in the browser during development.
 * Never bundled — `npm run build` output has no access to the filesystem.
 *
 *   GET /__vault?root=/abs/folder&maxFiles=400  →  { root, files[], capped }
 */
import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['node_modules', 'target', 'dist', 'build', 'out', 'work', 'models', 'public', '__pycache__']);
const MAX_FILE_BYTES = 200 * 1024;
const MAX_DEPTH = 6;

function walk(dir, depth, out, maxFiles) {
  if (depth > MAX_DEPTH) return false;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return false; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    if (out.length >= maxFiles) return true;
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (walk(full, depth + 1, out, maxFiles)) return true; }
    else if (e.isFile() && e.name.endsWith('.md')) out.push(full);
  }
  return false;
}

export function vaultDevPlugin() {
  return {
    name: 'agentspace-vault-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__vault', (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const root = url.searchParams.get('root') ?? '';
        const maxFiles = Math.min(Math.max(Number(url.searchParams.get('maxFiles')) || 400, 1), 5000);
        res.setHeader('content-type', 'application/json; charset=utf-8');
        if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: `Klasör bulunamadı: ${root}` }));
          return;
        }
        const paths = [];
        const capped = walk(root, 0, paths, maxFiles);
        const files = paths.map(p => {
          const raw = fs.readFileSync(p);
          const truncated = raw.length > MAX_FILE_BYTES;
          return {
            relPath: path.relative(root, p).split(path.sep).join('/'),
            content: (truncated ? raw.subarray(0, MAX_FILE_BYTES) : raw).toString('utf8'),
            modifiedMs: Math.round(fs.statSync(p).mtimeMs),
            truncated,
          };
        });
        res.end(JSON.stringify({ root, files, capped }));
      });
    },
  };
}
