import crypto from 'node:crypto';
import fs from 'node:fs';

const MAX_ATTEMPTS = 5;
const EDGEONE_ENDPOINT = 'teo.tencentcloudapi.com';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'code' in error) return String(error.code);
  return String(error || 'unknown error');
}

function putObject(cos, params) {
  return new Promise((resolve, reject) => {
    cos.putObject(params, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

export async function createCosClient({ secretId, secretKey }) {
  const cosModule = await import('cos-nodejs-sdk-v5');
  const COS = cosModule.default || cosModule;
  return new COS({ SecretId: secretId, SecretKey: secretKey, KeepAlive: true });
}

export async function uploadCosFile({
  cos,
  bucket,
  region,
  prefix,
  remoteDirectory,
  file,
}) {
  const key = `${prefix}/${remoteDirectory}/${file.remoteName}`;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await putObject(cos, {
        Bucket: bucket,
        Region: region,
        Key: key,
        Body: fs.createReadStream(file.sourcePath),
        ContentLength: file.size,
        ContentType: file.contentType,
        CacheControl: file.cacheControl,
      });
      console.log(`OK COS uploaded: ${key} (${file.size} bytes)`);
      return;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      const delay = Math.min(1500 * (2 ** (attempt - 1)), 15000);
      console.warn(`COS 上传重试 ${attempt}/${MAX_ATTEMPTS - 1}: ${key} (${errorMessage(error)})`);
      await sleep(delay);
    }
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmacSha256(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function buildAuthorization({ secretId, secretKey, timestamp, payload }) {
  const service = 'teo';
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:application/json; charset=utf-8\nhost:${EDGEONE_ENDPOINT}\n`,
    'content-type;host',
    sha256(payload),
  ].join('\n');
  const scope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    scope,
    sha256(canonicalRequest),
  ].join('\n');
  const secretDate = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature = hmacSha256(secretSigning, stringToSign, 'hex');
  return `TC3-HMAC-SHA256 Credential=${secretId}/${scope}, SignedHeaders=content-type;host, Signature=${signature}`;
}

export async function purgeEdgeOne({ secretId, secretKey, zoneId, urls }) {
  const payload = JSON.stringify({
    ZoneId: zoneId,
    Type: 'purge_url',
    Targets: urls,
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const response = await fetch(`https://${EDGEONE_ENDPOINT}`, {
    method: 'POST',
    headers: {
      Authorization: buildAuthorization({ secretId, secretKey, timestamp, payload }),
      'Content-Type': 'application/json; charset=utf-8',
      Host: EDGEONE_ENDPOINT,
      'X-TC-Action': 'CreatePurgeTask',
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': '2022-09-01',
      'X-TC-Language': 'zh-CN',
    },
    body: payload,
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok || data.Response?.Error) {
    const error = data.Response?.Error;
    throw new Error(error ? `${error.Code}: ${error.Message}` : `${response.status} ${response.statusText}`);
  }
  console.log(`OK EdgeOne purge: ${data.Response?.JobId || data.Response?.RequestId || 'created'}`);
}
