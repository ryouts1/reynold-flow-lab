import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const port = 4173;

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function resolveRequestPath(urlPath) {
  const safePath = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = safePath === '/' ? '/index.html' : safePath;
  const absolute = path.resolve(rootDir, `.${normalized}`);

  if (!absolute.startsWith(rootDir)) {
    return null;
  }

  return absolute;
}

const server = createServer(async (request, response) => {
  const absolutePath = resolveRequestPath(request.url ?? '/');
  if (!absolutePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const file = await readFile(absolutePath);
    const ext = path.extname(absolutePath);
    const contentType = mimeTypes[ext] ?? 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': contentType });
    response.end(file);
  } catch (error) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
  }
});

server.listen(port, () => {
  console.log(`Reynolds Flow Lab is available at http://localhost:${port}`);
});
