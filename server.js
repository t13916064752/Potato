import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(root, 'public');
const port = process.env.PORT || 3000;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (req.method === 'POST' && url.pathname === '/api/generate') {
      return await handleGenerate(req, res);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const filePath = safePublicPath(url.pathname === '/' ? '/index.html' : url.pathname);
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (error.code === 'ENOENT') return sendJson(res, 404, { error: 'Not found' });
    sendJson(res, 500, { error: error.message || 'Server error' });
  }
});

async function handleGenerate(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 400, { error: '请先设置 OPENAI_API_KEY 环境变量。' });
  }

  const body = await readRequestJson(req);
  const { prompt, size = '1024x1024', n = 1, quality = 'auto', background = 'auto' } = body;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return sendJson(res, 400, { error: '请输入图片提示词。' });
  }

  const count = Number.parseInt(n, 10);
  if (!Number.isInteger(count) || count < 1 || count > 4) {
    return sendJson(res, 400, { error: '数量必须在 1 到 4 之间。' });
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: prompt.trim(),
      size,
      n: count,
      quality,
      background,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return sendJson(res, response.status, { error: data?.error?.message || '生成失败，请稍后重试。' });
  }

  sendJson(res, 200, {
    created: Date.now(),
    images: (data.data || []).map((image, index) => ({
      id: `${Date.now()}-${index}`,
      b64: image.b64_json,
      revisedPrompt: image.revised_prompt || null,
    })),
  });
}

function safePublicPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const normalized = normalize(decoded).replace(/^\.\.(?:\/|\\|$)/, '');
  return join(publicDir, normalized);
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error('请求体过大。'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('请求 JSON 格式不正确。'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

server.listen(port, () => {
  console.log(`AI 生图界面已启动：http://localhost:${port}`);
});
