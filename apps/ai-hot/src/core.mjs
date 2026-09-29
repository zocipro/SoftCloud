export const MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
export const PREFIX = '/api/ai-hot';
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export function safeUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function cleanText(value, limit = 6000) {
  return String(value ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, s => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[s])).replace(/\s+/g, ' ').trim().slice(0, limit);
}
export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const beijingDay = (now = Date.now()) => new Date(now + 8 * 3600000).toISOString().slice(0, 10);
export function archiveItem(published, discovered) { return published < discovered - 48 * 3600000; }
export function isSelected(a, b, threshold) { return Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(threshold) && a + b >= threshold * 2; }
// Reserve an upper bound using UTF-8 bytes rather than an optimistic token estimate.
// Includes chat-template overhead; rates match the pinned Qwen model's official pricing.
export function neuronReservation(prompt, maxTokens) {
  return Math.ceil((new TextEncoder().encode(prompt).length + 1024) * 4625 / 1e6 + maxTokens * 30475 / 1e6);
}
export function parseModelJson(output) {
  const raw = typeof output === 'string' ? output : output?.response ?? output?.choices?.[0]?.message?.content;
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string') throw Error('模型没有返回文本');
  const text = raw.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '').trim();
  const result = JSON.parse(text);
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error('模型 JSON 格式无效');
  return result;
}
export function eventHeat(items, now = Date.now()) {
  const latest = new Map();
  for (const item of items) if (item.published > now - 48 * 3600000 && !item.archived) latest.set(item.source_id, Math.max(latest.get(item.source_id) ?? 0, item.published));
  return [...latest.values()].reduce((sum, t) => sum + Math.pow(2, -(now - t) / 86400000), 0);
}
export function reportWindow(date) {
  const end = Date.parse(date + 'T08:00:00+08:00');
  if (!Number.isFinite(end)) throw Error('日期无效');
  return {start: end - 86400000, end};
}
