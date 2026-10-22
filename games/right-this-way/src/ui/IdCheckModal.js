/*
 * Identity verification (staff). Shows the person standing at the desk next
 * to the ID card they handed over: photo, name, department, clearance and
 * expiry date. Spot an expired or borrowed badge, then decide right here.
 * Officers carry The Organization's card (its seal, a different layout).
 *
 * Keys: A verify & allow - T print temp badge & allow (expired badge) -
 * D deny - Backspace / B back to the desk.
 */
import { Modal } from './Modal.js';
import { el, press } from './dom.js';
import { portrait } from './avatar.js';
import { formatDate } from '../systems/credentials.js';
import { companyLogoSvg } from '../data/companies.js';
import { DeskActionId } from '../systems/DeskSystem.js';
import { ORGANIZATION, orgLogoSvg } from '../data/organization.js';

export class IdCheckModal extends Modal {
  constructor(app) {
    super(app, 'id-modal');
    app.bus.on('idCheck', ({ members }) => this.open(members));
    app.bus.on('desk', () => {
      // Close if the people being checked are no longer at the desk.
      const desk = this.app.game?.desk;
      if (this.isOpen && !this.members?.some((m) => desk?.group?.members.includes(m))) this.close();
    });
  }

  open(members) {
    this.members = members;
    const game = this.app.game;
    const company = game.company;
    const card = (m) => {
      const id = m.idCard;
      const org = m.isOfficer;
      return el('div', { class: 'id-row' }, [
        el('figure', { class: 'id-person' }, [portrait(m.appearance, { size: 108, background: '#e9e4da' }), el('figcaption', {}, 'At the desk')]),
        el('div', { class: `id-card ${org ? 'is-officer' : ''}` }, [
          org
            ? el('div', { class: 'id-card-head' }, [el('span', {}, ORGANIZATION.name.toUpperCase()), el('span', {}, 'FIELD OFFICER')])
            : el('div', { class: 'id-card-head', style: { background: company.ink } }, [el('span', {}, company.name.toUpperCase()), el('span', {}, 'STAFF')]),
          el('div', { class: 'id-card-body' }, [
            portrait(id.photo, { size: 84 }),
            el('dl', {}, [
              el('dt', {}, 'Name'), el('dd', { class: 'id-name' }, m.name),
              el('dt', {}, org ? 'Employer' : 'Dept'), el('dd', {}, id.department),
              el('dt', {}, 'ID no.'), el('dd', { class: 'mono' }, id.idNumber),
              el('dt', {}, 'Clearance'), el('dd', {}, id.clearance),
              el('dt', {}, 'Issued'), el('dd', { class: 'mono' }, formatDate(id.issued)),
              el('dt', {}, 'Expires'), el('dd', { class: 'mono id-expires' }, formatDate(id.expires)),
            ]),
            el('div', { class: 'id-seal', html: org ? orgLogoSvg({ size: 96 }) : companyLogoSvg(company, { size: 80 }) }),
          ]),
          org ? el('div', { class: 'id-card-fine' }, ORGANIZATION.smallPrint) : null,
          el('div', { class: 'id-card-stripe', style: org ? {} : { background: `repeating-linear-gradient(90deg, ${company.ink} 0 6px, ${company.accent} 6px 12px)` } }),
        ]),
      ]);
    };
    const btn = (label, key, cls, fn, disabled = false, action = null) =>
      el('button', { class: `btn ${cls}`, disabled, 'data-action': action, ...press(fn) }, [label, el('kbd', {}, key)]);
    const desk = game.desk;
    const tempOk = members.length === 1 && (members[0].tempPass || desk.canPrintTemp(members));

    this.card.replaceChildren(
      el('div', { class: 'modal-head' }, [
        el('h2', {}, 'Identity verification'),
        el('span', { class: 'modal-date mono' }, `TODAY ${formatDate(game.date)}`),
      ]),
      el('p', { class: 'modal-hint' }, 'Does the photo match the person? Is the badge still valid?'),
      ...members.map(card),
      el('div', { class: 'modal-actions id-actions' }, [
        btn('Deny entry', 'D', 'btn-danger', () => this.#decide(DeskActionId.DENY), false, 'deny'),
        btn('Back to desk', '⌫', 'btn-ghost', () => this.close()),
        btn(desk.printJob && !members[0]?.tempPass ? 'Printer busy' : 'Temp badge & allow', 'T', 'btn-info', () => this.#tempAndAllow(), !tempOk, 'temp-allow'),
        btn('Verify & allow', 'A', 'btn-ok', () => this.#decide(DeskActionId.ALLOW), false, 'allow'),
      ]),
    );
    this.show();
  }

  close() {
    if (this.isOpen && this.members) this.app.game?.desk.markIdChecked(this.members);
    super.close();
  }

  #decide(action) {
    const desk = this.app.game?.desk;
    this.close(); // marks the IDs as checked
    desk?.perform(action);
  }

  /** Expired badge: print a temp badge, then they go in (no need to deny). */
  #tempAndAllow() {
    const desk = this.app.game?.desk;
    const m = this.members?.[0];
    this.close();
    desk?.printTempAndAllow(m);
  }

  handleKey(e) {
    const key = e.key.toLowerCase();
    if (key === 'backspace' || key === 'escape' || key === 'b') this.close();
    else if (key === 'a' || key === 'enter') this.#decide(DeskActionId.ALLOW);
    else if (key === 'd') this.#decide(DeskActionId.DENY);
    else if (key === 't') this.#tempAndAllow();
    else return false;
    e.preventDefault();
    return true;
  }
}
