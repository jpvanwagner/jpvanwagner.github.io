/**
 * SYS-CLOCK.JS - The retro desktop's own clock (global: SysClock).
 *
 * The tray shows the date and time ("09/27/2026 3:20 PM"). Double-click it (or right-click >
 * Adjust Date/Time) for a Windows 95-style "Date/Time Properties" window where visitors can
 * pick a time zone and set any date and time they like. None of that is saved: refreshing the
 * page or coming back later always shows the real time again.
 *
 *   SysClock.parts()          { year, month, day, hour, minute, second, weekday } right now,
 *                             in the chosen time zone, including any date/time change
 *   SysClock.trayText()       what the tray shows
 *   SysClock.openProperties() the Date/Time Properties window
 *   SysClock.reset()          back to the real time and the computer's own time zone
 *
 * Every second it checks whether the year just rolled over from 1999 to 2000 (set the clock to
 * just before midnight on December 31, 1999 and wait), and if so starts the Y2K "bug"
 * (desktop/js/customize/y2k.js). The Clock app (apps/clock.js) uses parts() too.
 */
window.SysClock = {
    offsetMs: 0,          // how far the visitor moved the clock (milliseconds); never saved
    timeZone: null,       // an IANA name like 'America/Chicago'; null = the computer's own
    lastYear: null,

    localZone() {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
    },
    zone() { return this.timeZone || this.localZone(); },

    /** The clock's fields for a moment (default: now, shifted), in the chosen time zone. */
    parts(ms = Date.now() + this.offsetMs, zone = this.zone()) {
        const out = {};
        try {
            new Intl.DateTimeFormat('en-US', {
                timeZone: zone, hourCycle: 'h23', weekday: 'long', year: 'numeric', month: '2-digit',
                day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
            }).formatToParts(new Date(ms)).forEach(p => { out[p.type] = p.value; });
        } catch (e) {
            const d = new Date(ms);
            Object.assign(out, { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(),
                minute: d.getMinutes(), second: d.getSeconds(), weekday: d.toLocaleDateString('en-US', { weekday: 'long' }) });
        }
        return { year: +out.year, month: +out.month, day: +out.day, hour: +out.hour % 24,
                 minute: +out.minute, second: +out.second, weekday: out.weekday };
    },

    pad(n) { return String(n).padStart(2, '0'); },

    trayText() {
        const t = this.parts();
        const year = (window.Y2K && Y2K.active) ? 1900 : t.year;      // the "bug": 2000 shows as 1900
        return `${this.pad(t.month)}/${this.pad(t.day)}/${year} ${t.hour % 12 || 12}:${this.pad(t.minute)} ${t.hour >= 12 ? 'PM' : 'AM'}`;
    },

    /** The real moment (ms) at which the chosen zone's wall clock reads the given date and time. */
    epochFor(y, mo, d, h, mi, s) {
        const want = Date.UTC(y, mo - 1, d, h, mi, s);
        let guess = want;
        for (let i = 0; i < 2; i++) {                    // twice handles daylight-saving edges
            const p = this.parts(guess);
            const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
            guess += want - seen;
        }
        return guess;
    },

    /** Set the clock to a wall-clock date and time in the chosen zone (not saved). */
    setWallClock(y, mo, d, h, mi, s) {
        this.offsetMs = this.epochFor(y, mo, d, h, mi, s) - Date.now();
        this.lastYear = null;                             // a jump isn't a rollover...
        this.tick();
        // ...except landing in the first minute of January 1, 2000 counts as "just rolled over"
        if (y === 2000 && mo === 1 && d === 1 && h === 0 && mi === 0 && window.Y2K) Y2K.start();
    },

    reset() {
        this.offsetMs = 0;
        this.timeZone = null;
        this.lastYear = null;
        this.tick();
    },

    tick() {
        const el = document.getElementById('tray-clock');
        if (el && !(window.Y2K && Y2K.active)) {           // during the Y2K bug, y2k.js blinks the clock itself
            const text = this.trayText();
            if (el.dataset.text !== text) {
                const grew = (el.dataset.text || '').length !== text.length;
                el.dataset.text = text;
                // date and time as two parts with a small divider between them (styles: taskbricks.css)
                const [date, ...time] = text.split(' ');
                el.innerHTML = `<span class="tc-date">${date}</span><span class="tc-sep" aria-hidden="true"></span><span class="tc-time">${time.join(' ')}</span>`;
                if (grew && window.TaskBricks && TaskBricks.updateLayout) TaskBricks.updateLayout();
            }
        }
        const y = this.parts().year;
        if (this.lastYear === 1999 && y === 2000 && window.Y2K) Y2K.start();   // Happy new millennium!
        this.lastYear = y;
    },

    // ------------------------------------------------------------------ Date/Time Properties

    /** Every time zone the browser knows (or a short list on older browsers). */
    zones() {
        try { if (Intl.supportedValuesOf) return Intl.supportedValuesOf('timeZone'); } catch (e) {}
        return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles',
                'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo',
                'Asia/Kolkata', 'Asia/Shanghai', 'Australia/Sydney'];
    },

    openProperties() {
        const t = this.parts();
        const local = this.localZone();
        const opts = [`<option value="">Your computer's time zone (${local.replace(/_/g, ' ')})</option>`]
            .concat(this.zones().map(z => `<option value="${z}" ${z === this.timeZone ? 'selected' : ''}>${z.replace(/_/g, ' ')}</option>`)).join('');
        const html = `
            <div class="dt-props">
                <fieldset><legend>Date &amp; time</legend>
                    <label class="dt-row">Date <input type="date" id="dt-date" min="1900-01-01" max="2999-12-31"
                        value="${t.year}-${this.pad(t.month)}-${this.pad(t.day)}" title="Pick any date"></label>
                    <label class="dt-row">Time <input type="time" id="dt-time" step="1"
                        value="${this.pad(t.hour)}:${this.pad(t.minute)}:${this.pad(t.second)}" title="Pick any time"></label>
                </fieldset>
                <fieldset><legend>Time zone</legend>
                    <select id="dt-zone" title="Show the time somewhere else in the world">${opts}</select>
                </fieldset>
                <p class="dt-note">Just for fun: changes last until you refresh or leave the page.</p>
                <div class="dt-buttons">
                    <button type="button" class="bevel-out" data-dt="real" title="Back to the real date, time, and your own time zone">Real time</button>
                </div>
                <div class="dt-buttons dt-main">
                    <button type="button" class="bevel-out" data-dt="ok"><b>OK</b></button>
                    <button type="button" class="bevel-out" data-dt="cancel">Cancel</button>
                    <button type="button" class="bevel-out" data-dt="apply">Apply</button>
                </div>
            </div>`;
        WM.open('datetime', 'Date/Time Properties', html, 'images/icons/os/clock.png', { width: 330, height: 310, center: true });
        const win = WM.windows['datetime'];
        if (!win || win.dataset.dtHooked) return;
        win.dataset.dtHooked = '1';

        // Changing the zone updates the date/time boxes to show that zone's current time
        win.querySelector('#dt-zone').addEventListener('change', (e) => {
            const p = this.parts(Date.now() + this.offsetMs, e.target.value || local);
            win.querySelector('#dt-date').value = `${p.year}-${this.pad(p.month)}-${this.pad(p.day)}`;
            win.querySelector('#dt-time').value = `${this.pad(p.hour)}:${this.pad(p.minute)}:${this.pad(p.second)}`;
        });

        const apply = () => {
            this.timeZone = win.querySelector('#dt-zone').value || null;
            const [y, mo, d] = (win.querySelector('#dt-date').value || '').split('-').map(Number);
            const [h, mi, s] = (win.querySelector('#dt-time').value || '0:0:0').split(':').map(Number);
            if (y && mo && d) this.setWallClock(y, mo, d, h || 0, mi || 0, s || 0);
            else this.tick();
        };
        win.addEventListener('click', (e) => {
            const b = e.target.closest('[data-dt]');
            if (!b) return;
            const act = b.getAttribute('data-dt');
            if (act === 'apply') apply();
            if (act === 'ok') { apply(); WM.close('datetime'); }
            if (act === 'cancel') WM.close('datetime');
            if (act === 'real') { this.reset(); WM.close('datetime'); }
        });
    },

    init(tries = 0) {
        const clock = document.getElementById('tray-clock');
        if (!clock && tries < 50) { setTimeout(() => this.init(tries + 1), 200); return; }   // tray not built yet
        if (clock) {
            // Replace the old clock's handlers (taskbricks-parts.js) with ours
            const fresh = clock.cloneNode(true);
            clock.replaceWith(fresh);
            fresh.addEventListener('mouseenter', () => {
                const t = this.parts();
                fresh.title = `${t.weekday}, ${this.pad(t.month)}/${this.pad(t.day)}/${t.year}` +
                    (this.timeZone ? ` (${this.timeZone.replace(/_/g, ' ')})` : '') +
                    '\nDouble-click to change the date, time, or time zone';
            });
            fresh.addEventListener('dblclick', () => this.openProperties());
            fresh.addEventListener('contextmenu', (e) => {
                if (!window.ContextMenu) return;
                e.preventDefault(); e.stopPropagation();
                ContextMenu.show(e.clientX, e.clientY, [
                    { label: '<b>Adjust Date/Time...</b>', action: () => this.openProperties() },
                    { label: 'Clock & timers...', action: () => window.ClockApp && ClockApp.open() },
                    { separator: true },
                    { label: 'Back to real time', disabled: !this.offsetMs && !this.timeZone, action: () => this.reset() }
                ]);
            });
        }
        this.tick();
        setInterval(() => this.tick(), 1000);
    }
};
document.addEventListener('DOMContentLoaded', () => setTimeout(() => SysClock.init(), 0));
