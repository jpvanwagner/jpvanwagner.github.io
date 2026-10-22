/*
 * The desk computer: today's appointment list. The visitor gives their name;
 * find it in the two-column list (alphabetical by last name) and confirm, or
 * mark them "not on the list".
 *
 * Mouse / touch: tap a name to select it, tap Confirm (double-click confirms).
 * Keyboard: arrows move (left/right switch column), a letter jumps to that
 * last name, Enter confirms, X / Delete = not on list, Esc = back.
 */
import { Modal } from './Modal.js';
import { el, press } from './dom.js';
import { lastFirst } from '../core/namePool.js';
import { formatClock } from '../core/clock.js';

export class VisitorLookupModal extends Modal {
  constructor(app) {
    super(app, 'lookup-modal');
    app.bus.on('visitorLookup', ({ guest }) => this.open(guest));
    app.bus.on('desk', () => {
      const desk = this.app.game?.desk;
      if (this.isOpen && !desk?.group?.members.includes(this.guest)) this.close();
    });
  }

  open(guest) {
    const game = this.app.game;
    this.guest = guest;
    this.entries = game.appointments.sorted();
    this.rows = Math.ceil(this.entries.length / 2);
    this.index = -1;
    this.message = '';

    this.cells = this.entries.map((entry, i) =>
      el(
        'div', // not a <button>: the list must not steal keyboard focus from the arrow-key navigation
        {
          class: 'vms-name',
          role: 'option',
          'data-name': entry.name,
          style: { gridColumn: i < this.rows ? '1' : '2', gridRow: String((i % this.rows) + 1) },
          ...press(() => this.#select(i)),
          ondblclick: () => this.#confirm(),
        },
        [el('span', {}, lastFirst(entry.name)), el('span', { class: 'vms-time' }, formatClock(entry.minutes))],
      ),
    );
    this.detail = el('div', { class: 'vms-detail' });
    this.list = el('div', { class: 'vms-list', style: { gridTemplateRows: `repeat(${this.rows}, auto)` } }, this.cells);

    this.card.replaceChildren(
      el('div', { class: 'vms-bezel' }, [
        el('div', { class: 'vms-screen' }, [
          el('div', { class: 'vms-bar' }, [el('span', {}, `${this.app.game.company.name.toUpperCase()} \u00b7 VISITOR MANAGEMENT`), el('span', {}, `Today's appointments · ${this.entries.length}`)]),
          el('div', { class: 'vms-says' }, ['Visitor at the desk: ', el('b', {}, `\u201c${guest.greeting ?? `Hi, I\u2019m ${guest.name}.`}\u201d`)]),
          this.list,
          this.detail,
          el('div', { class: 'vms-actions' }, [
            el('button', { class: 'btn btn-ghost', ...press(() => this.close()) }, ['Back', el('kbd', {}, '⌫')]),
            el('button', { class: 'btn btn-danger', 'data-action': 'not-on-list', ...press(() => this.#notOnList()) }, ['Not on list', el('kbd', {}, 'X')]),
            (this.confirmBtn = el('button', { class: 'btn btn-ok', 'data-action': 'confirm', disabled: true, ...press(() => this.#confirm()) }, ['Confirm', el('kbd', {}, '↵')])),
          ]),
        ]),
      ]),
    );
    this.#renderDetail();
    this.show();
    this.list.scrollTop = 0;
  }

  #select(i) {
    this.index = Math.max(0, Math.min(this.entries.length - 1, i));
    this.message = '';
    this.cells.forEach((c, j) => c.classList.toggle('is-selected', j === this.index));
    this.cells[this.index].scrollIntoView({ block: 'nearest' });
    this.#renderDetail();
  }

  #renderDetail() {
    const e = this.entries[this.index];
    this.confirmBtn.disabled = !e;
    this.detail.classList.toggle('is-error', !!this.message);
    if (this.message) {
      this.detail.replaceChildren(this.message);
    } else if (e) {
      this.detail.replaceChildren(
        el('b', {}, e.name),
        ` · ${formatClock(e.minutes)} · Host: ${e.host} (${e.department}) · ${e.roomLabel}`,
      );
    } else {
      this.detail.replaceChildren('Select the visitor’s name, or mark them not on the list.');
    }
  }

  #confirm() {
    const entry = this.entries[this.index];
    if (!entry) return;
    const result = this.app.game.desk.recordLookup(this.guest, entry);
    if (result === 'mismatch') {
      this.message = `${entry.name} isn’t the person at the desk (${this.guest.name}).`;
      this.#renderDetail();
      this.card.classList.remove('shake');
      void this.card.offsetWidth;
      this.card.classList.add('shake');
      return;
    }
    this.close();
  }

  #notOnList() {
    this.app.game.desk.recordLookup(this.guest, null);
    this.close();
  }

  handleKey(e) {
    const key = e.key;
    const i = this.index < 0 ? 0 : this.index;
    const col = i < this.rows ? 0 : 1;
    const row = i % this.rows;
    let next = null;
    if (key === 'ArrowDown') next = this.index < 0 ? 0 : i + 1;
    else if (key === 'ArrowUp') next = this.index < 0 ? 0 : i - 1;
    else if (key === 'ArrowRight') next = col === 0 ? Math.min(this.entries.length - 1, row + this.rows) : i;
    else if (key === 'ArrowLeft') next = col === 1 ? row : i;
    else if (key === 'Home') next = 0;
    else if (key === 'End') next = this.entries.length - 1;
    else if (key === 'Enter') this.#confirm();
    else if (key === 'Backspace' || key === 'Escape') this.close();
    else if (key === 'Delete' || key.toLowerCase() === 'x') this.#notOnList();
    else if (/^[a-z]$/i.test(key)) {
      // Jump to the next last name starting with that letter
      const letter = key.toLowerCase();
      const order = [...this.entries.keys()].map((k) => (k + i + 1) % this.entries.length);
      const hit = order.find((k) => lastFirst(this.entries[k].name).toLowerCase().startsWith(letter));
      if (hit !== undefined) next = hit;
    } else return false;
    if (next !== null) this.#select(next);
    e.preventDefault();
    return true;
  }
}
