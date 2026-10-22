/*
 * Minimal publish/subscribe bus. Systems emit, UI listens, so gameplay code
 * never touches the DOM directly.
 *
 * Events used in the game (payloads in parentheses):
 *   score        ({ delta, total, reason, pos })
 *   desk         ()                 desk state changed - re-render desk panel
 *   waiting      ()                 waiting area changed
 *   officers     ()                 officer availability changed
 *   incidents    ()                 incident list changed
 *   camera       ({ camera|null })  entered / left a security camera view
 *   doors        ()                 a door opened, closed or was propped
 *   shift:end    ({ summary })
 *   pause        ({ paused })
 */
export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this.handlers.get(event)?.delete(fn);
  }

  emit(event, payload) {
    this.handlers.get(event)?.forEach((fn) => fn(payload));
  }

  clear() {
    this.handlers.clear();
  }
}
