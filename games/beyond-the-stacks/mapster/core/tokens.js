/* ============================================================================
 *  MIDNIGHT AT THE MULTIPLEX — TEXT TOKENS  (core/tokens.js)
 * ============================================================================
 *
 *  A tiny shared templating system so authored text — dialogue lines, choices,
 *  nameplates, event copy, anywhere — can drop in the player's name and the
 *  correct pronouns for whoever is being referred to, resolved live at runtime.
 *
 *  Used identically by the game, the dialogue runtime, and the tools, so a line
 *  written in Saymaker reads the same way in-game.
 *
 *  ──────────────────────────────────────────────────────────────────────────
 *  TWO TOKEN FAMILIES
 *
 *  1) PLAYER tokens — SQUARE brackets. The most common case: text about the
 *     person playing. Casing of the token controls casing of the output.
 *        [NAME] / [CHARNAME]   → player's name (e.g. "Sam")
 *        [THEY]  [They]  [they] → subject pronoun  (they / she / he)
 *        [THEM]  [Them]  [them] → object pronoun   (them / her / him)
 *        [THEIR] [Their] [their]→ possessive det.  (their / her / his)
 *        [THEIRS][Theirs][theirs]→ possessive pron.(theirs / hers / his)
 *        [THEYRE][Theyre][theyre]→ contraction      (they're / she's / he's)
 *        [ARE]   [are]          → verb agreement    (are / is)  e.g. "[They] [are] here"
 *
 *  2) NAMED-ACTOR tokens — CURLY braces, dotted: {actor.field}. For referring
 *     to a specific character the text passes in (the speaker, a romance
 *     interest, an NPC). The actor name is whatever key the caller provides in
 *     ctx.actors (commonly "npc", "speaker", "target").
 *        {npc.name}            → that actor's name
 *        {npc.they} {npc.Them} {npc.their} {npc.theirs} {npc.theyre} {npc.are}
 *                              → that actor's pronouns (same casing rule)
 *
 *  Casing rule (per design): the TOKEN's own casing decides the output —
 *     [they] → "they",  [They] → "They",  [THEY] → "THEY".
 *  A field written in ALL CAPS yields UPPER; Capitalized yields Capitalized;
 *  lowercase yields lowercase. (For {actor.x}, the part after the dot carries
 *  the casing: {npc.They}, {npc.THEY}, {npc.they}.)
 *
 *  ──────────────────────────────────────────────────────────────────────────
 *  CONTEXT SHAPE passed to resolve(text, ctx):
 *     {
 *       player: { name, gender, customGender },   // usually window.playerContext
 *       actors: { npc: { name, gender }, ... },    // any named characters
 *     }
 *  A gender is a key from GameData.GENDERS ('male'|'female'|'nonbinary'|…);
 *  pronouns are looked up there. Unknown/blank gender falls back to they/them.
 *
 *  UNRESOLVED tokens: left untouched by default (so a typo is visible in
 *  authoring), unless ctx.stripUnknown is true (then removed). This pairs with
 *  the tools, which can warn on unknown tokens at author time.
 * ========================================================================== */
(function () {
    'use strict';

    // Fallback pronoun set if a gender has none / is unknown.
    const DEFAULT_PRONOUNS = { subj: 'they', obj: 'them', poss: 'their', possPron: 'theirs', plural: true };

    // Resolve a gender key → a full pronoun bundle. Pulls subj/obj/poss from
    // GameData.GENDERS (which stores { subj, obj, poss }); derives the
    // possessive-pronoun ("theirs"/"hers"/"his") and verb plurality here.
    function pronounsFor(genderKey) {
        const MD = window.GameData;
        let base = null;
        if (MD && MD.gendersByKey && genderKey && MD.gendersByKey[genderKey]) {
            base = MD.gendersByKey[genderKey].pronouns || null;
        }
        if (!base) return DEFAULT_PRONOUNS;
        const subj = base.subj || 'they';
        // "they" takes plural verb agreement ("they are"); others singular.
        const plural = (subj.toLowerCase() === 'they');
        // Possessive pronoun: she→hers, he→his, they→theirs. Derive from poss.
        let possPron;
        const poss = base.poss || 'their';
        if (poss === 'her') possPron = 'hers';
        else if (poss === 'his') possPron = 'his';
        else if (poss === 'their') possPron = 'theirs';
        else possPron = poss + 's';   // generic fallback
        return { subj: subj, obj: base.obj || 'them', poss: poss, possPron: possPron, plural: plural };
    }

    // Apply the casing of `token` to `value`.
    //   ALL CAPS token  → UPPER value
    //   Capitalized token → Capitalize value (first letter)
    //   lowercase token → value as-is
    function matchCase(token, value) {
        if (!value) return value;
        if (token === token.toUpperCase() && token !== token.toLowerCase()) return value.toUpperCase();
        if (token[0] === token[0].toUpperCase() && token.slice(1) === token.slice(1).toLowerCase()) {
            return value.charAt(0).toUpperCase() + value.slice(1);
        }
        return value;
    }

    // Map a pronoun field-name (any casing) → the value from a pronoun bundle.
    // Returns null if the field isn't a recognized pronoun token.
    function pronounField(fieldRaw, pr) {
        const f = fieldRaw.toLowerCase();
        switch (f) {
            case 'they':   return pr.subj;
            case 'them':   return pr.obj;
            case 'their':  return pr.poss;
            case 'theirs': return pr.possPron;
            case 'theyre': return pr.plural ? (pr.subj + "'re") : (pr.subj + "'s");  // they're / she's / he's
            case 'are':    return pr.plural ? 'are' : 'is';
            default:       return null;
        }
    }

    // Resolve a player's display name. Honors the custom-gender style 'other'
    // (name is separate from gender, so this is just the name field).
    function playerName(player) {
        return (player && player.name) ? player.name : '';
    }

    // ── main entry ────────────────────────────────────────────────────────────
    function resolve(text, ctx) {
        if (text == null) return text;
        ctx = ctx || {};
        const player = ctx.player || window.playerContext || {};
        const actors = ctx.actors || {};
        const stripUnknown = !!ctx.stripUnknown;
        const playerPr = pronounsFor(player.gender);

        let out = String(text);

        // 1) PLAYER square-bracket tokens: [NAME], [CHARNAME], and pronouns.
        out = out.replace(/\[([A-Za-z']+)\]/g, (m, tok) => {
            const low = tok.toLowerCase();
            // Name is returned exactly as stored — a name has its own casing, so
            // [NAME], [Name], [name] all yield the name unchanged. (Only pronoun
            // tokens use the casing-matching rule.)
            if (low === 'name' || low === 'charname') {
                return playerName(player) || m;
            }
            const pv = pronounField(tok, playerPr);
            if (pv != null) return matchCase(tok, pv);
            return stripUnknown ? '' : m;   // leave unknown tokens visible
        });

        // 2) NAMED-ACTOR curly tokens: {actor.field}
        out = out.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z']+)\}/g, (m, actorKey, field) => {
            const actor = actors[actorKey];
            if (!actor) return stripUnknown ? '' : m;
            const low = field.toLowerCase();
            if (low === 'name') return (actor.name || '') || m;
            const apr = pronounsFor(actor.gender);
            const pv = pronounField(field, apr);
            if (pv != null) return matchCase(field, pv);
            return stripUnknown ? '' : m;
        });

        return out;
    }

    // List the tokens present in a string (for tools to warn on unknowns).
    // Returns { player:[...], actors:[{actor,field}...], unknown:[...] }.
    function scan(text) {
        const res = { player: [], actors: [], unknown: [] };
        if (text == null) return res;
        const knownPlayer = new Set(['name','charname','they','them','their','theirs','theyre','are']);
        String(text).replace(/\[([A-Za-z']+)\]/g, (m, tok) => {
            if (knownPlayer.has(tok.toLowerCase())) res.player.push(tok);
            else res.unknown.push(m);
            return m;
        });
        String(text).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z']+)\}/g, (m, a, f) => {
            const knownField = new Set(['name','they','them','their','theirs','theyre','are']);
            if (knownField.has(f.toLowerCase())) res.actors.push({ actor: a, field: f });
            else res.unknown.push(m);
            return m;
        });
        return res;
    }

    // The canonical token reference, for tool palettes / help text.
    const REFERENCE = {
        player: [
            { token: '[NAME]',   desc: "The player's name" },
            { token: '[THEY]',   desc: 'Subject pronoun (they/she/he)' },
            { token: '[THEM]',   desc: 'Object pronoun (them/her/him)' },
            { token: '[THEIR]',  desc: 'Possessive determiner (their/her/his)' },
            { token: '[THEIRS]', desc: 'Possessive pronoun (theirs/hers/his)' },
            { token: '[THEYRE]', desc: "Contraction (they're/she's/he's)" },
            { token: '[ARE]',    desc: 'Verb agreement (are/is)' },
        ],
        actor: [
            { token: '{npc.name}',   desc: "A referenced character's name" },
            { token: '{npc.they}',   desc: 'Their subject pronoun' },
            { token: '{npc.them}',   desc: 'Their object pronoun' },
            { token: '{npc.their}',  desc: 'Their possessive determiner' },
            { token: '{npc.theirs}', desc: 'Their possessive pronoun' },
            { token: '{npc.theyre}', desc: "Their contraction" },
        ],
        note: 'Casing of the token controls output casing: [they]/[They]/[THEY]. Replace "npc" with whichever character the text refers to.',
    };

    window.GameTokens = { resolve, scan, pronounsFor, REFERENCE };
})();
