/*
 * Minimal modal base: builds a backdrop + card, routes keys while open, and
 * tells the desk the player is "inspecting" (the entry window pauses).
 */
import { el } from './dom.js';

export class Modal {
  constructor(app, className) {
    this.app = app;
    this.root = el('div', { class: `modal ${className}`, hidden: true, role: 'dialog', 'aria-modal': 'true' });
    this.card = el('div', { class: 'modal-card', tabindex: '-1' });
    this.root.append(this.card);
    this.root.addEventListener('pointerdown', (e) => e.target === this.root && this.close());
    document.body.append(this.root);
  }

  get isOpen() {
    return !this.root.hidden;
  }

  show() {
    this.root.hidden = false;
    // Take focus away from whatever opened us (a focused desk button would
    // otherwise re-fire on Enter); keys then reach handleKey().
    document.activeElement?.blur?.();
    this.card.focus({ preventScroll: true });
    setTimeout(() => this.isOpen && this.card.focus({ preventScroll: true }), 0);
    this.app.game?.desk.setInspecting(true);
    this.app.activeModal = this;
  }

  close() {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.app.game?.desk.setInspecting(false);
    if (this.app.activeModal === this) this.app.activeModal = null;
  }

  /** Return true if the key was handled. */
  handleKey() {
    return false;
  }
}
