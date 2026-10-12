'use strict';
/* ============================== SAFETY NOTES ==============================
   OSHA doesn't cover a tenant's home, but it does cover the maintenance tech who walks into a vacant unit to fix
   it up: that unit is their workplace. So some of the apartment's close-ups carry a safety note, told from the
   tech's side, under the close-up's Safety button (js/inspect.js). The citations in them link to the Field Safety
   Handbook (js/osha-book.js). Any site's feature can carry one the same way: `osha: 'text'`. */
const OSHA_NOTES = {
  fan: "Before anyone works on a ceiling fan: a real stepladder, never the top step (1910.23), and the breaker off, locked, and tested dead (1910.333(b)(2)). In a building this old, nobody drills the popcorn ceiling until the owner's asbestos survey says it's clear.",
  smoke: "OSHA doesn't require this smoke alarm (the fire and housing codes do). OSHA does cover the ladder whoever replaces it stands on (1910.23), and the breaker for a hardwired one (1910.333(b)(2)).",
  outlet: 'Testing a GFCI is an electrical-code item. Replacing one means breaker off, locked and tagged, and tested dead first (1910.333(b)(2)). A turnover crew running tools off extension cords needs GFCI protection on them too.',
  stove: "OSHA has no rule for a home's gas range, but staff should know the plan (1910.38): if you smell gas, don't flip a switch or use a phone inside. Get out, then call the gas company from outside.",
  vent: "There's no OSHA mold standard, only guidance: fix the moisture first (a dead vent fan is a classic cause), then clean. A small patch is a gloves, goggles, and N95 job for trained maintenance staff.",
  sink: "The maintenance crew's drain opener and degreaser fall under hazard communication: labeled containers, a Safety Data Sheet for each, and training (1910.1200). The tenant's leftover cleaners don't.",
  dome: "Wall switch off isn't the same as dead: flip the breaker, tag it, and test before reaching for a cracked globe, with gloves on (1910.333(b)(2); 1910.138).",
  mirror: 'Same rule as any light fixture: the breaker gets locked off and the wires tested dead before anyone opens it up (1910.333(b)(2)).',
  tub: "Recaulk and dry it out, and never mix bleach with another cleaner: that's how a little bathroom fills with toxic gas. Whatever the tech brings to clean it falls under hazard communication (1910.1200).",
  thermostat: "Thermostat wire is low voltage, but the furnace behind it isn't: the HVAC tech shuts the furnace off and locks it out before opening it up (1910.147).",
  kfloor: "A lifted tile edge trips the cleaning crew just as well as a new tenant: walking surfaces get fixed or guarded before anyone works there (1910.22(a)(3))."
};
for (const [id, note] of Object.entries(OSHA_NOTES)) if (FEATURE[id]) FEATURE[id].osha = note;
