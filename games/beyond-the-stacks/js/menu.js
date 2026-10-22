/* JS/MENU.JS - Right-click menus (program cards, calendar bookings, days, map rooms).
   Menu.show(clientX, clientY, items, title) where each item is
     { label, icon, action, hint, danger, disabled }  or  '-' (a divider).
   Arrow keys move, Enter picks, Esc or a click elsewhere closes. */

window.Menu = (function () {
  let el = null, items = [], focusIdx = -1;

  function close() {
    if (!el) return;
    el.remove(); el = null;
    document.removeEventListener('mousedown', outside, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('blur', close);
  }
  function outside(e) { if (el && !el.contains(e.target)) close(); }
  function onKey(e) {
    const btns = [...el.querySelectorAll('button:not([disabled])')];
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusIdx = (focusIdx + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
      btns[focusIdx].focus();
    }
  }

  function show(x, y, list, title) {
    close();
    items = list.filter(Boolean);
    el = document.createElement('div');
    el.className = 'ctx-menu'; el.setAttribute('role', 'menu');
    let h = title ? '<div class="ctx-title">' + title + '</div>' : '';
    items.forEach((it, i) => {
      if (it === '-') { h += '<hr>'; return; }
      h += '<button type="button" role="menuitem" data-i="' + i + '" class="' + (it.danger ? 'danger' : '') + '"' + (it.disabled ? ' disabled' : '') + '>' +
        (it.icon ? Icons.svg(it.icon) : '<span class="ico"></span>') + '<span class="lbl">' + it.label + '</span>' + (it.hint ? '<small>' + it.hint + '</small>' : '') + '</button>';
    });
    el.innerHTML = h;
    document.body.appendChild(el);
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(4, Math.min(window.innerWidth - r.width - 4, x)) + 'px';
    el.style.top = Math.max(4, Math.min(window.innerHeight - r.height - 4, y)) + 'px';
    el.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]'); if (!b || b.disabled) return;
      const it = items[+b.dataset.i]; close();
      if (it.action) it.action();
    });
    el.addEventListener('contextmenu', e => e.preventDefault());
    focusIdx = -1;
    setTimeout(() => {
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', onKey, true);
      window.addEventListener('blur', close);
      const first = el && el.querySelector('button:not([disabled])'); if (first) { first.focus(); focusIdx = 0; }
    }, 0);
    if (window.Sfx) Sfx.play('tick');
  }

  return { show, close, isOpen: () => !!el };
})();
