#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  createCosClient,
  purgeEdgeOne,
  uploadCosFile,
} from './tencent-cloud.mjs';

const CDN_ORIGIN = 'https://cdn.dtodo.cn';
const REMOTE_DIRECTORY = 'aramgg-electron/windows';
const MAX_ATTEMPTS = 5;

function parseArgs(argv) {
  return argv.reduce((args, item) => {
    if (item === '--dry-run') return { ...args, dryRun: true };
    const [name, value] = item.split('=', 2);
    if (name === '--assets' && value) return { ...args, assetsDir: value };
    if (name === '--tag' && value) return { ...args, tag: value };
    return args;
  }, {
    assetsDir: 'release-assets',
    tag: '',
    dryRun: false,
  });
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少环境变量：${name}`);
  return value;
}

function yamlScalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
    || (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function topLevelYamlValue(content, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`^${escapedKey}:\\s*(.+)$`, 'm'));
  return match ? yamlScalar(match[1]) : '';
}

function onlyFile(directory, predicate, label) {
  const files = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => path.join(directory, entry.name));

  if (files.length !== 1) {
    throw new Error(`${label} 数量应为 1，实际为 ${files.length}`);
  }
  return files[0];
}

function fileHash(filePath, algorithm, encoding) {
  return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest(encoding);
}

function validateRemoteFilename(filename) {
  if (!filename || filename !== path.basename(filename) || !filename.toLowerCase().endsWith('.exe')) {
    throw new Error(`latest.yml path 不是安全的安装包文件名：${filename || 'empty'}`);
  }
}

function prepareRelease({ assetsDir, tag }) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
    throw new Error(`版本标签格式错误：${tag || 'empty'}`);
  }

  const sourceDir = path.resolve(assetsDir);
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error(`Release 资源目录不存在：${sourceDir}`);
  }

  const latestPath = onlyFile(sourceDir, (name) => name === 'latest.yml', 'latest.yml');
  const installerPath = onlyFile(sourceDir, (name) => name.toLowerCase().endsWith('.exe'), '安装包');
  const blockmapPath = onlyFile(
    sourceDir,
    (name) => name.toLowerCase().endsWith('.exe.blockmap'),
    'blockmap'
  );
  const latest = fs.readFileSync(latestPath, 'utf8');
  const version = topLevelYamlValue(latest, 'version');
  const installerName = topLevelYamlValue(latest, 'path');
  const expectedSha512 = topLevelYamlValue(latest, 'sha512');
  const fileUrlMatch = latest.match(/^\s*-\s+url:\s*(.+)$/m);
  const expectedSizeMatch = latest.match(/^\s+size:\s*(\d+)$/m);

  if (version !== tag.slice(1)) {
    throw new Error(`latest.yml version ${version || 'empty'} 与标签 ${tag} 不一致`);
  }
  validateRemoteFilename(installerName);
  if (fileUrlMatch && yamlScalar(fileUrlMatch[1]) !== installerName) {
    throw new Error('latest.yml 的 files[0].url 与 path 不一致');
  }
  if (!expectedSha512) {
    throw new Error('latest.yml 缺少 sha512');
  }

  const installerStat = fs.statSync(installerPath);
  const actualSha512 = fileHash(installerPath, 'sha512', 'base64');
  if (actualSha512 !== expectedSha512) {
    throw new Error('安装包 sha512 与 latest.yml 不一致');
  }
  if (expectedSizeMatch && installerStat.size !== Number(expectedSizeMatch[1])) {
    throw new Error(`安装包大小与 latest.yml 不一致：${installerStat.size}`);
  }

  const files = [
    {
      sourcePath: installerPath,
      remoteName: installerName,
      contentType: 'application/vnd.microsoft.portable-executable',
      cacheControl: 'public, max-age=31536000, immutable',
    },
    {
      sourcePath: blockmapPath,
      remoteName: `${installerName}.blockmap`,
      contentType: 'application/octet-stream',
      cacheControl: 'public, max-age=31536000, immutable',
    },
    {
      sourcePath: latestPath,
      remoteName: 'latest.yml',
      contentType: 'application/x-yaml; charset=utf-8',
      cacheControl: 'public, max-age=300',
    },
  ].map((file) => ({
    ...file,
    size: fs.statSync(file.sourcePath).size,
    sha256: fileHash(file.sourcePath, 'sha256', 'hex'),
  }));

  return { files, version };
}

function normalizePrefix(value) {
  const prefix = (value || 'hextech').replace(/^\/+|\/+$/g, '');
  if (!prefix || !/^[A-Za-z0-9/_-]+$/.test(prefix) || prefix.includes('..')) {
    throw new Error(`COS Prefix 不合法：${prefix || 'empty'}`);
  }
  return prefix;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'code' in error) return String(error.code);
  return String(error || 'unknown error');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function urlWithVerifyToken(url, tag) {
  const target = new URL(url);
  target.searchParams.set('verify', `${tag}-${Date.now()}`);
  return target;
}

async function verifyCdnFile(file, cdnBaseUrl, tag) {
  const url = `${cdnBaseUrl}/${encodeURIComponent(file.remoteName).replaceAll('%2F', '/')}`;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const isLatest = file.remoteName === 'latest.yml';
      const response = await fetch(urlWithVerifyToken(url, tag), {
        method: isLatest ? 'GET' : 'HEAD',
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

      if (isLatest) {
        const body = Buffer.from(await response.arrayBuffer());
        if (sha256(body) !== file.sha256) throw new Error('latest.yml 内容仍是旧版本');
      } else {
        const contentLength = response.headers.get('content-length');
        if (contentLength && Number(contentLength) !== file.size) {
          throw new Error(`Content-Length ${contentLength} 与本地 ${file.size} 不一致`);
        }
      }

      console.log(`OK CDN verified: ${url}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(2000 * attempt);
    }
  }
  throw new Error(`CDN 验证失败：${url} (${errorMessage(lastError)})`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const release = prepareRelease(args);
  console.log(`Release CDN ${args.dryRun ? 'dry-run' : 'upload'}: v${release.version}`);
  for (const file of release.files) {
    console.log(`- ${path.basename(file.sourcePath)} -> ${file.remoteName} (${file.size} bytes)`);
  }
  if (args.dryRun) return;

  const secretId = requiredEnv('TENCENT_COS_SECRET_ID');
  const secretKey = requiredEnv('TENCENT_COS_SECRET_KEY');
  const bucket = requiredEnv('TENCENT_COS_BUCKET');
  const region = requiredEnv('TENCENT_COS_REGION');
  const zoneId = requiredEnv('TENCENT_EDGEONE_ZONE_ID');
  const prefix = normalizePrefix(process.env.TENCENT_COS_PREFIX);
  const cos = await createCosClient({ secretId, secretKey });
  const cdnBaseUrl = `${CDN_ORIGIN}/${prefix}/${REMOTE_DIRECTORY}`;

  for (const file of release.files) {
    await uploadCosFile({
      cos,
      bucket,
      region,
      prefix,
      remoteDirectory: REMOTE_DIRECTORY,
      file,
    });
  }

  const urls = release.files.map((file) => `${cdnBaseUrl}/${encodeURIComponent(file.remoteName)}`);
  await purgeEdgeOne({
    secretId: process.env.TENCENT_EDGEONE_SECRET_ID?.trim() || secretId,
    secretKey: process.env.TENCENT_EDGEONE_SECRET_KEY?.trim() || secretKey,
    zoneId,
    urls,
  });

  for (const file of release.files) {
    await verifyCdnFile(file, cdnBaseUrl, args.tag);
  }
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
