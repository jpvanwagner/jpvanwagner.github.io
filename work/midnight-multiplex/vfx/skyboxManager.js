/**
 * Mapster - Skybox & Environment Manager
 * Handles background rendering, procedural skies, and loading custom equirectangular textures.
 */

class SkyboxManager {
    // ── DIRECTORY MANIFEST (static) ──────────────────────────────────────────
    // Browsers can't scan local folders. To add a custom skybox, drop the image
    // in this.customPath and add its filename here — it appears in Editor
    // Settings automatically. Static so the editor reads it without THREE.js.
    static CUSTOM_MANIFEST = [
        // "nebula_8k.jpg",
        // "sunset_city.png",
        // "alien_planet.jpg"
    ];

    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.textureLoader = new THREE.TextureLoader();
        
        // The directory path where custom skyboxes are stored
        this.customPath = '../custom/skybox/';
        
        // Custom skyboxes: add filenames to the static CUSTOM_MANIFEST below
        // (kept static so the editor can read it WITHOUT constructing this class,
        // which would require THREE.js).
        this.customManifest = SkyboxManager.CUSTOM_MANIFEST;
    }

    // Static method used by the Editor UI to populate the dropdown menu dynamically.
    // IMPORTANT: this must NOT construct a SkyboxManager — the constructor uses
    // THREE.TextureLoader, and the Mapster editor doesn't load THREE.js, so
    // instantiating here threw and left the dropdown blank. The custom manifest
    // is static data, so we read it from the static CUSTOM_MANIFEST below.
    static getAvailableSkyboxes() {
        const defaults = [
            { id: 'black', name: 'Deep Space Black' },
            { id: 'white', name: 'Blank Void White' },
            { id: 'sky', name: 'Procedural Retro Sky' }
        ];
        const customs = SkyboxManager.CUSTOM_MANIFEST.map(filename => ({
            id: `custom_${filename}`,
            name: `Custom: ${filename}`
        }));
        return [...defaults, ...customs];
    }

    // Applies the selected skybox to the active Three.js scene
    setSkybox(type) {
        if (!this.scene) return;
        
        // Purge existing backgrounds to prevent memory leaks
        this.scene.background = null;
        this.scene.environment = null;

        // Route to custom image loader if the ID matches a custom manifest entry
        if (type.startsWith('custom_')) {
            const filename = type.replace('custom_', '');
            this.loadEquirectangular(this.customPath + filename);
            return;
        }

        // Apply Built-in Procedural Defaults
        switch(type) {
            case 'black':
                this.scene.background = new THREE.Color(0x050510);
                break;
            case 'white':
                this.scene.background = new THREE.Color(0xffffff);
                break;
            case 'sky':
                // Procedural vertical gradient for a retro sky
                const canvas = document.createElement('canvas');
                canvas.width = 2;
                canvas.height = 512;
                const context = canvas.getContext('2d');
                const gradient = context.createLinearGradient(0, 0, 0, 512);
                gradient.addColorStop(0, '#0e2b4d');     // Deep high sky
                gradient.addColorStop(0.5, '#4584b4');   // Mid sky
                gradient.addColorStop(1, '#87CEEB');     // Horizon
                context.fillStyle = gradient;
                context.fillRect(0, 0, 2, 512);
                const tex = new THREE.CanvasTexture(canvas);
                this.scene.background = tex;
                break;
            default:
                this.scene.background = new THREE.Color(0x050510);
        }
    }

    loadEquirectangular(url) {
        this.textureLoader.load(
            url, 
            (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                if (typeof THREE.sRGBEncoding !== 'undefined') texture.encoding = THREE.sRGBEncoding;
                
                this.scene.background = texture;
                // Applying it to environment allows reflective surfaces (like mirrors) to accurately reflect the custom sky!
                this.scene.environment = texture; 
            }, 
            undefined, 
            (err) => {
                console.error(`SkyboxManager: Failed to load custom skybox at ${url}. Falling back to default black.`, err);
                this.setSkybox('black');
            }
        );
    }
}

// Export for module systems or attach to the global window
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SkyboxManager;
} else if (typeof window !== 'undefined') {
    window.SkyboxManager = SkyboxManager;
}