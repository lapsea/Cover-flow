const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const COVERS_DIR = path.join(__dirname, 'covers');
const AUDIO_DIR  = path.join(__dirname, 'audio');
const TEXTS_DIR  = path.join(__dirname, 'texts');

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
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.txt': 'text/plain; charset=utf-8',
};

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const AUDIO_EXTS = ['.mp3', '.m4a', '.ogg', '.wav', '.aac'];

function ensureDirs() {
  for (const d of [COVERS_DIR, AUDIO_DIR, TEXTS_DIR])
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

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

function findSidecar(dir, name, exts) {
  for (const ext of exts) {
    if (fs.existsSync(path.join(dir, name + ext)))
      return '/' + path.basename(dir) + '/' + encodeURIComponent(name + ext);
  }
  return null;
}

function listCovers() {
  ensureDirs();
  return fs.readdirSync(COVERS_DIR)
    .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
    .sort()
    .map((f, i) => {
      const name = path.basename(f, path.extname(f));
      return {
        position: i + 1,
        ...parseFilename(f),
        image_url: `/covers/${encodeURIComponent(f)}`,
        audio_url: findSidecar(AUDIO_DIR, name, AUDIO_EXTS),
        text_url:  findSidecar(TEXTS_DIR, name, ['.txt']),
        cues_url:  findSidecar(TEXTS_DIR, name, ['.json']),
      };
    });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (pathname === '/api/covers') {
    const covers = listCovers();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(covers));
    return;
  }

  const filePath = path.normalize(path.join(ROOT_DIR, decodeURIComponent(pathname === '/' ? 'index.html' : pathname)));
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match && match[1] ? parseInt(match[1], 10) : 0;
      const end = match && match[2] ? parseInt(match[2], 10) : stat.size - 1;

      if (isNaN(start) || isNaN(end) || start > end || end >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return;
      }

      res.writeHead(206, {
        'Content-Type': contentType,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\nCoverflow running at http://localhost:${PORT}\n`);
  console.log(`covers/  — cover images  (Artist - Album.jpg)`);
  console.log(`audio/   — audio files   (Artist - Album.mp3)`);
  console.log(`texts/   — text files    (Artist - Album.txt)\n`);
});
