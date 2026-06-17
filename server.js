const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const COVERS_DIR = path.join(__dirname, 'covers');
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

function parseFilename(filename) {
  const name = path.basename(filename, path.extname(filename));
  const sep = name.indexOf(' - ');
  if (sep !== -1) {
    const artists = name.slice(0, sep).trim();
    const title = name.slice(sep + 3).trim();
    return { artists, title, album: title };
  }
  return { artists: '', title: name, album: name };
}

function listCovers() {
  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
  }
  return fs.readdirSync(COVERS_DIR)
    .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
    .sort()
    .map((f, i) => ({
      position: i + 1,
      ...parseFilename(f),
      image_url: `/covers/${encodeURIComponent(f)}`,
    }));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');

  // API: list local covers
  if (pathname === '/api/covers') {
    const covers = listCovers();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(covers));
    return;
  }

  // Resolve file path, prevent directory traversal
  const filePath = path.normalize(path.join(ROOT_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\nCoverflow running at http://localhost:${PORT}\n`);
  console.log(`Put cover images in the 'covers/' folder to display them.`);
  console.log(`Filename format: "Artist - Album Title.jpg"\n`);
});
