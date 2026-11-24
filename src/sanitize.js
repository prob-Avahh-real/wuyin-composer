/**
 * 展示与数据消毒（无 Node 内置依赖，可供 Web / CLI 共用）
 */

const MODE_RE = /^(gong|shang|jue|zhi|yu)$/;
const SAFE_ID_RE = /^[a-zA-Z0-9._-]+$/;

function basename(name) {
  const s = String(name ?? '').replace(/\\/g, '/');
  const parts = s.split('/');
  return parts[parts.length - 1] || '';
}

/** 转义 HTML 文本节点内容，防止 XSS */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 校验调式 id，拒绝注入字符 */
export function assertSafeModeId(modeId) {
  if (!MODE_RE.test(String(modeId || ''))) {
    throw new Error(`未知调式: ${modeId}`);
  }
  return modeId;
}

/** 仅允许安全文件名片段（无路径分隔与遍历） */
export function assertSafeFilename(name) {
  const raw = String(name ?? '');
  if (raw.includes('\0') || /[\\/]/.test(raw)) {
    throw new Error(`非法文件名: ${name}`);
  }
  const base = basename(raw);
  if (!base || base === '.' || base === '..' || !SAFE_ID_RE.test(base)) {
    throw new Error(`非法文件名: ${name}`);
  }
  return base;
}

/** 将任意标题压成可落盘的安全 id 片段 */
export function slugifyIdPart(value, fallback = 'song') {
  const s = String(value ?? '')
    .normalize('NFKC')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return s || fallback;
}

/** 拒绝带原型污染键的普通对象（浅层） */
export function stripPrototypePollution(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const out = Object.create(null);
  for (const key of Object.keys(input)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    out[key] = input[key];
  }
  return out;
}

/** MIDI 音高钳制到合法范围 */
export function clampMidi(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 60;
  return Math.max(0, Math.min(127, Math.round(v)));
}
