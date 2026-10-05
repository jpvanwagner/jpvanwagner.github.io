/**
 * Mapster - Wall Texture Generators
 * * This module handles the procedural generation of wall patterns via the HTML5 Canvas API.
 * Designed to be modular and easily extensible.
 */

const WallTextures = {
    // ---------------------------------------------------------
    // 1. BRICK (Classic Staggered Brick)
    // ---------------------------------------------------------
    brick: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = ac || '#333'; // Grout color
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = hex; // Brick color
        const bh = size / 4; // Brick height
        const bw = size / 2; // Brick width

        for (let row = 0; row < 4; row++) {
            const offset = (row % 2 === 0) ? 0 : -bw / 2;
            for (let col = -1; col < 3; col++) {
                ctx.fillRect(col * bw + offset + 2, row * bh + 2, bw - 4, bh - 4);
            }
        }
    },

    // ---------------------------------------------------------
    // 2. PANELING (Vertical Wood Strips)
    // ---------------------------------------------------------
    paneling: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = hex;
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = ac || 'rgba(0,0,0,0.2)';
        const stripWidth = size / 5;
        for (let i = 0; i < size; i += stripWidth) {
            ctx.fillRect(i, 0, 2, size);
        }
    },

    // ---------------------------------------------------------
    // 3. PLASTER (Distressed/Textured)
    // ---------------------------------------------------------
    plaster: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = hex;
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = ac || 'rgba(255,255,255,0.1)';
        for (let i = 0; i < 400; i++) {
            ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
        }
    },

    // ---------------------------------------------------------
    // 4. METAL (Industrial Corrugated)
    // ---------------------------------------------------------
    metal: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = hex;
        ctx.fillRect(0, 0, size, size);

        ctx.strokeStyle = ac || 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 4;
        for (let i = 0; i <= size; i += 12) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, size);
            ctx.stroke();
        }
    },

    // ---------------------------------------------------------
    // 5. MASONRY (Rough Stone Wall)
    // ---------------------------------------------------------
    masonry: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = hex;
        ctx.fillRect(0, 0, size, size);

        ctx.strokeStyle = ac || 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 15; i++) {
            ctx.strokeRect(Math.random() * size - 10, Math.random() * size - 10, size / 2, size / 2);
        }
    },

    // ---------------------------------------------------------
    // 6. PIPES (Tech / Dungeon Wall)
    // ---------------------------------------------------------
    pipes: (ctx, hex, ac, size = 64) => {
        ctx.fillStyle = hex;
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = ac || '#444';
        ctx.fillRect(size / 3, 0, size / 3, size); // Vertical pipe
        ctx.fillRect(0, size / 3, size, size / 3); // Horizontal pipe
    }
};

// Export for integration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WallTextures;
} else if (typeof window !== 'undefined') {
    window.WallTextures = WallTextures;
}