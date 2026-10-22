/**
 * Mapster - Floor Texture Generators
 * * This module handles the procedural generation of floor textures via the HTML5 Canvas API.
 * Each floor type is a function that takes the rendering context, base color, and accent color.
 */

const FloorTextures = {
    // =========================================================
    // 90s ARCADE / COSMIC-BOWLING CARPET FAMILY
    // ---------------------------------------------------------
    // Authentic late-80s/90s arcade & roller-rink carpet is a NEAR-BLACK
    // field scattered with small BRIGHT NEON geometric confetti — triangles,
    // zigzags, squiggles, dots, stars, bowties — in cyan / magenta / yellow /
    // lime / orange. It is deliberately busy and chaotic ("Memphis"/"cosmic"
    // style), NOT clean intersecting lines. These generators reproduce that.
    //
    // All use a tiny seeded RNG so the scatter is deterministic per call
    // (re-renders identically, and tiles without obvious seams).
    //
    // `hex` = base field color (defaults to near-black if a light color is
    // passed, since arcade carpet is always dark). `ac` is unused for most
    // (the neon palette is intrinsic) but tints the field when provided.
    // ---------------------------------------------------------

    // Shared neon palette + helpers (kept local to avoid polluting globals).
    _arcadeNeon: ['#ff2d95', '#00e5ff', '#ffe600', '#39ff14', '#ff7a00', '#b14aff', '#ff3b3b'],
    _seededRng: (seed) => {
        // Mulberry32 — small deterministic PRNG.
        let a = seed >>> 0;
        return () => {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },
    _darkField: (hex) => {
        // Force a dark field. If the user passed a light color, darken it;
        // otherwise use a deep near-black with a hint of the chosen hue.
        if (!hex) return '#0a0a12';
        // crude luminance check
        const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
        if (!m) return '#0a0a12';
        const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum > 80) {
            // Too light for arcade carpet — darken heavily but keep the tint.
            return `rgb(${Math.round(r * 0.18)},${Math.round(g * 0.18)},${Math.round(b * 0.18)})`;
        }
        return hex;
    },

    // Toroidal "wrap draw": calls drawFn(ox, oy) at the shape's real spot plus
    // copies shifted by ±size when it's within radius s of an edge, so patterns
    // tile SEAMLESSLY — a shape clipped at one edge reappears at the opposite one,
    // hiding the obvious square grid between repeated floor tiles.
    _wrapDraw: (ctx, x, y, s, size, drawFn) => {
        const xs = [x]; if (x < s) xs.push(x + size); if (x > size - s) xs.push(x - size);
        const ys = [y]; if (y < s) ys.push(y + size); if (y > size - s) ys.push(y - size);
        for (const ox of xs) for (const oy of ys) drawFn(ox, oy);
    },

    // ---------------------------------------------------------
    // 1. CARPET — default arcade carpet (cosmic confetti).
    //    This is the one mapped to the "Arcade Carpet" floor brush.
    // ---------------------------------------------------------
    carpet: function (ctx, hex, ac, size = 64) {
        // Alias to the cosmic variant so the default brush looks right.
        FloorTextures.arcade_cosmic(ctx, hex, ac, size);
    },

    // ---------------------------------------------------------
    // 1a. ARCADE — COSMIC: scattered neon triangles, dots, squiggles,
    //     bowties and plus-signs on a near-black field. The classic look.
    // ---------------------------------------------------------
    arcade_cosmic: function (ctx, hex, ac, size = 64) {
        const rng = FloorTextures._seededRng(1337);
        const neon = FloorTextures._arcadeNeon;
        ctx.fillStyle = FloorTextures._darkField(hex);
        ctx.fillRect(0, 0, size, size);

        const shapeCount = Math.round(size * 0.6);   // density scales with size
        for (let i = 0; i < shapeCount; i++) {
            const x = rng() * size, y = rng() * size;
            const c = neon[Math.floor(rng() * neon.length)];
            const s = 2 + rng() * (size * 0.07);
            const kind = Math.floor(rng() * 5);
            const rot = rng() * Math.PI * 2;
            FloorTextures._wrapDraw(ctx, x, y, s, size, (ox, oy) => {
                ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = Math.max(1, size * 0.018);
                ctx.save(); ctx.translate(ox, oy); ctx.rotate(rot);
                if (kind === 0) {                         // triangle
                    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s, s); ctx.lineTo(-s, s); ctx.closePath(); ctx.fill();
                } else if (kind === 1) {                  // dot
                    ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2); ctx.fill();
                } else if (kind === 2) {                  // zigzag squiggle
                    ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(-s / 3, -s); ctx.lineTo(s / 3, s); ctx.lineTo(s, -s * 0.3); ctx.stroke();
                } else if (kind === 3) {                  // plus / cross
                    ctx.fillRect(-s * 0.6, -s * 0.15, s * 1.2, s * 0.3); ctx.fillRect(-s * 0.15, -s * 0.6, s * 0.3, s * 1.2);
                } else {                                  // bowtie
                    ctx.beginPath(); ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.lineTo(-s, s); ctx.lineTo(s, -s); ctx.closePath(); ctx.fill();
                }
                ctx.restore();
            });
        }
    },

    // ---------------------------------------------------------
    // 1b. ARCADE — ZIGZAG/MEMPHIS: bold triangles + zigzag bands.
    // ---------------------------------------------------------
    arcade_zigzag: function (ctx, hex, ac, size = 64) {
        const rng = FloorTextures._seededRng(90210);
        const neon = FloorTextures._arcadeNeon;
        ctx.fillStyle = FloorTextures._darkField(hex);
        ctx.fillRect(0, 0, size, size);

        // Zigzag bands across the tile.
        const bands = 3;
        for (let b = 0; b < bands; b++) {
            ctx.strokeStyle = neon[b % neon.length];
            ctx.lineWidth = Math.max(1.5, size * 0.03);
            ctx.beginPath();
            const yBase = (b + 0.5) * (size / bands);
            const step = size / 4;
            for (let x = 0; x <= size; x += step) {
                const y = yBase + ((x / step) % 2 === 0 ? -step * 0.4 : step * 0.4);
                if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        // Scattered solid triangles between the bands (edge-wrapped to tile).
        for (let i = 0; i < Math.round(size * 0.25); i++) {
            const x = rng() * size, y = rng() * size, s = 3 + rng() * (size * 0.09);
            const col = neon[Math.floor(rng() * neon.length)], rot = rng() * Math.PI * 2;
            FloorTextures._wrapDraw(ctx, x, y, s, size, (ox, oy) => {
                ctx.fillStyle = col;
                ctx.save(); ctx.translate(ox, oy); ctx.rotate(rot);
                ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s, s); ctx.lineTo(-s, s); ctx.closePath(); ctx.fill();
                ctx.restore();
            });
        }
    },

    // ---------------------------------------------------------
    // 1c. ARCADE — GALAXY: stars, sparkles and swooshes (cosmic bowling).
    // ---------------------------------------------------------
    arcade_galaxy: function (ctx, hex, ac, size = 64) {
        const rng = FloorTextures._seededRng(424242);
        const neon = FloorTextures._arcadeNeon;
        // Deep blue-violet field for the "space" look.
        ctx.fillStyle = FloorTextures._darkField(hex || '#0b0524');
        ctx.fillRect(0, 0, size, size);

        // Tiny star dots (edge-wrapped).
        for (let i = 0; i < Math.round(size * 0.9); i++) {
            const col = rng() > 0.4 ? '#ffffff' : neon[Math.floor(rng() * neon.length)];
            const r = rng() * (size * 0.015) + 0.4, x = rng() * size, y = rng() * size;
            FloorTextures._wrapDraw(ctx, x, y, r, size, (ox, oy) => {
                ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.fill();
            });
        }
        // A few 4-point sparkle stars (edge-wrapped).
        for (let i = 0; i < Math.round(size * 0.12); i++) {
            const x = rng() * size, y = rng() * size, s = 2 + rng() * (size * 0.08);
            const col = neon[Math.floor(rng() * neon.length)];
            FloorTextures._wrapDraw(ctx, x, y, s, size, (ox, oy) => {
                ctx.fillStyle = col;
                ctx.save(); ctx.translate(ox, oy);
                ctx.beginPath();
                ctx.moveTo(0, -s); ctx.lineTo(s * 0.2, -s * 0.2); ctx.lineTo(s, 0); ctx.lineTo(s * 0.2, s * 0.2);
                ctx.lineTo(0, s); ctx.lineTo(-s * 0.2, s * 0.2); ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.2, -s * 0.2);
                ctx.closePath(); ctx.fill();
                ctx.restore();
            });
        }
        // Swooshes (curved comet trails).
        for (let i = 0; i < 4; i++) {
            ctx.strokeStyle = neon[Math.floor(rng() * neon.length)];
            ctx.lineWidth = Math.max(1, size * 0.012);
            ctx.beginPath();
            const sx = rng() * size, sy = rng() * size;
            ctx.moveTo(sx, sy);
            ctx.quadraticCurveTo(sx + (rng() - 0.5) * size * 0.5, sy + (rng() - 0.5) * size * 0.5, sx + (rng() - 0.5) * size * 0.6, sy + (rng() - 0.5) * size * 0.6);
            ctx.stroke();
        }
    },

    // ---------------------------------------------------------
    // 2. TILE (Checkerboard)
    // ---------------------------------------------------------
    tile: (ctx, hex, ac, size = 64) => {
        const half = size / 2;
        
        // Base background (Accent color or semi-transparent white)
        ctx.fillStyle = ac || 'rgba(255,255,255,0.1)'; 
        ctx.fillRect(0, 0, size, size);
        
        // Primary color squares
        ctx.fillStyle = hex;
        ctx.fillRect(0, 0, half, half);          // Top-Left
        ctx.fillRect(half, half, half, half);    // Bottom-Right
        
        // Grout/Border lines
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; 
        ctx.lineWidth = 2; 
        ctx.strokeRect(0, 0, half, half); 
        ctx.strokeRect(half, half, half, half);
    },

    // ---------------------------------------------------------
    // 3. WOOD (Hardwood Planks)
    // ---------------------------------------------------------
    wood: (ctx, hex, ac, size = 64) => {
        // Base color
        ctx.fillStyle = hex;
        ctx.fillRect(0, 0, size, size);

        // Plank lines and wood grain (Accent color)
        ctx.fillStyle = ac || '#3e2723'; 
        const plankWidth = size / 8;
        
        for(let i = 0; i < size; i += plankWidth) {
            // Horizontal plank gaps
            ctx.fillRect(0, i, size, 1); 
            // Random vertical plank separators
            ctx.fillRect(Math.random() * size, i, 1, plankWidth);
            // Wood grain noise
            for(let grain = 0; grain < 5; grain++) {
                ctx.fillRect(Math.random() * size, i + Math.random() * plankWidth, 3, 1);
            }
        }
    },

    // ---------------------------------------------------------
    // 4. CONCRETE (Smooth / Noisy)
    // ---------------------------------------------------------
    concrete: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = hex; 
        ctx.fillRect(0, 0, size, size);

        // Generates random stippling noise for concrete texture
        for(let i = 0; i < 300; i++) {
            ctx.fillStyle = (i % 2 === 0) ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)'; 
            ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
        }
    },

    // ---------------------------------------------------------
    // 5. STONE (Cobblestone / Path)
    // ---------------------------------------------------------
    stone: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = hex;
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = ac || '#555';
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 1;
        
        // Draw overlapping rounded stones
        for(let i = 0; i < 40; i++) {
            ctx.beginPath(); 
            ctx.arc(
                Math.random() * size, 
                Math.random() * size, 
                2 + Math.random() * 6, // Radius
                0, Math.PI * 2
            ); 
            ctx.fill(); 
            ctx.stroke();
        }
    },

    // ---------------------------------------------------------
    // 6. GRASS (Lawn / Outdoors)
    // ---------------------------------------------------------
    grass: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = hex; // Base soil/grass
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = ac || '#0a0'; // Grass blades
        
        // Draw vertical flecks to represent blades of grass
        for(let i = 0; i < 250; i++) {
            ctx.fillRect(Math.random() * size, Math.random() * size, 1, 3 + Math.random() * 3);
        }
    },

    // ---------------------------------------------------------
    // 7. DIRT / GRAVEL
    // ---------------------------------------------------------
    dirt: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = hex;
        ctx.fillRect(0, 0, size, size);

        // Draw rough, chunky gravel pixels
        for(let i = 0; i < 300; i++) {
            ctx.fillStyle = ac || '#451a03'; 
            let dotSize = 1 + Math.random() * 2;
            ctx.fillRect(Math.random() * size, Math.random() * size, dotSize, dotSize);
        }
    },

    // =========================================================
    // #3: ADDITIONAL FLOOR PATTERNS
    // ---------------------------------------------------------
    // 8. BRICK — staggered running-bond brick.
    brick: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = ac || '#6b3a2a'; ctx.fillRect(0, 0, size, size);   // mortar
        ctx.fillStyle = hex || '#a8432f';
        const bh = size / 4, bw = size / 2;
        for (let row = 0, y = 0; y < size; y += bh, row++) {
            const off = (row % 2) ? -bw / 2 : 0;
            for (let x = off; x < size; x += bw) {
                ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
            }
        }
    },

    // 9. HEX TILE — honeycomb hexagons.
    hextile: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = ac || '#1f2937'; ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = hex || '#94a3b8';
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
        const r = size / 6;
        const drawHex = (cx, cy) => {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
            ctx.closePath(); ctx.fill(); ctx.stroke();
        };
        const dx = r * 1.8, dy = r * 1.55;
        for (let row = 0, y = 0; y < size + dy; y += dy, row++)
            for (let x = (row % 2 ? dx / 2 : 0); x < size + dx; x += dx) drawHex(x, y);
    },

    // 10. DIAMOND PLATE — industrial metal tread.
    plate: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = hex || '#8a8f98'; ctx.fillRect(0, 0, size, size);
        // subtle metal sheen
        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, 'rgba(255,255,255,0.12)'); grad.addColorStop(0.5, 'rgba(0,0,0,0.0)'); grad.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = ac || 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
        const step = size / 4;
        for (let gy = step / 2; gy < size; gy += step)
            for (let gx = step / 2; gx < size; gx += step) {
                const o = ((Math.round(gy / step)) % 2) ? step / 2 : 0;
                ctx.beginPath(); ctx.moveTo(gx + o - 5, gy - 2); ctx.lineTo(gx + o + 5, gy + 2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(gx + o - 5, gy + 2); ctx.lineTo(gx + o + 5, gy - 2); ctx.stroke();
            }
    },

    // 11. LINOLEUM — speckled retro institutional floor.
    lino: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = hex || '#d8d2c0'; ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 500; i++) {
            const t = Math.random();
            ctx.fillStyle = t < 0.5 ? (ac || '#9a8f70') : (t < 0.8 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.4)');
            ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
        }
        // faint seams every half tile
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, size / 2, size / 2); ctx.strokeRect(size / 2, size / 2, size / 2, size / 2);
    },

    // 12. MARBLE — veined polished stone.
    marble: (ctx, hex, ac, size = 64) => {
        // #15: convincing marble — a softly mottled stone base, a couple of MAJOR
        // veins that traverse the slab and BRANCH (with thickness taper + varying
        // opacity), plus faint hairline veins. Deterministic per colour via the
        // seeded RNG so a given tile always looks the same. (Was 7 loose squiggles.)
        ctx.save();
        const base = hex || '#eef0f2';
        ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
        const rng = FloorTextures._seededRng(((hex || '').length + 11) * 2654435761);
        const veinCol = (ac && ac[0] === '#') ? ac : '#8390a8';

        // 1) soft mottling — a few large translucent grey clouds break up the flat fill
        for (let i = 0; i < 5; i++) {
            const gx = rng() * size, gy = rng() * size, gr = size * (0.25 + rng() * 0.4);
            const a = 0.05 + rng() * 0.06;
            const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
            g.addColorStop(0, 'rgba(150,160,175,' + a.toFixed(3) + ')');
            g.addColorStop(1, 'rgba(150,160,175,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
        }

        // 2) recursive vein — wanders, tapers, and spawns finer branches
        ctx.lineCap = 'round';
        const drawVein = (x, y, ang, len, w, depth) => {
            let cx = x, cy = y, ca = ang;
            ctx.beginPath(); ctx.moveTo(cx, cy);
            const steps = Math.floor(len / 4) + 3;
            for (let s = 0; s < steps; s++) {
                ca += (rng() - 0.5) * 0.8;
                const nx = cx + Math.cos(ca) * 4, ny = cy + Math.sin(ca) * 4;
                ctx.quadraticCurveTo(cx + (rng() - 0.5) * 3, cy + (rng() - 0.5) * 3, nx, ny);
                cx = nx; cy = ny;
            }
            ctx.strokeStyle = veinCol;
            ctx.globalAlpha = 0.18 + 0.22 * Math.min(1, w / 3);
            ctx.lineWidth = Math.max(0.5, w);
            ctx.stroke();
            ctx.globalAlpha = 1;
            if (depth > 0 && w > 0.8) {
                const bn = 1 + Math.floor(rng() * 2);
                for (let b = 0; b < bn; b++) drawVein(cx, cy, ca + (rng() - 0.5) * 1.6, len * 0.5, w * 0.55, depth - 1);
            }
        };
        const nMajor = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < nMajor; i++) {
            // start each major vein on an edge so it reads as crossing the slab
            const edge = Math.floor(rng() * 4); let x, y, ang;
            if (edge === 0) { x = 0; y = rng() * size; ang = (rng() - 0.5) * 1.2; }
            else if (edge === 1) { x = size; y = rng() * size; ang = Math.PI + (rng() - 0.5) * 1.2; }
            else if (edge === 2) { x = rng() * size; y = 0; ang = Math.PI / 2 + (rng() - 0.5) * 1.2; }
            else { x = rng() * size; y = size; ang = -Math.PI / 2 + (rng() - 0.5) * 1.2; }
            drawVein(x, y, ang, size * 1.3, 1.6 + rng() * 1.2, 2);
        }

        // 3) hairline veins — a faint web of short fractures
        ctx.globalAlpha = 0.10; ctx.strokeStyle = veinCol; ctx.lineWidth = 0.4;
        for (let i = 0; i < 10; i++) {
            ctx.beginPath();
            let x = rng() * size, y = rng() * size; ctx.moveTo(x, y);
            for (let s = 0; s < 3; s++) { x += (rng() - 0.5) * size * 0.4; y += (rng() - 0.5) * size * 0.4; ctx.lineTo(x, y); }
            ctx.stroke();
        }
        ctx.restore();
    },

    // 13. TERRAZZO — chips of color in a pale matrix (very 80s/90s lobby).
    terrazzo: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = hex || '#efece4'; ctx.fillRect(0, 0, size, size);
        const palette = [ac || '#e05a4d', '#3a7ca5', '#f0c14b', '#5fa86a', '#7d5ba6', '#444'];
        for (let i = 0; i < 90; i++) {
            ctx.fillStyle = palette[i % palette.length];
            const cx = Math.random() * size, cy = Math.random() * size, r = 1 + Math.random() * 3;
            ctx.beginPath(); ctx.ellipse(cx, cy, r, r * (0.6 + Math.random() * 0.6), Math.random() * Math.PI, 0, Math.PI * 2); ctx.fill();
        }
    },

    // 14. DIAGONAL STRIPES — bold two-tone diagonal bands.
    stripes: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = hex || '#222'; ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = ac || '#f4d03f';
        const w = size / 4;
        ctx.save(); ctx.translate(0, 0); ctx.rotate(-Math.PI / 4);
        for (let x = -size; x < size * 2; x += w * 2) ctx.fillRect(x, -size, w, size * 3);
        ctx.restore();
    }
};

// Export for Node/Modern Web usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FloorTextures;
} else if (typeof window !== 'undefined') {
    window.FloorTextures = FloorTextures;
}