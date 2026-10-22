/* ============================================================================
   Scenemaker editor; editor theme presets (DATA ONLY)
   Full palettes for the editor UI. tool-theme.js reads these and applies them.
   Add a theme by adding an entry here: give it a label and a full var set.
   Every theme sets the same variables so switching is always complete.
   ==========================================================================*/
const EDITOR_THEMES = {
  slate_pro:{ label:'Corporate Slate (light) · pro', vars:{
    '--body':'#eef1f5','--workspace':'#f7f9fc','--dot':'#7791b0','--panel':'#ffffff','--panel2':'#f1f5f9',
    '--ink':'#1e293b','--mut':'#5e6d83','--line':'#d8dee9','--bar':'#ffffff','--field':'#ffffff','--accent':'#2563eb','--accent2':'#1d4ed8'} },
  teal_pro:{ label:'Clinical Teal (light) · pro', vars:{
    '--body':'#eef4f4','--workspace':'#f7fbfb','--dot':'#5f9a96','--panel':'#ffffff','--panel2':'#eef6f5',
    '--ink':'#123536','--mut':'#567374','--line':'#cfe1e0','--bar':'#ffffff','--field':'#ffffff','--accent':'#0d9488','--accent2':'#0f766e'} },
  graphite:{ label:'Graphite (dark) · pro', vars:{
    '--body':'#17191d','--workspace':'#1f2226','--dot':'#646d77','--panel':'#26292e','--panel2':'#1c1f23',
    '--ink':'#e8eaed','--mut':'#a3a9b3','--line':'#3a3f45','--bar':'#1a1c20','--field':'#101215','--accent':'#3b82f6','--accent2':'#2563eb'} },
  navy_pro:{ label:'Executive Navy (dark) · pro', vars:{
    '--body':'#0a0f1c','--workspace':'#111a2e','--dot':'#4c6999','--panel':'#16213a','--panel2':'#0f1729',
    '--ink':'#eaf0f8','--mut':'#9db0cd','--line':'#2a3a55','--bar':'#0c1424','--field':'#070c16','--accent':'#38bdf8','--accent2':'#0ea5e9'} },
  warm_pro:{ label:'Warm Paper (light) · pro', vars:{
    '--body':'#f4efe7','--workspace':'#fbf8f2','--dot':'#a48c65','--panel':'#ffffff','--panel2':'#f3ede2',
    '--ink':'#3a2f22','--mut':'#786851','--line':'#e2d8c6','--bar':'#ffffff','--field':'#ffffff','--accent':'#b45309','--accent2':'#92400e'} },
  midnight:{ label:'Midnight · fuchsia (dark)', vars:{
    '--body':'#020617','--workspace':'#0f172a','--dot':'#506685','--panel':'#1f2937','--panel2':'#111827',
    '--ink':'#f8fafc','--mut':'#b4c2d6','--line':'#374151','--bar':'#0b1120','--field':'#000000','--accent':'#c026d3','--accent2':'#a21caf'} },
  ocean:{ label:'Deep Ocean (dark)', vars:{
    '--body':'#041018','--workspace':'#072736','--dot':'#2d7696','--panel':'#0e2a38','--panel2':'#08202c',
    '--ink':'#eaf6fb','--mut':'#a9c9d8','--line':'#17475c','--bar':'#061a24','--field':'#041018','--accent':'#22d3ee','--accent2':'#0891b2'} },
  forest:{ label:'Forest (dark)', vars:{
    '--body':'#04140b','--workspace':'#0a2417','--dot':'#2f7a4d','--panel':'#123020','--panel2':'#0b2417',
    '--ink':'#eafaef','--mut':'#b3d6bf','--line':'#1e4a30','--bar':'#061a10','--field':'#04140b','--accent':'#34d399','--accent2':'#059669'} },
  ember:{ label:'Ember (dark)', vars:{
    '--body':'#17100a','--workspace':'#241812','--dot':'#865e44','--panel':'#2a1c12','--panel2':'#1e130c',
    '--ink':'#fbf1e8','--mut':'#e0c3ab','--line':'#4a3220','--bar':'#1a1109','--field':'#17100a','--accent':'#fb923c','--accent2':'#ea580c'} },
  grape:{ label:'Grape Soda (dark)', vars:{
    '--body':'#120a1e','--workspace':'#1e0f33','--dot':'#7c4bb3','--panel':'#281641','--panel2':'#1c0f30',
    '--ink':'#f3ebff','--mut':'#c9b6e0','--line':'#3d2560','--bar':'#140a24','--field':'#120a1e','--accent':'#a78bfa','--accent2':'#7c3aed'} },
  terminal:{ label:'Terminal Green (dark)', vars:{
    '--body':'#000500','--workspace':'#020a02','--dot':'#1b6e1b','--panel':'#041a08','--panel2':'#020d04',
    '--ink':'#b7f7b7','--mut':'#6ee06e','--line':'#0f3d0f','--bar':'#010401','--field':'#000500','--accent':'#22c55e','--accent2':'#16a34a'} },
  solard:{ label:'Solarized (dark)', vars:{
    '--body':'#002028','--workspace':'#073642','--dot':'#3e8594','--panel':'#073642','--panel2':'#002b36',
    '--ink':'#eee8d5','--mut':'#93a1a1','--line':'#0f4b57','--bar':'#002028','--field':'#002b36','--accent':'#268bd2','--accent2':'#2aa198'} },
  paper:{ label:'Paper · warm (light)', vars:{
    '--body':'#efe7d8','--workspace':'#f6f0e4','--dot':'#9f864f','--panel':'#fffdf8','--panel2':'#f2ead9',
    '--ink':'#2c2418','--mut':'#6b5d43','--line':'#ddd0b6','--bar':'#f8f2e6','--field':'#fffdf8','--accent':'#4f46e5','--accent2':'#4338ca'} },
  arctic:{ label:'Arctic · cool (light)', vars:{
    '--body':'#e6edf5','--workspace':'#f2f7fc','--dot':'#6591bf','--panel':'#ffffff','--panel2':'#eef4fa',
    '--ink':'#10233a','--mut':'#4a627c','--line':'#cddaea','--bar':'#f5f9fd','--field':'#ffffff','--accent':'#0ea5e9','--accent2':'#0369a1'} },
  solarl:{ label:'Solarized (light)', vars:{
    '--body':'#eee8d5','--workspace':'#fdf6e3','--dot':'#9d8d57','--panel':'#fdf6e3','--panel2':'#eee8d5',
    '--ink':'#073642','--mut':'#546a70','--line':'#ddd6c1','--bar':'#eee8d5','--field':'#fdf6e3','--accent':'#268bd2','--accent2':'#2aa198'} },
  contrast:{ label:'High Contrast', vars:{
    '--body':'#000000','--workspace':'#0a0a0a','--dot':'#5e5e5e','--panel':'#101010','--panel2':'#000000',
    '--ink':'#ffffff','--mut':'#d4d4d4','--line':'#4d4d4d','--bar':'#000000','--field':'#000000','--accent':'#ffd400','--accent2':'#ffaa00'} },
  // the default theme (per the owner's request): a Commodore 64 "BASIC blue"
  // screen as the base, with bold Famicom/NES red and gold standing in for
  // the accent colours a C64 never really had. Every var re-measured for
  // real contrast (grid dots and borders against the workspace, text against
  // every surface) the same way the #51 low-contrast-themes fix required,
  // not just eyeballed.
  retro8bit:{ label:'Retro 8-Bit · Commodore/Famicom (dark)', vars:{
    '--body':'#0a0a30','--workspace':'#15155a','--dot':'#8888ff','--panel':'#22228a','--panel2':'#1a1a6e',
    '--ink':'#f5f1e0','--mut':'#c0c0f5','--line':'#6262e0','--bar':'#08081f','--field':'#000018','--accent':'#f4202f','--accent2':'#d4af37'} },
};
const EDITOR_THEME_DEFAULT = 'retro8bit';
