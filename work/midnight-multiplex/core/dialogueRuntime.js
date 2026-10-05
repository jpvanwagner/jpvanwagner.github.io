/**
 * Midnight at the Multiplex — Dialogue Runtime
 * =============================================
 * Plays a branching conversation authored in SAYMAKER inside the 3D engine,
 * driven by a dialogue JSON file that an author attached to an NPC/object in
 * MAPSTER. This is the glue that makes the two tools produce playable segments.
 *
 * PIPELINE
 *   Saymaker  → exports  dialogue/<id>.json   (nodes / choices / outcomes …)
 *   Mapster   → NPC/sign meta.dialogueFile = '<id>'; the .json is inlined into
 *               the exported map as <script type="application/json" id="dlg-<id>">
 *   Engine    → on interact, calls DialogueRuntime.start('<id>', speakerCtx)
 *
 * The runtime walks the node graph:
 *   • For each node, it plays the node's LINES in order. A line whose
 *     `conditions` fail (checked against window.playerContext) is skipped.
 *   • Before a line's text shows, the line's CAMERA state is applied (iso
 *     facing / tilt / zoom / cinematic swoop) and its DISPLAY (nameplate +
 *     portrait) is rendered.
 *   • After the lines, the node's CHOICES are shown. A choice whose visibility
 *     `conditions` fail is hidden. A skill-CHECK choice (isCheck) is rolled
 *     against the player; success/failure pick which outcome branch to follow.
 *   • Following an outcome's `targetNode` moves to the next node. An outcome
 *     with no target ends the conversation.
 *
 * DATA SOURCE (works on file:// AND http):
 *   Exported maps INLINE each referenced dialogue file as a
 *   <script type="application/json" id="dlg-<id>"> blob (because file://
 *   blocks fetch of sibling files). The runtime reads that blob first; if it's
 *   absent (e.g. a served preview that didn't inline), it falls back to
 *   fetch('<prefix>dialogue/<id>.json').
 *
 * PLAYER CONTEXT
 *   window.playerContext = { stats:{...}, skills:[...], hobbies:[...],
 *                            cliques:[...], items:[...], gender:'…',
 *                            orientation:'…', romance:{npcId:level},
 *                            appearance:{...} }
 *   (skills should already include any auto-granted by the player's hobbies,
 *    e.g. Klepto → light_fingers; the character system expands those when it
 *    builds playerContext. Hobby conditions check the `hobbies` array.)
 *   In standalone preview/export there's usually no character; conditions then
 *   default to PASS (so the level author can walk the whole tree to test it),
 *   unless window.__strictDialogueConds === true.
 *
 * INTEGRATION
 *   The host engine calls DialogueRuntime.init({ camManager, player,
 *   showError, rootPrefix }) once, then DialogueRuntime.start(id, speaker).
 *   `speaker` = { name, mesh } of the NPC/object talking (for camera focus +
 *   default nameplate).
 *
 * Exposed as window.DialogueRuntime.
 */
(function () {
    'use strict';

    let ctx = { camManager: null, player: null, showError: null, rootPrefix: '' };
    let active = null;     // current play session, or null when idle
    let overlayEl = null;  // the dialogue DOM overlay (built lazily)

    function init(context) { Object.assign(ctx, context || {}); }

    // ── data loading ─────────────────────────────────────────────────────────
    // Returns a Promise<conversation|null>. Inline blob first, then fetch.
    function loadDialogue(id) {
        // 1. Inline blob baked into the exported map.
        const blob = document.getElementById('dlg-' + id);
        if (blob && blob.textContent.trim()) {
            try { return Promise.resolve(JSON.parse(blob.textContent)); }
            catch (e) { return Promise.resolve(null); }
        }
        // 2. Fetch from the dialogue/ folder (served / preview contexts).
        const url = (ctx.rootPrefix || '') + 'dialogue/' + id + '.json';
        if (typeof fetch === 'function') {
            return fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
        }
        return Promise.resolve(null);
    }

    // ── condition evaluation ─────────────────────────────────────────────────
    // A condition: { type:'Stat'|'Skill'|'Clique'|'Item'|'Gender'|'Romance'|
    //                'Appearance', key, op, val }
    // Returns true if it passes (or can't be evaluated and we're not strict).
    function evalCondition(cond) {
        const pc = window.playerContext;
        const strict = !!window.__strictDialogueConds;
        if (!pc) return !strict;   // no character: pass unless strict
        const cmp = (a, b, op) => {
            a = parseFloat(a); b = parseFloat(b);
            if (isNaN(a) || isNaN(b)) return false;
            switch (op) {
                case '>=': return a >= b; case '<=': return a <= b;
                case '>': return a > b;   case '<': return a < b;
                case '==': case '=': return a === b;
                case '!=': return a !== b;
                default: return a >= b;
            }
        };
        switch (cond.type) {
            case 'Stat':
                if (pc.stats && typeof pc.stats[cond.key] === 'number') return cmp(pc.stats[cond.key], cond.val, cond.op);
                return !strict;
            case 'Skill':
                if (Array.isArray(pc.skills)) return pc.skills.map(s => String(s).toLowerCase()).includes(String(cond.key).toLowerCase());
                return !strict;
            case 'Hobby':
                if (Array.isArray(pc.hobbies)) return pc.hobbies.map(s => String(s).toLowerCase()).includes(String(cond.key).toLowerCase());
                return !strict;
            case 'Clique':
                if (Array.isArray(pc.cliques)) return pc.cliques.map(s => String(s).toLowerCase()).includes(String(cond.key).toLowerCase());
                if (pc.clique) return String(pc.clique).toLowerCase() === String(cond.key).toLowerCase();
                return !strict;
            case 'Item':
                if (Array.isArray(pc.items)) return pc.items.map(s => String(s).toLowerCase()).includes(String(cond.key).toLowerCase());
                return !strict;
            case 'Gender':
                if (pc.gender) return String(pc.gender).toLowerCase() === String(cond.key).toLowerCase();
                return !strict;
            case 'Orientation':
                if (pc.orientation) return String(pc.orientation).toLowerCase() === String(cond.key).toLowerCase();
                return !strict;
            case 'Romance':
                if (pc.romance && typeof pc.romance[cond.key] === 'number') return cmp(pc.romance[cond.key], cond.val, cond.op);
                return !strict;
            case 'Appearance':
                if (pc.appearance && pc.appearance[cond.key] !== undefined) return cmp(pc.appearance[cond.key], cond.val, cond.op);
                return !strict;
            default: return !strict;
        }
    }
    function condsPass(conditions) {
        if (!conditions || conditions.length === 0) return true;
        return conditions.every(evalCondition);
    }

    // ── skill-check roll ─────────────────────────────────────────────────────
    // checkData: { type:'Stat'|'Skill'|…, key, val }. Returns true on success.
    // Stat checks compare the player's stat (+ small d6-ish luck) vs the target
    // value; Skill/Item checks succeed if the player has it. No character →
    // 50/50 in preview so both branches are reachable for testing.
    function rollCheck(checkData) {
        const pc = window.playerContext;
        if (!pc) return Math.random() < 0.5;
        const target = parseFloat(checkData.val) || 0;
        if (checkData.type === 'Stat' && pc.stats && typeof pc.stats[checkData.key] === 'number') {
            const roll = Math.floor(Math.random() * 6) + 1;   // 1..6
            return (pc.stats[checkData.key] + roll) >= (target + 3);
        }
        if (checkData.type === 'Skill') return Array.isArray(pc.skills) && pc.skills.map(s => String(s).toLowerCase()).includes(String(checkData.key).toLowerCase());
        if (checkData.type === 'Item') return Array.isArray(pc.items) && pc.items.map(s => String(s).toLowerCase()).includes(String(checkData.key).toLowerCase());
        return Math.random() < 0.5;
    }

    // ── camera application ───────────────────────────────────────────────────
    // Maps a Saymaker line.camera object onto the engine's CameraManager.
    // Best-effort: base mode, iso facing, tilt, and static zoom are applied
    // directly; cinematic swoops use startCinematic; the looping pan/zoom
    // "dramatic effects" are acknowledged but not fully animated yet (logged
    // intent so the data round-trips and can be wired later).
    const ISO_DIR_ANGLE = { N: 0, NE: Math.PI / 4, E: Math.PI / 2, SE: 3 * Math.PI / 4, S: Math.PI, SW: 5 * Math.PI / 4, W: 3 * Math.PI / 2, NW: 7 * Math.PI / 4 };
    function applyCamera(cam, speaker) {
        const cm = ctx.camManager;
        if (!cm || !cam || cam.mode === 'keep') return;
        try {
            if (cam.mode === 'iso') {
                if (cam.isoDirType === 'absolute' && ISO_DIR_ANGLE[cam.isoDirAbsolute] !== undefined) {
                    cm.isoAngle = ISO_DIR_ANGLE[cam.isoDirAbsolute];
                } else if (cam.isoDirType === 'relative') {
                    const rad = (cam.isoDirRelative || 0) * Math.PI / 180;
                    cm.isoAngle += (cam.isoTurnDir === 'right' ? rad : -rad);
                }
                if (typeof cam.tiltOffset === 'number' && cam.tiltOffset !== 0) {
                    const base = Math.atan(1 / Math.sqrt(2));
                    cm.camPitch = Math.max(0.08, Math.min(1.45, base - (cam.tiltOffset * Math.PI / 180)));
                }
                if (typeof cam.zoomLevel === 'number') cm.tCamZoom = cam.zoomLevel;
            } else if (cam.mode === 'overhead') {
                cm.camPitch = 1.45;   // near top-down
                if (typeof cam.overheadSpin === 'number') cm.isoAngle = (cam.overheadSpin || 0) * Math.PI / 180;
                if (typeof cam.zoomLevel === 'number') cm.tCamZoom = cam.zoomLevel;
            } else if ((cam.mode === 'fps' || cam.mode === 'free') && speaker && speaker.mesh && cm.startCinematic) {
                cm.startCinematic(cam.mode, speaker.mesh.position, ctx.player ? ctx.player.position : speaker.mesh.position);
            }
            // Dramatic looping pan/zoom: not yet animated by the runtime. The
            // fields survive in the data; wiring them to an animation loop is a
            // follow-up. (Intentionally a no-op rather than a crash.)
        } catch (e) { /* never let a camera hiccup break the conversation */ }
    }

    // ── DOM overlay ──────────────────────────────────────────────────────────
    function ensureOverlay() {
        if (overlayEl) return overlayEl;
        overlayEl = document.createElement('div');
        overlayEl.id = 'dialogue-runtime';
        overlayEl.style.cssText = [
            'position:fixed', 'left:50%', 'bottom:5%', 'transform:translateX(-50%)',
            'width:80%', 'max-width:820px', 'z-index:60', 'display:none',
            'font-family:system-ui,sans-serif',
        ].join(';');
        // the win95 dialogue-tree look (gray bevel, blue title bar)
        // replaces the old glowing cyan box; text stays at the bigger 17px font.
        // Styles are inline so Saymaker dialogues look right in every shell.
        overlayEl.innerHTML = `
            <div id="dr-portrait" style="display:none;"></div>
            <div id="dr-box" style="background:#c0c0c0; color:#000; border:2px solid #dfdfdf; border-right-color:#404040; border-bottom-color:#404040; box-shadow:1px 1px 0 #000, 2px 2px 7px rgba(0,0,0,0.45); padding:0; font-family:'GrandeRetro','MS Sans Serif',Tahoma,sans-serif;">
                <div id="dr-name" style="display:none; background:linear-gradient(90deg,#000080,#1084d0); color:#fff; font-weight:bold; letter-spacing:.3px; padding:3px 7px; font-size:18px;"></div>
                <div style="padding:12px 14px;">
                <div id="dr-text" style="font-size:20px; line-height:1.3; min-height:26px; max-height:46vh; overflow-y:auto;"></div>
                <div id="dr-choices" style="display:flex; flex-direction:column; gap:6px; margin-top:12px;"></div>
                <div id="dr-cont" style="text-align:right; margin-top:10px; color:#404040; font-size:15px; cursor:pointer; user-select:none;">▶ continue (G)</div>
                </div>
            </div>`;
        document.body.appendChild(overlayEl);
        overlayEl.querySelector('#dr-cont').addEventListener('click', advance);
        return overlayEl;
    }

    // ── TYPEWRITER [#3] ───────────────────────────────────────────────────
    // Dialogue lines "type out" Earthbound-style with a per-NPC voice blip.
    // Speed + the silence/instant options come from State.settings.textSpeed /
    // .dialogueSound. Space mid-type reveals the rest of the line (see advance).
    const TEXT_SPEED_MS = { slow: 28, medium: 19, medfast: 12, fast: 6, instant: 0 }   // #1: 2x faster (halved);
    let _typeTimer = null, _typeUnits = null, _typeFull = 0, _typeN = 0, _typeDone = true, _typeSpeaker = null;
    let _ac = null;
    function _audioCtx() {
        if (_ac) return _ac;
        try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { _ac = null; }
        return _ac;
    }
    // a tiny consistent per-name pitch offset so different NPCs sound different.
    function _nameHash(s) { let h = 0; s = String(s || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
    function _playBlip(speaker) {
        const set = (window.State && State.settings) || {};
        if (set.dialogueSound === false || set.sounds === false) return;   // silenced / master SFX off
        const ac = _audioCtx(); if (!ac) return;
        if (ac.state === 'suspended' && ac.resume) { try { ac.resume(); } catch (e) {} }
        // femme "voice" sits higher; each NPC gets a small fixed offset by name.
        const g = String((speaker && speaker.gender) || '').toLowerCase();
        const femme = /f|femme|female|woman|girl/.test(g);
        const base = femme ? 420 : 250;
        const off = (_nameHash(speaker && speaker.name) % 70);
        const o = ac.createOscillator(), gain = ac.createGain();
        o.type = 'square';
        o.frequency.value = base + off + (Math.random() * 18 - 9);
        const t = ac.currentTime;
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
        o.connect(gain); gain.connect(ac.destination);
        o.start(t); o.stop(t + 0.05);
    }
    // Split HTML into ordered units (tags vs visible chars) so we can reveal N
    // characters while keeping markup valid (open tags get auto-closed mid-type).
    function _tokenizeHtml(html) {
        const units = []; let i = 0;
        while (i < html.length) {
            if (html[i] === '<') {
                const end = html.indexOf('>', i);
                if (end < 0) { units.push({ t: 'ch', s: html[i] }); i++; }
                else { units.push({ t: 'tag', s: html.slice(i, end + 1) }); i = end + 1; }
            } else if (html[i] === '&') {
                const end = html.indexOf(';', i);
                if (end > 0 && end - i <= 7) { units.push({ t: 'ch', s: html.slice(i, end + 1) }); i = end + 1; }
                else { units.push({ t: 'ch', s: html[i] }); i++; }
            } else { units.push({ t: 'ch', s: html[i] }); i++; }
        }
        return units;
    }
    function _countChars(units) { let n = 0; for (const u of units) if (u.t === 'ch') n++; return n; }
    function _htmlUpTo(units, n) {
        let out = '', c = 0; const open = [];
        for (const u of units) {
            if (u.t === 'tag') {
                out += u.s;
                const m = u.s.match(/^<(\/?)(\w+)/);
                if (m) { if (m[1]) open.pop(); else if (!/\/>\s*$/.test(u.s)) open.push(m[2]); }
            } else { if (c >= n) break; out += u.s; c++; }
        }
        for (let k = open.length - 1; k >= 0; k--) out += '</' + open[k] + '>';
        return out;
    }
    function _finishTyping() {
        if (_typeTimer) { clearInterval(_typeTimer); _typeTimer = null; }
        if (_typeUnits && overlayEl) { const el = overlayEl.querySelector('#dr-text'); if (el) el.innerHTML = _htmlUpTo(_typeUnits, _typeFull); }
        _typeDone = true;
    }
    function _startTyping(html, speaker) {
        if (_typeTimer) { clearInterval(_typeTimer); _typeTimer = null; }
        _typeUnits = _tokenizeHtml(html); _typeFull = _countChars(_typeUnits); _typeN = 0; _typeSpeaker = speaker;
        const el = overlayEl.querySelector('#dr-text');
        const set = (window.State && State.settings) || {};
        const ms = TEXT_SPEED_MS[set.textSpeed] != null ? TEXT_SPEED_MS[set.textSpeed] : TEXT_SPEED_MS.medfast;
        if (!ms) { _typeDone = true; if (el) el.innerHTML = _htmlUpTo(_typeUnits, _typeFull); return; }   // instant
        _typeDone = false; if (el) el.innerHTML = '';
        _typeTimer = setInterval(() => {
            _typeN++;
            if (el) el.innerHTML = _htmlUpTo(_typeUnits, _typeN);
            if (_typeN % 2 === 0) _playBlip(_typeSpeaker);     // ~1 blip per 2 chars
            if (_typeN >= _typeFull) _finishTyping();
        }, ms);
    }
    function _isTyping() { return !_typeDone; }
    // #10: expose the blip so the engine's generic one-liner dialogue can use the
    // same per-NPC voice. (gender, name) → a short square-wave beep.
    try { window.__npcBlip = (gender, name) => _playBlip({ gender: gender || '', name: name || '' }); } catch (e) {}

    // Render a single line: nameplate + portrait + BBCode-lite text.
    function renderLine(line, speaker) {
        ensureOverlay();
        overlayEl.style.display = 'block';
        const disp = line.display || {};
        // Nameplate
        const nameEl = overlayEl.querySelector('#dr-name');
        let nameText = disp.nameEnable ? (disp.nameText || (speaker && speaker.name) || '') : (line.speakerType === 'player' ? 'You' : (speaker && speaker.name) || '');
        nameText = dlgText(nameText, speaker);
        if (disp.nameEnable && disp.nameCaps) nameText = nameText.toUpperCase();
        if (nameText) { nameEl.style.display = 'block'; nameEl.textContent = nameText; nameEl.style.color = (disp.nameEnable && disp.nameColor) ? disp.nameColor : '#fff'; }   // title-bar text
        else nameEl.style.display = 'none';
        // Portrait
        const portEl = overlayEl.querySelector('#dr-portrait');
        if (disp.portraitEnable && (disp.portraitData || disp.portraitId)) {
            portEl.style.display = 'block';
            portEl.style.cssText = 'display:block; width:96px; height:96px; margin:0 auto 8px; border:2px solid #06b6d4; border-radius:8px; overflow:hidden; background:#000;';
            portEl.innerHTML = disp.portraitData ? `<img src="${disp.portraitData}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="color:#64748b;font-size:10px;display:flex;align-items:center;justify-content:center;height:100%;">${disp.portraitId}</div>`;
        } else portEl.style.display = 'none';
        // Text: resolve name/pronoun tokens against the player + speaker, THEN
        // apply BBCode-lite styling, THEN type it out [#3] (Space reveals all).
        const _html = bbcodeLite(dlgText(line.text || '', speaker));
        _startTyping(_html, speaker);
        overlayEl.querySelector('#dr-choices').innerHTML = '';
        overlayEl.querySelector('#dr-cont').style.display = 'block';
    }

    // Resolve [NAME]/[THEY]/… and {npc.*} tokens. The speaker is exposed as
    // BOTH 'npc' and 'speaker' actor keys so authored text can use either. Safe
    // no-op if the tokens module isn't present.
    function dlgText(text, speaker) {
        if (!window.GameTokens) return text;
        const actors = {};
        if (speaker && (speaker.name || speaker.gender)) { actors.npc = speaker; actors.speaker = speaker; }
        return window.GameTokens.resolve(text, { player: window.playerContext || {}, actors: actors });
    }

    // Minimal BBCode → HTML for [color], [shake]; strips unknown tags safely.
    function bbcodeLite(s) {
        const esc = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return esc
            .replace(/\[color=(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\]([\s\S]*?)\[\/color\]/g, '<span style="color:$1">$2</span>')
            .replace(/\[shake\]([\s\S]*?)\[\/shake\]/g, '<span style="display:inline-block;animation:dr-shake 0.3s infinite;">$1</span>')
            .replace(/\[font=[^\]]+\]([\s\S]*?)\[\/font\]/g, '$1')
            .replace(/\[(\/?)(b|i|u)\]/g, (m, slash, tag) => `<${slash}${tag}>`);
    }

    function renderChoices(node) {
        const box = overlayEl.querySelector('#dr-choices');
        overlayEl.querySelector('#dr-cont').style.display = 'none';
        box.innerHTML = '';
        const visible = node.choices.filter(c => condsPass(c.conditions));
        if (visible.length === 0) { endConversation(); return; }
        visible.forEach((choice, i) => {
            const btn = document.createElement('button');
            btn.textContent = (i + 1) + '. ' + dlgText(choice.text || '…', active && active.speaker) + (choice.isCheck ? `  [${choice.checkData.type}: ${choice.checkData.key} ${choice.checkData.val}]` : '');
            // choices as win95 buttons (inline so every shell matches).
            // #6: the choice (dialogue-TREE) text was 15px while the narration is
            // 30px — far too small. Bumped to 24px so the tree reads at a matching
            // scale. (Edit this font size to taste.)
            btn.style.cssText = 'text-align:left; background:#c0c0c0; color:#000; border:2px solid #dfdfdf; border-right-color:#404040; border-bottom-color:#404040; padding:8px 12px; font:24px "GrandeRetro","MS Sans Serif",Tahoma,sans-serif; cursor:pointer;';
            // hover = win95 "selected" look (navy + white); leave restores the gray
            // bevel. (The old hover went dark-on-black and was unreadable.)
            btn.onmouseenter = () => { btn.style.background = '#000080'; btn.style.color = '#fff'; };
            btn.onmouseleave = () => { btn.style.background = '#c0c0c0'; btn.style.color = '#000'; };
            btn.onclick = () => chooseChoice(choice);
            box.appendChild(btn);
        });
    }

    // ── play session ─────────────────────────────────────────────────────────
    function start(id, speaker) {
        if (active) return;          // one conversation at a time
        loadDialogue(id).then(conv => {
            if (!conv || !conv.nodes) {
                if (ctx.showError) ctx.showError('Dialogue not found: ' + id);
                return;
            }
            // Entry node = the one no outcome targets (a root), else first.
            const nodeList = Object.values(conv.nodes);
            if (nodeList.length === 0) return;
            const targeted = new Set();
            nodeList.forEach(n => n.choices.forEach(c => c.outcomes.forEach(o => { if (o.targetNode) targeted.add(o.targetNode); })));
            const entry = nodeList.find(n => !targeted.has(n.id)) || nodeList[0];
            active = { conv, speaker: speaker || {}, node: null, lineIdx: 0 };
            // pause the world while this conversation runs unless it opts out
            // (Saymaker's "Pause world during dialogue", default ON). The engine
            // reads window.__worldPaused.
            window.__worldPaused = (conv && conv.pauseWorld === false) ? false : true;
            enterNode(entry.id);
        });
    }

    function enterNode(nodeId) {
        if (!active) return;
        const node = active.conv.nodes[nodeId];
        if (!node) { endConversation(); return; }
        active.node = node;
        active.lineIdx = 0;
        playCurrentLine();
    }

    // Show the current line (skipping condition-failed lines); when lines run
    // out, show the node's choices.
    function playCurrentLine() {
        const node = active.node;
        while (active.lineIdx < node.lines.length && !condsPass(node.lines[active.lineIdx].conditions)) {
            active.lineIdx++;
        }
        if (active.lineIdx >= node.lines.length) { renderChoices(node); return; }
        const line = node.lines[active.lineIdx];
        applyCamera(line.camera, active.speaker);
        renderLine(line, active.speaker);
    }

    // Space / clicking "continue" advances to the next line (or to choices).
    function advance() {
        if (!active) return;
        // If choices are showing, Space does nothing (must pick).
        if (overlayEl.querySelector('#dr-choices').children.length > 0) return;
        // #3: if the line is still typing, the FIRST Space reveals it all
        // (skip the type-out + blips) rather than advancing past unread text.
        if (_isTyping()) { _finishTyping(); return; }
        active.lineIdx++;
        playCurrentLine();
    }

    function chooseChoice(choice) {
        if (!active) return;
        let outcome;
        if (choice.isCheck) {
            const success = rollCheck(choice.checkData);
            // Prefer an outcome whose type matches success/failure AND whose
            // own conditions pass; fall back to the first matching type.
            const wanted = success ? 'success' : 'failure';
            outcome = choice.outcomes.find(o => o.type === wanted && condsPass(o.conditions))
                   || choice.outcomes.find(o => o.type === wanted)
                   || choice.outcomes[0];
        } else {
            outcome = choice.outcomes.find(o => condsPass(o.conditions)) || choice.outcomes[0];
        }
        if (outcome && outcome.targetNode && active.conv.nodes[outcome.targetNode]) {
            enterNode(outcome.targetNode);
        } else {
            endConversation();
        }
    }

    function endConversation() {
        active = null;
        if (_typeTimer) { clearInterval(_typeTimer); _typeTimer = null; }   // #3: stop any in-progress type-out
        _typeDone = true;
        window.__worldPaused = false;   // resume the world
        if (overlayEl) overlayEl.style.display = 'none';
        if (ctx.camManager && ctx.camManager.stopCinematic) ctx.camManager.stopCinematic();
    }

    function isActive() { return !!active; }

    // Inject the shake keyframes once.
    function injectStyles() {
        if (document.getElementById('dr-styles')) return;
        const st = document.createElement('style');
        st.id = 'dr-styles';
        st.textContent = '@keyframes dr-shake{0%,100%{transform:translate(0,0)}25%{transform:translate(-1px,1px)}50%{transform:translate(1px,-1px)}75%{transform:translate(-1px,-1px)}}';
        document.head.appendChild(st);
    }
    injectStyles();

    window.DialogueRuntime = { init, start, advance, isActive, endConversation };
})();
