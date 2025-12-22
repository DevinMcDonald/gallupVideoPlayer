#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const videosJsonPath = path.join(ROOT, 'public', 'videos.json');
const videosDir = path.join(ROOT, 'public', 'videos');
const backgroundsDir = path.join(ROOT, 'public', 'backgrounds');

const loadEnvFile = (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  });
};

const envCandidates = [path.join(ROOT, '.env')];

envCandidates.forEach(loadEnvFile);

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const isHttp = (url) => /^https?:\/\//i.test(url);

const getEnv = (key, fallback = '') => process.env[key] || fallback;

const AWS_REGION = getEnv('AWS_REGION', 'auto');
const AWS_EC2_METADATA_DISABLED = getEnv('AWS_EC2_METADATA_DISABLED', 'true');
const AWS_S3_FORCE_PATH_STYLE = getEnv('AWS_S3_FORCE_PATH_STYLE', 'true');
const R2_ENDPOINT = getEnv('R2_ENDPOINT', '');
const R2_BUCKET = getEnv('R2_BUCKET', '');
const AWS_ACCESS_KEY_ID = getEnv('AWS_ACCESS_KEY_ID', '');
const AWS_SECRET_ACCESS_KEY = getEnv('AWS_SECRET_ACCESS_KEY', '');

const canUseS3 = AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && R2_ENDPOINT;

const s3Client = canUseS3
  ? new S3Client({
      region: AWS_REGION,
      endpoint: R2_ENDPOINT,
      forcePathStyle: AWS_S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    })
  : null;

const fetchViaHttp = async (url) => {
  const res = await fetch(encodeURI(url));
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch (err) {
      body = '';
    }
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}${body ? ` :: ${body.slice(0, 200)}` : ''}`);
  }
  return Buffer.from(await res.arrayBuffer());
};

const fetchViaS3 = async (url) => {
  if (!s3Client) {
    throw new Error('S3 client not configured (missing AWS creds or R2 endpoint)');
  }
  const urlObj = new URL(url);
  const parts = urlObj.pathname.replace(/^\//, '').split('/');
  if (!parts.length) {
    throw new Error(`Unable to parse key from ${url}`);
  }
  const bucketFromUrl = parts.shift();
  const key = parts.join('/');
  const bucket = bucketFromUrl || R2_BUCKET;
  if (!bucket) {
    throw new Error('Bucket not specified; set R2_BUCKET or include bucket in URL');
  }

  const command = new GetObjectCommand({ Bucket: bucket, Key: decodeURIComponent(key) });
  const response = await s3Client.send(command);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

const downloadFile = async (url, dest) => {
  let buffer;
  try {
    buffer = await fetchViaHttp(url);
  } catch (err) {
    console.warn(`HTTP fetch failed for ${url}: ${err.message}`);
    if (!s3Client) {
      console.warn('No S3 client configured; skipping authenticated retry.');
      throw err;
    }
    console.log('Attempting authenticated S3 download...');
    buffer = await fetchViaS3(url);
  }
  await fs.promises.writeFile(dest, buffer);
};

const main = async () => {
  ensureDir(videosDir);
  ensureDir(backgroundsDir);
  const neededFiles = new Set();
  const neededBackgroundFiles = new Set();

  const raw = await fs.promises.readFile(videosJsonPath, 'utf8');
  const data = JSON.parse(raw);
  const videos = data.videos || [];
  const background = data.background;

  let changed = false;

  if (background) {
    const backgroundConfig = typeof background === 'string' ? { src: background } : { ...background };
    if (backgroundConfig.src && isHttp(backgroundConfig.src)) {
      const urlObj = new URL(backgroundConfig.src);
      const fileName = decodeURIComponent(path.basename(urlObj.pathname));
      const destPath = path.join(backgroundsDir, fileName);
      const publicPath = `/backgrounds/${fileName}`;
      neededBackgroundFiles.add(destPath);

      if (!fs.existsSync(destPath)) {
        console.log(`Downloading ${backgroundConfig.src} -> ${publicPath}`);
        try {
          await downloadFile(backgroundConfig.src, destPath);
        } catch (err) {
          console.error(`Failed to download background ${backgroundConfig.src}: ${err.message}`);
        }
      } else {
        console.log(`Already cached: ${publicPath}`);
      }

      if (fs.existsSync(destPath) && backgroundConfig.cachedSrc !== publicPath) {
        backgroundConfig.cachedSrc = publicPath;
        changed = true;
      }

      if (typeof background === 'string' || !data.background || data.background.cachedSrc !== backgroundConfig.cachedSrc) {
        data.background = backgroundConfig;
        changed = true;
      }
    }
  }

  for (const video of videos) {
    if (!video.src || !isHttp(video.src)) {
      continue;
    }

    const urlObj = new URL(video.src);
    const fileName = decodeURIComponent(path.basename(urlObj.pathname));
    const destPath = path.join(videosDir, fileName);
    const publicPath = `/videos/${fileName}`;
    neededFiles.add(destPath);

    if (!fs.existsSync(destPath)) {
      console.log(`Downloading ${video.src} -> ${publicPath}`);
      try {
        await downloadFile(video.src, destPath);
      } catch (err) {
        console.error(`Failed to download ${video.src}: ${err.message}`);
        continue;
      }
    } else {
      console.log(`Already cached: ${publicPath}`);
    }

    if (!video.cachedSrc || video.cachedSrc !== publicPath) {
      video.cachedSrc = publicPath;
      changed = true;
    }
  }

  const existingFiles = await fs.promises.readdir(videosDir);
  for (const file of existingFiles) {
    if (file.startsWith('.')) continue;
    const fullPath = path.join(videosDir, file);
    const stat = await fs.promises.stat(fullPath);
    if (!stat.isFile()) continue;
    if (!neededFiles.has(fullPath)) {
      await fs.promises.unlink(fullPath);
      console.log(`Removed unused cached file: ${path.join('/videos', file)}`);
    }
  }

  if (neededBackgroundFiles.size) {
    const existingBackgrounds = await fs.promises.readdir(backgroundsDir);
    for (const file of existingBackgrounds) {
      if (file.startsWith('.')) continue;
      const fullPath = path.join(backgroundsDir, file);
      const stat = await fs.promises.stat(fullPath);
      if (!stat.isFile()) continue;
      if (!neededBackgroundFiles.has(fullPath)) {
        await fs.promises.unlink(fullPath);
        console.log(`Removed unused cached background file: ${path.join('/backgrounds', file)}`);
      }
    }
  }

  if (changed) {
    await fs.promises.writeFile(videosJsonPath, JSON.stringify({ ...data, videos }, null, 2));
    console.log('Updated videos.json with cachedSrc paths.');
  } else {
    console.log('No changes to videos.json.');
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
