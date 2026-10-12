'use strict';
/* ============================== FIELD SAFETY HANDBOOK ==============================
   The second book in the binder (tabs switch between the site's SOP and this): OSHA's rules in plain language,
   one chapter per topic, each tagged with the kinds of site it matters at. Written from public-domain OSHA
   material (the General Industry Digest, OSHA 2201; the Construction Industry Digest, OSHA 2202; the Small Business
   Handbook, OSHA 2209) and the regulations themselves (29 CFR 1903, 1904, 1910, and 1926). It isn't an official
   OSHA publication, and the real text on eCFR wins over anything here.
   Any citation the game shows (a field note, a verdict, a report line: "1910.37(a)(3)") links to its chapter. */
const OSHA_SITES = { R: 'Apartments', O: 'Offices', I: 'Industrial', C: 'Construction' };
const OSHA_CHAPTERS = [
  { id: 'basics', title: 'Who OSHA Protects', sub: "(and who it doesn't)", cites: 'OSH Act 5(a)(1), 11(c); 1903.2; 1904.32, 1904.39', sites: 'ROIC', rules: [
    "OSHA covers employers and their workers. It doesn't cover tenants in their own homes, and it isn't the fire code or the building code.",
    'No specific rule for a hazard? The General Duty Clause still requires a workplace free from recognized hazards likely to cause death or serious harm.',
    "Every workplace posts the \"Job Safety and Health: It's the Law\" poster where workers can see it (1903.2).",
    'A work-related death is reported to OSHA within 8 hours; a hospitalization, amputation, or lost eye within 24 hours (1904.39).',
    'Workers can raise safety concerns without being punished for it (OSH Act 11(c)).',
    "Our job isn't OSHA's: we look, write it up, require a correction under the lease or contract, and for imminent danger we clear the area and call it in. OSHA's line is 1-800-321-OSHA."] },
  { id: 'ppe', title: 'Gear Up', sub: 'Personal protective equipment', cites: '1910.132 to 1910.138; 1910.95; 1926.95 to 1926.102', sites: 'RIC', rules: [
    'The employer looks at the job first (a written hazard assessment, 1910.132(d)) and picks gear that matches the hazard. The employer pays for it (1910.132(h)).',
    "PPE has to fit, and damaged gear can't be used (1910.132(e); 1926.95(c)).",
    'Head: a hard hat where things can fall or you can bump into live wires (1910.135; 1926.100). Eyes: Z87-rated safety glasses (1910.133; 1926.102). Feet: safety-toe boots where things can drop, roll, or puncture (1910.136; 1926.96).',
    'Hearing: protection available at 85 dBA averaged over 8 hours; the legal limit is 90 (1910.95). If you have to raise your voice to talk to someone 3 feet away, it is probably 85 or louder.',
    'Hi-vis vests: required for flaggers and for workers near traffic (1926.201; 1926.651(d)), and most sites require them by site rule.',
    "That includes you. An inspector who walks a jobsite without a hard hat has no business writing anyone else up for theirs."] },
  { id: 'walking', title: 'Keep It Clean, Keep It Dry', sub: 'Walking and working surfaces', cites: '1910.22; 1910.28(b)(3), (b)(11); 1926.25; 1926.701(b)', sites: 'ROIC', rules: [
    'Floors, aisles, and storerooms are kept clean, orderly, and as dry as practical (1910.22(a)).',
    'No tripping hazards: loose boards, sticking-out objects, leaks, spills, snow, and ice get fixed or guarded (1910.22(a)(3)).',
    'Surfaces are inspected regularly, and hazards are fixed or guarded before anyone uses the area (1910.22(d)).',
    'Floor holes get a cover or a guardrail; stairs with 4 or more risers get handrails (1910.28(b)(3), (b)(11)).',
    'Jobsite: scrap with nails sticking out stays out of work areas and walkways (1926.25(a)), and sticking-up rebar is capped (1926.701(b)).'] },
  { id: 'falls', title: 'Falls: The Big One', sub: 'Fall protection', cites: '1910.28, 1910.29; 1926.500 to 1926.503', sites: 'RIC', rules: [
    'General industry: protect workers 4 feet or more above a lower level (1910.28(b)(1)). Construction: 6 feet (1926.501(b)(1)). Scaffolds: 10 feet.',
    'Guardrails: top rail at 42 inches, plus or minus 3 (39 to 45 inches), a midrail about halfway, and strong enough for 200 pounds pushed out or down (1910.29(b); 1926.502(b)).',
    'Toeboards at least 3.5 inches tall where things can fall on people below.',
    'Hole covers hold twice the load they will see, are secured, and are marked HOLE or COVER (1926.502(i)).',
    'Personal fall arrest: an anchor good for 5,000 pounds per worker, and no more than 6 feet of free fall (1926.502(d)).'] },
  { id: 'ladders', title: 'Three Points, Three Feet', sub: 'Ladders', cites: '1910.23; 1926.1051, 1926.1053', sites: 'ROIC', rules: [
    'A ladder used to reach an upper level sticks out 3 feet above the landing (1910.23(c)(11); 1926.1053(b)(1)).',
    'Extension ladders go at 1 to 4: one foot out for every four feet up (1926.1053(b)(5)(i)).',
    "Never stand on the top or the top step of a stepladder (1926.1053(b)(13)). A chair or a box isn't a ladder. Yes, even for a smoke detector.",
    'Inspect before use; a broken ladder is tagged Do Not Use and pulled out of service (1910.23(b)(9)-(10); 1926.1053(b)(16)).',
    'No metal ladders near live electrical work (1926.1053(b)(12)).'] },
  { id: 'scaffolds', title: 'Built Right, Checked Daily', sub: 'Scaffolds', cites: '1926.451, 1926.454', sites: 'IC', rules: [
    'Fall protection is required more than 10 feet up on a scaffold (1926.451(g)(1)); top rails at 38 to 45 inches (1926.451(g)(4)(ii)).',
    'A scaffold holds its own weight plus 4 times the load it is meant for (1926.451(a)(1)).',
    'Platforms are fully planked and at least 18 inches wide; plank ends run 6 to 12 inches past their supports (1926.451(b)).',
    'Legs sit on base plates and mudsills, never on bricks or concrete blocks (1926.451(c)(2)).',
    'A competent person inspects it before each shift, and nobody climbs the cross braces to get up (1926.451(e), (f)(3)).'] },
  { id: 'electrical', title: 'Respect the Panel', sub: 'Electrical', cites: '1910.303 to 1910.305, 1910.333, 1910.334; 1926.404, 1926.405, 1926.416', sites: 'ROIC', rules: [
    'Keep a clear space in front of electrical panels: 30 inches wide, 3 feet deep, 6.5 feet high, and never use it for storage (1910.303(g)(1)).',
    'Breakers are labeled (1910.303(f)), and every opening in a panel or box is closed (1910.305(b)).',
    'Equipment is used the way its listing says (1910.303(b)(2)): no daisy-chained power strips, and no extension cords as permanent wiring (1910.305(g)(1)(iv)).',
    'Damaged cords come out of service (1910.334(a)(2); 1926.416(e)(1)).',
    'Jobsite: every 120-volt temporary outlet has a GFCI, or the contractor runs an assured grounding program (1926.404(b)(1)).',
    'Stay at least 10 feet from overhead power lines unless you are qualified (1910.333(c)(3)).'] },
  { id: 'loto', title: 'Lock It, Tag It, Try It', sub: 'Lockout / tagout', cites: '1910.147; 1910.333(b)(2); 1926.417', sites: 'RIC', rules: [
    'Before servicing a machine that could start up or release stored energy, shut it down and lock out the energy source (1910.147).',
    'Each worker puts on their own lock, and locks and tags show who put them on (1910.147(c)(5)).',
    'After locking out, try to start it, to prove it is really dead (1910.147(d)(6)).',
    'Building circuits: turn off the breaker, lock and tag it, and test before you touch (1910.333(b)(2)). That is why you kill the circuit at the panel before anyone opens up a sparking outlet.'] },
  { id: 'hazcom', title: 'Know Your Chemicals', sub: 'Hazard communication', cites: '1910.1200; 1926.59', sites: 'ROIC', rules: [
    'The employer keeps a written hazard communication program and a list of its chemicals (1910.1200(e)).',
    'Every container is labeled with at least the product name and its hazards (1910.1200(f)). A spray bottle you fill and empty yourself in the same shift is the only shortcut.',
    'A Safety Data Sheet for every hazardous chemical, easy to get to on every shift (1910.1200(g)(8)).',
    "Household products used the way a consumer would use them are exempt (1910.1200(b)(6)(ix)). A tenant's bleach is not an OSHA matter; a maintenance crew's drum of it is."] },
  { id: 'exits', title: 'Always a Way Out', sub: 'Exit routes', cites: '1910.36 to 1910.39; 1926.34', sites: 'ROIC', rules: [
    'Exit routes stay clear, with nothing parked in them, even for a minute (1910.37(a)(3)).',
    'Exit doors open from the inside without a key, a tool, or special knowledge (1910.36(d)(1)).',
    'Exit access is at least 28 inches wide (1910.36(g)(2)).',
    'Exits are marked EXIT in letters at least 6 inches tall, and the sign is lit (1910.37(b)(6)-(7)). A door that looks like an exit but is not one is marked NOT AN EXIT.',
    'Workplaces with more than 10 employees have a written emergency action plan (1910.38).'] },
  { id: 'fire', title: 'Extinguishers and Flammables', sub: 'Fire protection', cites: '1910.157; 1910.106; 1910.159(c)(10); 1926.150 to 1926.152', sites: 'ROIC', rules: [
    'Extinguishers are mounted, marked, easy to reach, and charged (1910.157(c)).',
    'Walk no more than 75 feet to a Class A extinguisher, 50 feet to a Class B (1910.157(d)).',
    'Each one gets a look every month and a full maintenance check every year, on its tag (1910.157(e)(2)-(3)).',
    'Keep anything stored at least 18 inches below sprinkler heads (1910.159(c)(10)).',
    'Flammable liquids live in safety cans or a flammable cabinet, 60 gallons at most per cabinet (1910.106(d)(3); 1926.152(b)(3)).',
    'Jobsite: an extinguisher within 100 feet of travel anywhere on the site (1926.150(c)(1)).'] },
  { id: 'firstaid', title: 'Help Within Minutes', sub: 'First aid and eyewash', cites: '1910.151; 1926.50', sites: 'ROIC', rules: [
    'If there is no clinic nearby (think 3 to 4 minutes), someone on site is trained in first aid (1910.151(b)).',
    'First aid supplies are readily available (1910.151(b); 1926.50(d)(1)). On a jobsite, the kit is weatherproof and checked weekly.',
    'Where corrosive chemicals can splash, there is an eyewash or a shower for quick flushing (1910.151(c)). The usual guidance: reachable in about 10 seconds, on the same level, nothing in the way.',
    'No 911 service on site? Post the numbers for a doctor, a hospital, and an ambulance (1926.50(f)).'] },
  { id: 'forklifts', title: 'Slow at the Corners', sub: 'Forklifts and docks', cites: '1910.178; 1910.26; 1926.602(d)', sites: 'IC', rules: [
    'Only trained drivers, each evaluated at least every 3 years (1910.178(l)).',
    'The truck is checked before each shift, and one that needs repair is parked (1910.178(q)(1), (q)(7)).',
    'The capacity plate stays on and readable (1910.178(a)(4)).',
    'Slow down and sound the horn at cross aisles and blind corners (1910.178(n)(4)). No riders.',
    'At the dock, trailer wheels are chocked or the trailer is locked to the dock before a forklift drives in (1910.178(k)(1)).'] },
  { id: 'guarding', title: 'Hands Out of the Danger Zone', sub: 'Machine guarding', cites: '1910.212, 1910.215, 1910.242; 1926.300, 1926.304', sites: 'ROIC', rules: [
    'Guards protect against points of operation, nip points, rotating parts, and flying chips, and stay on (1910.212(a)(1)).',
    'Fixed machines are anchored so they cannot walk or tip (1910.212(b)).',
    'Fan blades lower than 7 feet need a guard with openings no bigger than 1/2 inch (1910.212(a)(5)). Yes, that includes the office pedestal fan.',
    'Bench grinder: work rest within 1/8 inch of the wheel, tongue guard within 1/4 inch (1910.215).',
    'Compressed air for cleaning is turned down under 30 psi (1910.242(b)).'] },
  { id: 'storage', title: 'Stack It Stable', sub: 'Storage and racking', cites: '1910.176; 1926.250', sites: 'OIC', rules: [
    'Aisles are wide enough for what uses them, kept clear, and permanent aisles are marked (1910.176(a)).',
    'Stored material is stacked, blocked, or interlocked so it cannot slide or fall (1910.176(b); 1926.250(a)(1)).',
    'No piles of junk that create trip, fire, or pest problems (1910.176(c)).',
    "There is no rack-specific OSHA rule; damaged or overloaded racks are cited under the General Duty Clause. Look for capacity plaques, anchored uprights, and dented columns.",
    'Jobsite: stored material stays 6 feet back from floor openings and 10 feet from an open edge (1926.250(b)(1)).'] },
  { id: 'trench', title: 'Never Enter an Unprotected Trench', sub: 'Excavations', cites: '1926.650 to 1926.652', sites: 'C', rules: [
    'Trenches 5 feet or deeper need sloping, shoring, or a trench box (1926.652(a)(1)). 20 feet or deeper needs an engineer.',
    'Trenches 4 feet or deeper need a ladder, stairs, or a ramp within 25 feet of every worker (1926.651(c)(2)).',
    'Spoil piles, tools, and equipment stay at least 2 feet back from the edge (1926.651(j)(2)).',
    'A competent person inspects it every day before work and after every rain (1926.651(k)).',
    'Call 811 to find buried utilities before digging (1926.651(b)).'] },
  { id: 'struck', title: 'Eyes Up, Heads Up', sub: 'Struck-by hazards', cites: '1926.100; 1926.201; 1926.252; 1926.451(h); 1926.601(b)(4); 1926.1424', sites: 'IC', rules: [
    'Hard hats wherever things can fall or swing (1926.100).',
    'Trucks with a blocked rear view need a backup alarm or a spotter (1926.601(b)(4)).',
    'Toeboards, screens, or nets keep tools and materials from falling off scaffolds and decks (1926.451(h)).',
    'Debris dropped more than 20 feet outside a building goes down an enclosed chute (1926.252(a)).',
    "Barricade the swing radius of a crane's turning upper works (1926.1424)."] },
  { id: 'health', title: 'Dust, Noise, Heat, and Air', sub: 'Health hazards', cites: '1926.1153; 1910.1053; 1910.134; 1910.95', sites: 'ROIC', rules: [
    'Silica: cutting, grinding, or drilling concrete, brick, or stone throws dust that scars lungs. Use water at the blade or a vacuum shroud, and no dry sweeping (1926.1153).',
    'Required respirators need a written program, a medical check, and a fit test every year (1910.134).',
    'Noise: a hearing program starts at 85 dBA over 8 hours (1910.95).',
    'Heat: no final federal heat rule yet, so it falls under the General Duty Clause. Water, rest, and shade.',
    "Mold and indoor air: no OSHA standard, only guidance (SHIB 03-10-10). Fix the leak first, then clean up."] },
  { id: 'outreach', title: 'OSHA-10 and the Focus Four', sub: 'The ten-hour card', cites: '1926 (construction); 1910 (general industry)', sites: 'OIC', rules: [
    "The OSHA 10-hour card is introductory training from OSHA's Outreach Training Program. It is voluntary under federal law, but many states, cities, and contracts require it on site.",
    'Construction 10-hour: an introduction to OSHA, the Focus Four (4 hours, at least), PPE, and health hazards, plus electives like scaffolds, ladders, excavations, and tools.',
    'The Focus Four are the four things that kill the most construction workers: falls, struck-by, caught-in or between, and electrocution. Falls are the biggest by far.',
    'General Industry 10-hour: an introduction to OSHA, walking and working surfaces, exits and fire protection, electrical, PPE, and hazard communication, plus electives.',
    'A card proves someone sat through the class, not that they follow it. Watch what the crew actually does.'] },
  { id: 'cited', title: 'The Usual Suspects', sub: "OSHA's most-cited rules", cites: '1926.501; 1910.1200; 1910.147; 1926.451; 1926.1053; 1910.134; 1910.178; 1926.503; 1926.102; 1910.212', sites: 'ROIC', rules: [
    'Year after year, the same ten rules top the list of what OSHA writes up. Fall protection in construction (1926.501) has been number one for well over a decade.',
    'The rest: hazard communication (1910.1200), lockout (1910.147), scaffolds (1926.451), ladders (1926.1053), respirators (1910.134), forklifts (1910.178), fall protection training (1926.503), eye protection (1926.102), and machine guarding (1910.212).',
    "None of them are exotic. They're the everyday stuff: an open edge, an unlabeled bottle, a guard taken off and never put back.",
    'Every one of them can turn up on a walk. Look for them first.'] }
];
/* which chapter a citation belongs to: [pattern, chapter] tried in order, most specific first */
const OSHA_CITE_MAP = [
  [/^1910\.1200|^1926\.59\b/, 'hazcom'], [/^1910\.(1053|134|95)\b|^1926\.(1153|52)\b/, 'health'], [/^1926\.(65[0-2])\b/, 'trench'],
  [/^1926\.45[0-4]\b/, 'scaffolds'], [/^1926\.(201|252|601|1424)\b/, 'struck'], [/^1926\.(10[0-2]|9[5-9])\b|^1910\.13[2-8]\b/, 'ppe'],
  [/^1910\.(178|26)\b|^1926\.602\b/, 'forklifts'], [/^1910\.(21[2-9]|242)\b|^1926\.30[0-4]\b/, 'guarding'], [/^1910\.176\b|^1926\.250\b/, 'storage'],
  [/^1910\.(15[0-9]|106)\b|^1926\.15[0-2]\b/, 'fire'], [/^1910\.151\b|^1926\.50\b/, 'firstaid'], [/^1910\.147\b|^1926\.417\b|^1910\.333\(b\)/, 'loto'],
  [/^1910\.3[0-3]\d\b|^1926\.4[0-4]\d\b/, 'electrical'], [/^1910\.3[4-9]\b|^1926\.34\b/, 'exits'], [/^1910\.23\b|^1926\.105[0-3]\b/, 'ladders'],
  [/^1910\.2[89]\b|^1926\.50[0-3]\b/, 'falls'], [/^1910\.22\b|^1926\.(25|701)\b/, 'walking'], [/^1926\.503\b/, 'falls'], [/^190[34]\b/, 'basics']
];
const OshaBook = {
  chapterFor(cite) { const c = String(cite).replace(/^29 CFR /, ''); const hit = OSHA_CITE_MAP.find(([re]) => re.test(c)); return hit ? hit[1] : 'basics'; },
  /* the pages, as the binder's HTML (each chapter's heading carries data-sop="osha-<id>" for links to land on) */
  html() {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const title = `<div class="pg title-pg osha-title"><p class="pg-co">BRICKROAD PROPERTY MGMT.</p><h2>Field Safety Handbook</h2>
      <p class="pg-sub">OSHA's rules, in plain language</p>
      <p class="pg-note">Written from public-domain OSHA publications (the General Industry Digest, OSHA 2201; the Construction Industry Digest, OSHA 2202; the Small Business Handbook, OSHA 2209) and 29 CFR 1910 and 1926. Not an official OSHA publication: the current text on eCFR always wins.</p></div>`;
    const toc = Array.from({ length: Math.ceil(OSHA_CHAPTERS.length / 10) }, (_, i) => i * 10).map(from => `<div class="pg osha-toc"><h3>${from ? 'Contents (continued)' : 'Contents'}</h3><ol start="${from + 1}">${OSHA_CHAPTERS.slice(from, from + 10).map(c => `<li><button type="button" class="sop-ref osha-go" data-osha="${c.id}">${esc(c.title)}</button> <small>${esc(c.sub)}</small></li>`).join('')}</ol></div>`).join('');
    // a chapter too long for one page carries on to the next
    const pages = OSHA_CHAPTERS.map(c => {
      const long = c.rules.join('').length > 700, cut = long ? Math.ceil(c.rules.length / 2) : c.rules.length;
      const page = (rules, more) => `<div class="pg osha-pg"><h3${more ? '' : ` data-sop="osha-${c.id}"`}>${esc(c.title)}${more ? ' (continued)' : ''}</h3>
      ${more ? '' : `<p class="osha-meta"><span class="osha-cite">29 CFR ${esc(c.cites)}</span>${[...c.sites].map(k => `<span class="osha-site s-${k}">${OSHA_SITES[k]}</span>`).join('')}</p>`}
      <ul>${rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
      return page(c.rules.slice(0, cut)) + (long ? page(c.rules.slice(cut), true) : '');
    }).join('');
    return title + toc + pages;
  }
};
