// Order tickets: one food ticket for the kitchen and one drink ticket for the bar per party.
// Each item is finished individually (a plate sent to the pass, a drink set in the well);
// when every item on a ticket is done, a runner carries the lot to the table.
import { G, bus, nextId, tableById } from '../state.js';
import { queueJob, cancelJobsFor } from './staff.js';

export function createTickets(p, entered) {
  const table = tableById(p.tableId);
  const mk = (kind, items) => {
    const t = {
      id: nextId(), kind, partyId: p.id, tableId: p.tableId, tableLabel: table?.label || '?',
      partyName: p.name, createdAt: G.time, status: 'open',
      items: items.map((it) => ({ ...it, done: false, quality: 0, inProgress: false })),
    };
    G.tickets.push(t);
    bus.emit('ticket:new', t);
    return t;
  };
  mk('food', entered.map((e) => ({ seat: e.seat, key: e.food })));
  const drinks = entered.filter((e) => e.drink).map((e) => ({ seat: e.seat, key: e.drink }));
  if (drinks.length) mk('drink', drinks);
}

export const openTickets = (kind) => G.tickets.filter((t) => t.kind === kind && t.status === 'open');

/** Mark one item on a ticket finished with a quality 0–1. */
export function completeItem(ticket, itemIndex, quality) {
  const it = ticket.items[itemIndex];
  if (!it || it.done) return;
  it.done = true;
  it.inProgress = false;
  it.quality = quality;
  if (ticket.items.every((i) => i.done)) {
    ticket.status = 'ready';
    queueJob({ type: 'deliver', ticketId: ticket.id });
    bus.emit('toast', {
      kind: 'info',
      text: `${ticket.kind === 'food' ? 'Order up' : 'Drinks up'} for ${ticket.tableLabel}. A runner is on it.`,
    });
  }
  bus.emit('ticket:update', ticket);
}

export function cancelTicketsFor(partyId) {
  for (const t of G.tickets) {
    if (t.partyId === partyId && t.status !== 'delivered') {
      t.status = 'void';
      cancelJobsFor(t.id);
      bus.emit('ticket:update', t);
    }
  }
}

export function ticketAge(t) { return G.time - t.createdAt; }
