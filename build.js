const fs = require('fs');
const path = require('path');

const ROOT_DIR  = __dirname;
const COVERS_DIR = path.join(ROOT_DIR, 'covers');
const AUDIO_DIR  = path.join(ROOT_DIR, 'audio');
const TEXTS_DIR  = path.join(ROOT_DIR, 'texts');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const AUDIO_EXTS = ['.mp3', '.m4a', '.ogg', '.wav', '.aac'];

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

function buildCovers() {
  for (const d of [COVERS_DIR, AUDIO_DIR, TEXTS_DIR])
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

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

const covers = buildCovers();
fs.writeFileSync(path.join(ROOT_DIR, 'covers.json'), JSON.stringify(covers, null, 2));
console.log(`Built covers.json — ${covers.length} covers.`);
