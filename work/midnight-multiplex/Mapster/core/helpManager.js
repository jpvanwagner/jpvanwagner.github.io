/**
 * Mapster - Help & Tooltip Manager
 * Handles all dynamic documentation, UI text, and modal rendering.
 */

const HelpData = {
    // Tooltip dictionary mapping keys to their specific descriptive text
    tooltips: {
        camMode: "Determines how the player can rotate the camera in-game.\n\n- Isometric (45°/90°): Standard Q/E rotation snaps.\n- Locked: Disables rotation.\n- Free: Smooth rotation.\n- FPS: Locks camera to player perspective.\n- FPS (Toggleable): Press V in-game to switch perspectives.",
        zoomOptions: "Locked: Fixed distance.\nIncremental: Steps in and out.\nFree: Smooth mousewheel zooming.",
        allowedAngles: "Uncheck these boxes to restrict the player from rotating the camera to face certain cardinal directions.",
        audioSelection: "You can paste a direct URL to an audio file, or click the file folder icon to select a local file from your computer (it will be embedded directly into your map data!).\n\nBrowsers restrict autoplay, so audio will begin playing upon the user's first interaction with the game.",
        edgeBehavior: "Determines what happens if the player tries to walk off the edge of the map.\n\nBlock: The player hits an invisible wall.\nWarp: The player is immediately warped to the specified URL or Coordinates.",
        voidWalking: "If unchecked, players who step onto a tile without a floor will be prompted with gap/physics options (Jump Across, Fall Down, etc).\n\nIf checked, the gap logic is entirely bypassed and players treat empty space like solid ground.",
        interactionText: "Global setting for where interaction text (Dialogue, Inspect lines) renders.\n\nBottom Dialog Box: Classic RPG static box at the bottom of the screen.\nOverhead: Text floats directly above the object in 3D space.",
        environmentalFog: "Fills the entire floor with dense volumetric fog, obscuring vision past a few tiles. If enabled, this overrides the default Engine Skybox for this floor.",
        solid: "Prevents players and NPCs from walking through this tile/edge.",
        jumpable: "Allows the player to leap over this object using the Shift key while moving.",
        warpZone: "Teleports the player to a specified map or coordinate when walked into.",
        cameraSwoop: "Changes the camera behavior temporarily when interacting with this NPC or object.",
        wallAttachments: "Add objects like posters, switches, and mirrors directly onto this wall surface. Use Offset (L/R) to slide them along the wall, and Offset (Up/Dn) to adjust height.",
        advancedFlickering: "Control how this light animates. Normal creates a random sputter, Strobe cycles through colors, and Crossfade blends them smoothly.",
        localFog: "Emits a localized cloud of fog around this object. Great for steam, smoke, or glowing auras.",
        msPaintCanvas: "Draw directly onto this glass surface. 'Players can draw' makes it editable in-game (per-window, off by default). 'Canvas Width' (1-4) spans the decal across that many ADJACENT windows; the drawable canvas widens to match. Paint with the primary/accent colors.",
        // ── newer features ──
        neonTopMount: "Sticks this neon out from the TOP of the wall, standing it up and turning it to run along the wall so it faces BOTH sides (like a rooftop sign) instead of lying flush facing the player. Off by default. (Neon also emits light.)",
        timedText: "By default an interaction-text box waits for the player to press SPACE. Toggle this to auto-dismiss after a time limit (default 5 seconds, adjustable). Optionally show a draining countdown bar.",
        minimapCorner: "Which screen corner the in-game minimap overlay sits in (top/bottom × left/right).",
        disableLocations: "Hides location/zone names map-wide in the directory, for maps where you don't want named areas.",
        zonePaint: "Paint colored ZONES onto tiles (a named area like 'Lobby' or 'Theater'). Pick the active zone in the Zones panel; add/rename/recolor zones there. A map-wide setting (Settings) chooses whether zones show on the minimap, in the directory, or both.",
        fogPaint: "Paint a FOG-OF-WAR layer onto tiles. A map-wide setting (Settings) chooses whether fog obscures the minimap, directory, or both, and whether fogged areas are permanently hidden or 'discoverable' (revealed after the player first visits them).",
        flashlightMinimap: "Optionally hide the whole minimap unless the player's flashlight is on — then reveal either a RADIUS around the player or a CONE in front of them, sized by the reveal-size setting. Already-visited tiles stay visible.",
        zoneFogOverlay: "Editor-only toggle: show your painted zone tints and fog hatching on the grid while editing. Doesn't affect the exported game."
    },
    // The main documentation that populates the ? Help Guide menu
    guideSections: [
        {
            title: "Editor Basics",
            items: [
                "<b>Placing Items:</b> Select a tool from the left palette. Click on the grid to place. You can <b>click and hold</b> to drag-paint lines of walls or large swaths of floors.",
                "<b>Quick Deselect:</b> Right-click anywhere on the grid, or click the empty space outside the grid, to drop your current tool and return to the <span class=\"text-cyan-400 font-bold\">Select/Edit</span> tool.",
                "<b>Inspecting Objects:</b> With the <span class=\"text-cyan-400 font-bold\">Select/Edit</span> tool equipped, click on any placed object, wall, or floor to view and edit its deep properties in the Right Sidebar.",
                "<b>Zooming:</b> Use the + and - buttons in the top header, or hold `Ctrl/Shift` and use your mouse scroll wheel to zoom the editor canvas in and out."
            ]
        },
        {
            title: "Colors & Textures",
            items: [
                "The <b>Base Color</b> determines the primary tint of the object/floor you are placing.",
                "The <b>Accent Color</b> (if toggled on) provides a secondary color used for generating patterns, like the mortar on a brick wall or the secondary squares on a checkerboard tile.",
                "<b>Color Dropper:</b> Use the Dropper tool (💧) and click on an existing object to immediately copy its Base and Accent colors back into your palette.",
                "<b>Clone Tool:</b> Use the Clone tool (📑) to perfectly duplicate an object, including all of its Inspector settings (like fog, lights, and wall attachments)."
            ]
        },
        {
            title: "Advanced Wall Tools",
            items: [
                "<b>Straight Walls:</b> Equip a wall tool and click near the North, South, East, or West edge of a tile.",
                "<b>Diagonal Walls:</b> Equip any Wall tool and hover over the center of a tile. Two diagonal hitboxes ( / and \\ ) will appear. Click one to paint a diagonal wall. <i>These hitboxes safely vanish when you have non-wall tools selected.</i>",
                "<b>Window Inserts vs Full Glass:</b> A `Window Insert` places a solid wall with a pane of glass in the middle. A `Full Glass Wall` places a single pane from floor to ceiling.",
                "<b>Wall Attachments:</b> Using tools like Sconces, Urinals, or Mirrors, click directly onto an already-placed wall edge. The object will attach itself to that wall, and you can tweak its offset positioning in the Inspector."
            ]
        },
        {
            title: "In-Game Engine Controls",
            items: [
                "<b>WASD / Arrows:</b> Move one grid tile at a time. The controls automatically adapt based on your camera rotation.",
                "<b>Shift:</b> Hold Shift while pressing a movement key to Vault/Jump over a gap or a jumpable object (like a counter).",
                "<b>Spacebar:</b> Interact with the object/NPC in front of you, AND advance/dismiss interaction text (Enter does not).",
                "<b>Q / E:</b> Rotate the camera 45 or 90 degrees (configurable in Global Settings).",
                "<b>T:</b> Toggle the Upward Camera Tilt to see further ahead. Repeated presses cycle the tilt: 0° -> 15° -> 30° -> 0°.",
                "<b>V:</b> Instantly toggle between First-Person and Third-Person view (if enabled in settings).",
                "<b>F:</b> Toggle the player's personal flashlight.",
                "<b>M / C:</b> Toggle the on-screen Minimap and Compass overlays."
            ]
        },
        {
            title: "Lighting & Neon",
            items: [
                "<b>Light sources:</b> Ceiling Lights, Uplights, Sconces, and ALL neon (Stripes & Text) cast colored light onto nearby surfaces.",
                "<b>Neon Top-Mount:</b> On any neon attachment, toggle <i>'Stick out from wall top'</i> to stand the neon above the wall and face it both ways, like a rooftop sign, instead of flush against the wall.",
                "<b>Flicker / Strobe:</b> Lights can sputter randomly, strobe through colors, or crossfade — set per-light in the Inspector.",
                "<b>No switch on glass:</b> Wall switches can't be placed on glass/windows (there's nothing solid to mount them on)."
            ]
        },
        {
            title: "Windows & Glass",
            items: [
                "<b>Draw on glass:</b> Each window has its own <i>'Players can draw on this window'</i> toggle (off by default) — it's no longer a single map-wide switch.",
                "<b>Multi-window murals:</b> Set <i>Canvas Width</i> (1-4) to stretch one drawing across that many adjacent windows; the in-game drawing canvas widens to match.",
                "<b>Breakable glass:</b> Mark a window breakable and set a Break Requirement (stat, skill, or hobby) the player must meet to shatter it."
            ]
        },
        {
            title: "Interaction Text",
            items: [
                "<b>Default:</b> an interaction-text box stays until the player presses <b>Space</b>.",
                "<b>Timed:</b> toggle <i>'Auto-dismiss after a time limit'</i> to make it disappear on its own (default 5 seconds, adjustable).",
                "<b>Countdown bar:</b> with timed text on, optionally show a draining bar so the player sees how long is left.",
                "<b>Branching dialogue:</b> attach a Saymaker file to an NPC/object for full conversations with choices, checks, and camera moves (see the Dialogue section)."
            ]
        },
        {
            title: "Zones, Fog & Minimap",
            items: [
                "<b>Paint Zones:</b> use the Zones & Fog tools to paint named, colored areas (e.g. 'Lobby'). Manage the palette in the Zones panel (add/rename/recolor). A Settings option shows them on the minimap, in the directory, or both.",
                "<b>Fog of War:</b> paint a fog layer to obscure areas. In Settings, choose whether it hides the minimap/directory/both, and whether fog is permanent or 'discoverable' (revealed after the player visits).",
                "<b>Flashlight Minimap:</b> optionally hide the minimap unless the flashlight is on, then reveal a radius around the player or a cone in front (Settings).",
                "<b>Minimap Corner:</b> choose which corner the in-game minimap sits in (Settings).",
                "<b>Editor overlays:</b> the 'Show Zone/Fog Overlays' toggle draws your painted zones/fog on the grid while editing only."
            ]
        },
        {
            title: "Dialogue (Saymaker → Mapster)",
            items: [
                "<b>Attach a conversation:</b> select an NPC or object, open <i>Branching Dialogue (Saymaker)</i>, click Import… to load a Saymaker .json export, then pick it from the dropdown.",
                "<b>It just works offline:</b> the dialogue is baked into your exported map, so conversations play even when the file is opened directly from disk.",
                "<b>Conditions gate options:</b> choices that require a stat/skill/hobby/clique/gender/orientation the player lacks are simply hidden — so the same conversation adapts to each character.",
                "<b>Tokens:</b> dialogue can use [NAME] and pronoun tokens ([THEY]/[THEM]/...) plus {npc.name}/{npc.they} for whoever is referred to."
            ]
        }
    ]
};

// Opens the specific Tooltip Modal
function showEditorHelp(title, textKey) {
    const text = HelpData.tooltips[textKey] || textKey;
    document.getElementById('eh-title').innerText = title;
    document.getElementById('eh-text').innerText = text;
    document.getElementById('editorHelpModal').classList.remove('hidden');
}

// Generates the HTML for the little blue 'i' icon buttons
function helpIcon(title, textKey) {
    return ` <span onclick="showEditorHelp('${title}', '${textKey}')" title="Click for detailed info" class="cursor-pointer inline-block w-4 h-4 rounded-full bg-cyan-900 border border-cyan-500 text-cyan-400 text-[10px] text-center leading-[14px] font-bold shadow hover:bg-cyan-700 transition-colors ml-1">i</span>`;
}

// Programmatically populates the main Help Guide, with a section INDEX and a
// live SEARCH filter. `query` (optional) filters items/sections by keyword.
function populateHelpGuide(query) {
    const container = document.getElementById('help-guide-content');
    if (!container) return;
    const q = (query || '').trim().toLowerCase();
    container.innerHTML = '';

    // Strip HTML tags for matching so a search on "neon" hits even inside <b>.
    const plain = (s) => s.replace(/<[^>]+>/g, '').toLowerCase();

    // Build the filtered model first (so the index only lists matching sections).
    const sections = HelpData.guideSections.map(sec => {
        const titleHit = sec.title.toLowerCase().includes(q);
        const items = q ? sec.items.filter(it => titleHit || plain(it).includes(q)) : sec.items;
        return { title: sec.title, items, show: !q || titleHit || items.length > 0 };
    }).filter(s => s.show);

    // Also surface matching TOOLTIPS when searching (they're the per-control help).
    let tipMatches = [];
    if (q) {
        tipMatches = Object.keys(HelpData.tooltips)
            .filter(k => k.toLowerCase().includes(q) || HelpData.tooltips[k].toLowerCase().includes(q))
            .map(k => ({ k, text: HelpData.tooltips[k] }));
    }

    if (sections.length === 0 && tipMatches.length === 0) {
        container.innerHTML = `<p class="text-gray-500 italic">No help entries match "${query}".</p>`;
        return;
    }

    // INDEX (jump links) — only when not searching, or when several sections match.
    if (sections.length > 1) {
        const idx = document.createElement('nav');
        idx.className = 'mb-4 p-2 bg-gray-900 border border-gray-700 rounded';
        idx.innerHTML = `<div class="text-[11px] uppercase text-gray-500 font-bold mb-1">Index</div>` +
            sections.map((s, i) => `<a href="#" onclick="document.getElementById('help-sec-${i}').scrollIntoView({behavior:'smooth'});return false;" class="inline-block text-cyan-400 hover:text-cyan-200 text-xs mr-3 mb-1">${s.title}</a>`).join('');
        container.appendChild(idx);
    }

    sections.forEach((section, i) => {
        const secEl = document.createElement('section');
        secEl.id = 'help-sec-' + i;
        secEl.className = 'mb-4';
        let html = `<h3 class="text-lg font-bold text-white mb-2">${section.title}</h3><ul class="list-disc pl-5 space-y-1">`;
        section.items.forEach(item => { html += `<li>${item}</li>`; });
        html += `</ul>`;
        secEl.innerHTML = html;
        container.appendChild(secEl);
    });

    if (tipMatches.length) {
        const tipEl = document.createElement('section');
        tipEl.className = 'mt-4 pt-3 border-t border-gray-700';
        tipEl.innerHTML = `<h3 class="text-lg font-bold text-white mb-2">Matching Tooltips</h3>` +
            tipMatches.map(t => `<div class="mb-2"><span class="text-cyan-400 font-bold text-xs uppercase">${t.k}</span><p class="text-sm whitespace-pre-line">${t.text}</p></div>`).join('');
        container.appendChild(tipEl);
    }
}

// Wired to the help search box (added in the modal). Debounce-free; the guide
// is small enough to re-render on each keystroke.
function filterHelpGuide(value) { populateHelpGuide(value); }

// Global Export bindings
if (typeof window !== 'undefined') {
    window.HelpData = HelpData;
    window.showEditorHelp = showEditorHelp;
    window.helpIcon = helpIcon;
    window.populateHelpGuide = populateHelpGuide;
    window.filterHelpGuide = filterHelpGuide;
}