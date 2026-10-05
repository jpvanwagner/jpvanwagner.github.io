/**
 * Mapster - Weather & Particle Manager (Modular)
 * Hosts the central particle system and delegates physics updates to registered weather modules (like rain.js and snow.js).
 */

class WeatherManager {
    constructor(scene) {
        this.scene = scene;
        this.textureLoader = typeof THREE !== 'undefined' ? new THREE.TextureLoader() : null;
        
        // Path for custom weather particle textures
        this.customPath = '../custom/weather/';
        
        // =====================================================================
        // DIRECTORY MANIFEST
        // =====================================================================
        // Add custom weather filenames here to auto-load them into the UI!
        // E.g., "leaves.png", "ash.png", "blood_rain.png"
        this.customManifest = [
            
        ];

        // Registry for modular weather behaviors
        this.behaviors = {};
        this.activeBehavior = null;

        // Load modular Rain if it exists in the environment
        if (typeof RainWeather !== 'undefined') {
            this.registerBehavior(RainWeather);
        }
        
        // Load modular Snow if it exists in the environment
        if (typeof SnowWeather !== 'undefined') {
            this.registerBehavior(SnowWeather);
        }

        // Built-in fallback behavior (in case external modules aren't loaded in the HTML)
        this.registerBehavior({
            id: 'fallback_snow',
            name: 'Snow (Fallback)',
            size: 0.15,
            color: 0xffffff,
            texturePath: null,
            update: function(positions, time, dt) {
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i+1] -= 5 * dt; // Y axis falling
                    if (positions[i+1] < 0) positions[i+1] = 20;
                    positions[i] += Math.sin(time + i) * 0.05; // X axis drifting
                }
            }
        });

        // Initialize the Single Central Particle System (High Performance).
        // Denser field (was 1500) packed into a tighter box around the player
        // so precipitation actually reads on screen instead of a few stray dots.
        const particleCount = 4000;
        this.particleCount = particleCount;
        this.boxSize = 30;   // full width of the cube the particles live in
        const pGeo = typeof THREE !== 'undefined' ? new THREE.BufferGeometry() : null;
        this.pMats = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i++) {
            this.pMats[i] = (Math.random() - 0.5) * this.boxSize;
        }

        if (pGeo) {
            pGeo.setAttribute('position', new THREE.BufferAttribute(this.pMats, 3));
            this.pMaterial = new THREE.PointsMaterial({
                color: 0xffffff,
                size: 0.1,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                // NormalBlending (not Additive): rain/snow must stay visible
                // against a bright procedural sky, not wash out against it.
                blending: THREE.NormalBlending,
                sizeAttenuation: true,
            });
            this.weatherSys = new THREE.Points(pGeo, this.pMaterial);
            this.scene.add(this.weatherSys);
        }
        
        this.curWeather = 'none';
    }

    registerBehavior(behaviorObj) {
        this.behaviors[behaviorObj.id] = behaviorObj;
    }

    // Static method used by the Mapster Editor UI to populate the dropdown menu dynamically
    static getAvailableWeather() {
        const temp = new WeatherManager({ add: () => {} });
        const defaults = [{ id: 'none', name: 'No Weather' }];
        
        // Dynamically add registered modules (skip the internal fallback)
        Object.values(temp.behaviors).forEach(b => {
            if (b.id !== 'fallback_snow') {
                defaults.push({ id: b.id, name: b.name });
            }
        });
        
        // Fallback UI population if external files aren't linked yet
        if (!defaults.find(d => d.id === 'rain')) defaults.push({ id: 'rain', name: 'Heavy Rain' });
        if (!defaults.find(d => d.id === 'snow')) defaults.push({ id: 'snow', name: 'Gentle Snow' });
        
        // Dynamically add custom manifests
        const customs = temp.customManifest.map(filename => ({
            id: `custom_${filename}`,
            name: `Custom: ${filename}`
        }));
        
        return [...defaults, ...customs];
    }

    // Procedurally generate a particle sprite so we need no external files and
    // keep the lo-fi look self-contained. kind: 'rain' = a soft vertical streak,
    // 'snow' = a soft round flake. Cached per kind.
    makeParticleTexture(kind) {
        if (typeof document === 'undefined' || typeof THREE === 'undefined') return null;
        this._texCache = this._texCache || {};
        if (this._texCache[kind]) return this._texCache[kind];
        const cv = document.createElement('canvas'); cv.width = 16; cv.height = 32;
        const c = cv.getContext('2d');
        c.clearRect(0, 0, 16, 32);
        if (kind === 'rain') {
            // Vertical streak: bright core fading at the ends.
            const g = c.createLinearGradient(0, 0, 0, 32);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.5, 'rgba(220,235,255,0.95)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(6, 0, 4, 32);
        } else {
            // Round soft flake: radial gradient.
            const g = c.createRadialGradient(8, 8, 0, 8, 8, 8);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.6, 'rgba(255,255,255,0.8)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.beginPath(); c.arc(8, 8, 8, 0, Math.PI * 2); c.fill();
        }
        const tex = new THREE.CanvasTexture(cv);
        this._texCache[kind] = tex;
        return tex;
    }

    /**
     * Checks map configuration and moves the weather system block over the player.
     */
    applyEnvironment(config, floorIndex, playerX, playerZ, currentCell) {
        if (!this.weatherSys) return;

        const fSet = config.fogSettings[floorIndex];
        const flrH = 2.0; // Standard floor height

        let targetWeather = 'none';
        let intensity = 50;

        // Only apply if marked outdoor
        if (fSet?.outdoor || (currentCell && currentCell.f?.meta?.isOutdoor)) {
            targetWeather = fSet?.weather || 'none';
            intensity = fSet?.weatherInt || 50;
        }

        if (this.curWeather !== targetWeather) {
            this.setWeatherType(targetWeather);
        }
        this.curIntensity = intensity;   // expose for grass weather-reaction

        if (targetWeather !== 'none') {
            // Intensity (0–100) drives BOTH opacity and particle size, so low
            // settings = a light drizzle/flurry and high = a downpour/blizzard.
            const t = Math.max(0, Math.min(1, intensity / 100));
            const b = this.activeBehavior || {};
            const baseSize = b.size || 0.3;
            this.pMaterial.opacity = 0.35 + 0.6 * t;          // never fully invisible when on
            this.pMaterial.size = baseSize * (0.6 + 0.8 * t);  // bigger when heavier
            this.weatherSys.visible = true;
            // Keep the particle box centered on the player so the field always
            // surrounds them (box is boxSize wide; center it, sit it at floor Y).
            this.weatherSys.position.set(playerX, flrH * floorIndex, playerZ);
        } else {
            this.pMaterial.opacity = 0;
            this.weatherSys.visible = false;
        }
    }

    /**
     * Loads base aesthetics or swaps in a custom sprite map.
     */
    setWeatherType(type) {
        this.curWeather = type;
        this.activeBehavior = this.behaviors[type] || this.behaviors['fallback_snow'];

        if (!this.pMaterial) return;

        if (type === 'none') {
            this.pMaterial.map = null;
            this.pMaterial.needsUpdate = true;
            return;
        }

        // Handle Custom Sprite Files from manifest
        if (type.startsWith('custom_')) {
            const filename = type.replace('custom_', '');
            this.textureLoader.load(
                this.customPath + filename,
                (texture) => {
                    this.pMaterial.map = texture;
                    this.pMaterial.size = 0.5;
                    this.pMaterial.color.setHex(0xffffff);
                    this.pMaterial.needsUpdate = true;
                },
                undefined,
                (err) => { console.warn(`WeatherManager: custom texture ${filename} not found.`); }
            );
            this.activeBehavior = this.behaviors['snow'] || this.behaviors['fallback_snow'];
        } else if (this.activeBehavior) {
            // Use a procedural sprite (streak for rain, flake for snow) so the
            // particles read as real precipitation, not faint dots.
            const isRain = (type === 'rain');
            const tex = this.activeBehavior.texturePath
                ? null
                : this.makeParticleTexture(isRain ? 'rain' : 'snow');
            this.pMaterial.map = tex;
            this.pMaterial.size = this.activeBehavior.size || (isRain ? 0.5 : 0.4);
            this.pMaterial.color.setHex(this.activeBehavior.color != null ? this.activeBehavior.color : 0xffffff);
            if (this.activeBehavior.texturePath) {
                this.textureLoader.load(this.activeBehavior.texturePath, (t) => { this.pMaterial.map = t; this.pMaterial.needsUpdate = true; });
            }
            this.pMaterial.needsUpdate = true;
        }
    }

    /**
     * Physics tick for particles based on current active weather module.
     */
    update(time, dt) {
        if (this.curWeather === 'none' || !this.weatherSys || this.pMaterial.opacity <= 0) return;

        // Delegate physics to the active modular behavior
        if (this.activeBehavior && typeof this.activeBehavior.update === 'function') {
            this.activeBehavior.update(this.pMats, time, dt);
            this.weatherSys.geometry.attributes.position.needsUpdate = true;
        }
    }
    
    // Allows external modules (like Grass floors) to check if wind is active
    getCurrentWeather() {
        return this.curWeather;
    }
    // Current weather intensity 0..100 (used by grass to scale sway/snow load).
    getIntensity() {
        return (typeof this.curIntensity === 'number') ? this.curIntensity : 50;
    }
    // Convenience: is the current weather a windy/snowy type that grass reacts to?
    isWindy() {
        return ['rain', 'storm', 'snow', 'wind', 'blizzard'].includes(this.curWeather);
    }
}

// Export for module systems or attach to the global window
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeatherManager;
} else if (typeof window !== 'undefined') {
    window.WeatherManager = WeatherManager;
}