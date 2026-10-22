// Party names for the host stand, and the guests' clothing palette.
export const SURNAMES = [
  'Russo', 'Bianchi', 'Okafor', 'Nguyen', 'Kowalski', 'Garcia', 'Patel', 'Lindqvist', 'Moretti',
  'Haddad', 'Kim', 'Rossi', 'Fischer', 'Esposito', "O'Brien", 'Tanaka', 'Romano', 'Mensah',
  'Delgado', 'Conti', 'Novak', 'Ferrari', 'Abara', 'Costa', 'Silva', 'Ricci', 'Greco', 'Dubois',
  'Marino', 'Larsen', 'Bruno', 'Shapiro', 'Gallo', 'Mancini', 'Yilmaz', 'Lombardi', 'Barbieri',
];

export const SHIRTS = [
  0x2f5d8a, 0x6a8f3c, 0xc9a43a, 0x7b4f9e, 0x3c8f8a, 0xd07a3a, 0x5a5a66, 0x9e3c5a, 0x8aa0b4, 0x4f6b3a,
];
export const SKIN = [0xf1d0b5, 0xe0b48f, 0xc68c64, 0x9a6440, 0x6e4329, 0xf6dcc4];
export const HAIR = [0x2a1d14, 0x5a3a22, 0x8a6a3a, 0x1a1a1a, 0xb9a27a, 0x6a6a6a, 0x9a3a1a];

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const rand = (a, b) => a + Math.random() * (b - a);
