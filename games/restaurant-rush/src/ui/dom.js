// Small DOM helpers: element builder, toasts, modals.
import { bus } from '../state.js';

export const $ = (sel, root = document) => root.querySelector(sel);

/** h('div.cls#id', {attrs/on*}, ...children) */
export function h(tag, attrs = {}, ...kids) {
  const [, name = 'div', rest = ''] = tag.match(/^([a-z0-9]+)?(.*)$/i);
  const el = document.createElement(name);
  for (const part of rest.match(/[.#][^.#]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
}

export const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
export const moodColor = (m) => (m >= 60 ? '#2f7a45' : m >= 35 ? '#c27a12' : '#b3262b');
export const moodBar = (m) => h('div.mood', {}, h('i', { style: { width: `${Math.max(3, m)}%`, background: moodColor(m) } }));

// ── Toasts ──────────────────────────────────────────────────────────────────
let lastToast = '';
export function initToasts() {
  const host = $('#toasts');
  bus.on('toast', ({ kind = 'info', text }) => {
    if (text === lastToast) return;
    lastToast = text;
    setTimeout(() => { if (lastToast === text) lastToast = ''; }, 1500);
    const el = h(`div.toast.${kind}`, {}, text);
    host.prepend(el);
    while (host.children.length > 4) host.lastChild.remove();
    setTimeout(() => el.classList.add('out'), 3600);
    setTimeout(() => el.remove(), 4000);
  });
}

// ── Modals ──────────────────────────────────────────────────────────────────
let onCloseFn = null;
export function openModal({ title, sub, body, actions = [], dismissable = true, onClose, wide = false }) {
  const root = $('#modal-root');
  root.innerHTML = '';
  onCloseFn = onClose || null;
  const foot = h('div.modal-foot', {}, actions.map((a) => h(`button.btn${a.primary ? '.btn-primary' : a.dark ? '.btn-dark' : ''}`, {
    onclick: () => { if (!a.keepOpen) closeModal(); a.run?.(); },
    disabled: a.disabled,
  }, a.label)));
  const modal = h(`div.modal${wide ? '.wide' : ''}`, { role: 'dialog', 'aria-modal': 'true' },
    h('div.modal-head', {}, h('h2', {}, title), sub ? h('p', {}, sub) : null),
    h('div.modal-body', {}, body),
    actions.length ? foot : null,
  );
  const back = h('div.modal-back', { onclick: (e) => { if (dismissable && e.target === back) closeModal(); } }, modal);
  root.append(back);
  return modal;
}
export function closeModal() {
  $('#modal-root').innerHTML = '';
  const fn = onCloseFn;
  onCloseFn = null;
  fn?.();
}
export const modalOpen = () => !!$('#modal-root').firstChild;
