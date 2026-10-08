/**
 * DEMO-CONTROLS.JS - Tiny Mute and Full screen buttons on every game and software demo on the site
 * (global: DemoControls). One file, used by both views:
 *
 *   Every <iframe data-demo> on a page (Traditional View and inside NetCrawler), and the game,
 *   Midnight and Scenemaker windows on the Retro Desktop (window-manager.js calls enhance), get two
 *   small square buttons in the top-right corner of the game screen itself: a speaker (mute / sound
 *   on) and a full-screen toggle. They match the mute button the Midnight at the Multiplex demo
 *   already draws; that demo keeps its own mute, so only the full-screen button is added beside it.
 *   Full screen takes the buttons along, so the exit button stays on screen (holding Esc works too;
 *   a quick Esc stays with the game, see the fullscreenchange listener at the bottom).
 *
 * How mute reaches the sound: games make sound with Web Audio or <audio>/<video>. For a demo on
 * this site (same origin) we put a volume knob in front of every Web Audio context's speakers
 * and mute media elements, including ones that start later.
 * No sound at all (a tool, not a game): add data-demo-nomute and only the full-screen button appears.
 * Start muted: add data-demo-muted to the iframe. For that to catch sound made the moment the demo
 * loads, the demo page calls DemoControls.early(window) first thing in its <head>:
 *   <script>try{if(parent!==window&&parent.DemoControls)parent.DemoControls.early(window)}catch(e){}</script>
 * Styles: shared/share.css ("DEMO CONTROLS")
 */
(function () {
    'use strict';

    var ICON = {
        sound: '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M2 6h3l4-3v10L5 10H2z" fill="currentColor"/><path d="M11 6.5c1 1 1 2 0 3M13 4.5c2 2 2 5 0 7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
        muted: '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M2 6h3l4-3v10L5 10H2z" fill="currentColor"/><path d="M11 6l4 4M15 6l-4 4" stroke="#ff6b5a" stroke-width="1.8"/></svg>',
        full: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M1.5 6V1.5H6M10 1.5h4.5V6M14.5 10v4.5H10M6 14.5H1.5V10" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
        exit: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 1.5V6H1.5M14.5 6H10V1.5M10 14.5V10h4.5M1.5 10H6v4.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
    };

    /** Patch a demo frame's window once so its sound can be muted. */
    function hook(win) {
        try {
            if (!win || win.__dcHooked) return !!win;
            win.__dcHooked = true;
            // <iframe data-demo data-demo-muted>: the demo starts with its sound off (the visitor can turn it on)
            var fe = null; try { fe = win.frameElement; } catch (e) {}
            win.__dcMuted = !!(fe && fe.hasAttribute('data-demo-muted'));
            win.__dcMasters = [];
            var Base = win.BaseAudioContext || win.AudioContext || win.webkitAudioContext;
            var desc = Base && Base.prototype && Object.getOwnPropertyDescriptor(Base.prototype, 'destination');
            if (desc && desc.get && !win.MMDemoMute) {
                Object.defineProperty(Base.prototype, 'destination', {
                    configurable: true,
                    get: function () {
                        var real = desc.get.call(this);
                        if (!this.__dcMaster) {
                            try {
                                var g = this.createGain();
                                g.gain.value = win.__dcMuted ? 0 : 1;
                                g.connect(real);
                                this.__dcMaster = g;
                                win.__dcMasters.push(g);
                            } catch (e) { return real; }
                        }
                        return this.__dcMaster;
                    }
                });
            }
            // <audio>/<video> and new Audio() objects (which never join the page) follow the setting when they play
            win.__dcMedia = [];
            var Media = win.HTMLMediaElement && win.HTMLMediaElement.prototype, realPlay = Media && Media.play;
            if (realPlay) Media.play = function () {
                try { this.muted = win.__dcMuted; if (win.__dcMedia.indexOf(this) < 0) win.__dcMedia.push(this); } catch (e) {}
                return realPlay.apply(this, arguments);
            };
            // media that starts playing later follows the current setting
            win.document.addEventListener('play', function (e) {
                if (e.target && 'muted' in e.target) e.target.muted = win.__dcMuted;
            }, true);
            return true;
        } catch (e) { return false; }   // another website's frame: browsers don't allow it
    }

    function frameWin(frame) { try { return frame.contentWindow; } catch (e) { return null; } }
    function ownMute(frame) { try { var w = frameWin(frame); return !!(w && w.MMDemoMute); } catch (e) { return false; } }

    var DC = window.DemoControls = {
        isMuted: function (frame) {
            var w = frameWin(frame);
            try { if (w && w.MMDemoMute) return w.MMDemoMute.muted; } catch (e) {}
            return !!(w && w.__dcMuted);
        },

        setMuted: function (frame, on) {
            var w = frameWin(frame);
            if (!w) return;
            try {
                if (w.MMDemoMute) { if (w.MMDemoMute.muted !== on) w.MMDemoMute.toggle(); return; }
            } catch (e) {}
            if (!hook(w)) return;
            w.__dcMuted = on;
            (w.__dcMasters || []).forEach(function (g) { try { g.gain.value = on ? 0 : 1; } catch (e) {} });
            try { w.document.querySelectorAll('audio, video').forEach(function (m) { m.muted = on; }); } catch (e) {}
            (w.__dcMedia || []).forEach(function (m) { try { m.muted = on; } catch (e) {} });
        },

        /** Called from inside a demo page, first thing in its <head>, so the sound is hooked before the
            demo's own code makes any (needed when the frame starts muted). */
        early: function (win) { hook(win); },

        toggleMute: function (frame) {
            var on = !DC.isMuted(frame);
            DC.setMuted(frame, on);
            return on;
        },

        /** Full screen for the demo's box (the game plus its corner buttons), or back again. */
        toggleFullscreen: function (el) {
            var doc = el.ownerDocument;
            if (doc.fullscreenElement) { doc.exitFullscreen(); return; }
            if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
        },

        /** The box a demo's corner buttons live in (and that goes full screen). */
        hostOf: function (frame) { return frame.parentElement; },

        /** Put the two corner buttons on one demo frame. */
        enhance: function (frame) {
            if (!frame || frame.__dcDone) return;
            frame.__dcDone = true;
            var host = DC.hostOf(frame);
            host.classList.add('demo-host');
            var ov = document.createElement('div');
            ov.className = 'demo-ov';
            ov.innerHTML =
                '<button type="button" class="demo-btn demo-mute"></button>' +
                '<button type="button" class="demo-btn demo-fs"></button>';
            host.appendChild(ov);
            // <iframe data-demo data-demo-nomute>: a demo with no sound (a tool) gets only the full-screen button
            if (frame.hasAttribute('data-demo-nomute')) ov.querySelector('.demo-mute').remove();

            var muteBtn = ov.querySelector('.demo-mute'), fsBtn = ov.querySelector('.demo-fs');
            var label = function (b, t) { b.title = t; b.setAttribute('aria-label', t); };
            var refocus = function () { try { frame.contentWindow.focus(); } catch (e) {} };
            var showMute = function () {
                if (!muteBtn) return;                               // data-demo-nomute: no speaker button
                ov.classList.toggle('own-mute', ownMute(frame));   // the Midnight demo draws its own speaker
                var m = DC.isMuted(frame);
                muteBtn.innerHTML = m ? ICON.muted : ICON.sound;
                label(muteBtn, m ? 'Sound is off: click to turn it on' : 'Mute all sound');
                muteBtn.setAttribute('aria-pressed', String(m));
            };
            var showFs = function () {
                var on = document.fullscreenElement === host;
                host.classList.toggle('is-full', on);
                fsBtn.innerHTML = on ? ICON.exit : ICON.full;
                label(fsBtn, on ? 'Exit full screen (or hold Esc)' : 'Full screen (this button or a long press of Esc exits)');
            };
            // keep keyboard focus in the game: the buttons don't take it on click
            [muteBtn, fsBtn].forEach(function (b) { if (b) b.addEventListener('mousedown', function (e) { e.preventDefault(); }); });
            if (muteBtn) muteBtn.addEventListener('click', function () { DC.toggleMute(frame); showMute(); refocus(); });
            fsBtn.addEventListener('click', function () { DC.toggleFullscreen(host); });
            document.addEventListener('fullscreenchange', function () { showFs(); refocus(); });
            frame.addEventListener('load', function () { hook(frameWin(frame)); showMute(); setTimeout(showMute, 400); });
            hook(frameWin(frame));
            showMute();
            showFs();
        },

        init: function () {
            document.querySelectorAll('iframe[data-demo]').forEach(DC.enhance);
        }
    };

    // In full screen, keep a tap of Esc for the game (cancel, back, pause menus) instead of the
    // browser leaving full screen; holding Esc, or the corner button, still exits. Chrome and Edge
    // support this; other browsers leave full screen on Esc as usual.
    document.addEventListener('fullscreenchange', function () {
        try {
            if (!navigator.keyboard || !navigator.keyboard.lock) return;
            if (document.fullscreenElement) navigator.keyboard.lock(['Escape']).catch(function () {});
            else navigator.keyboard.unlock();
        } catch (e) {}
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', DC.init);
    else DC.init();
})();
