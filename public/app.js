const form = document.querySelector('#generation-form');
const promptInput = document.querySelector('#prompt');
const sizeInput = document.querySelector('#size');
const countInput = document.querySelector('#count');
const qualityInput = document.querySelector('#quality');
const backgroundInput = document.querySelector('#background');
const submitButton = document.querySelector('#submit');
const clearButton = document.querySelector('#clear-history');
const statusEl = document.querySelector('#status');
const gallery = document.querySelector('#gallery');
const template = document.querySelector('#image-card-template');

const STORAGE_KEY = 'potato-ai-image-history';
let history = loadHistory();
renderGallery();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setLoading(true, '正在生成图片，通常需要几十秒……');

  try {
    const payload = {
      prompt: promptInput.value,
      size: sizeInput.value,
      n: countInput.value,
      quality: qualityInput.value,
      background: backgroundInput.value,
    };

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '生成失败。');
    }

    const createdAt = new Date(data.created || Date.now()).toISOString();
    const newItems = data.images.map((image) => ({
      ...image,
      prompt: payload.prompt.trim(),
      size: payload.size,
      quality: payload.quality,
      background: payload.background,
      createdAt,
    }));

    history = [...newItems, ...history].slice(0, 60);
    saveHistory();
    renderGallery();
    setStatus(`完成：已生成 ${newItems.length} 张图片。`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    setLoading(false);
  }
});

clearButton.addEventListener('click', () => {
  history = [];
  saveHistory();
  renderGallery();
  setStatus('已清空本地历史。', 'success');
});

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function renderGallery() {
  gallery.replaceChildren();

  if (history.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = '还没有生成图片。写一个提示词开始吧！';
    gallery.append(empty);
    return;
  }

  history.forEach((item, index) => {
    const node = template.content.cloneNode(true);
    const img = node.querySelector('img');
    const meta = node.querySelector('.meta');
    const prompt = node.querySelector('.prompt');
    const download = node.querySelector('.download');
    const src = `data:image/png;base64,${item.b64}`;

    img.src = src;
    img.alt = item.prompt || 'AI 生成图片';
    meta.textContent = `${formatDate(item.createdAt)} · ${item.size} · ${item.quality} · ${item.background}`;
    prompt.textContent = item.revisedPrompt ? `优化提示词：${item.revisedPrompt}` : item.prompt;
    download.href = src;
    download.download = `ai-image-${index + 1}-${item.size}.png`;

    gallery.append(node);
  });
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function setLoading(isLoading, message = '') {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? '生成中…' : '生成图片';
  if (message) setStatus(message);
}

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = type;
}
