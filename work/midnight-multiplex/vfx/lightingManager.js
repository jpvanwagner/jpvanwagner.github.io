/**
 * Mapster - Lighting & VFX Manager
 * Handles shadows, ambient environments, flashlights, and animated light fixtures.
 */

class LightingManager {
    constructor(scene, renderer, config) {
        this.scene = scene;
        this.config = config;
        
        this.advLights = [];
        this.lightNet = {}; // Maps Link IDs to arrays of PointLights
        
        // 1. Centralized Shadow Configuration
        if (renderer) {
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        
        // 2. Base Environment Lights
        this.mainAmb = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(this.mainAmb);
        
        this.mainDir = new THREE.DirectionalLight(0xffffff, 0.3);
        this.mainDir.position.set(10, 20, 10);
        this.mainDir.castShadow = true;
        // Realistic-sized + SOFT shadows: a TIGHT shadow frustum focused on the
        // playable area (was ±20, which spread the 512² default map so thin that
        // shadows came out blocky and oversized) plus a HIGH-RES map and a PCF
        // blur radius. This is the primary "key light" shadow every object casts.
        this.mainDir.shadow.camera.left = -14;
        this.mainDir.shadow.camera.right = 14;
        this.mainDir.shadow.camera.top = 14;
        this.mainDir.shadow.camera.bottom = -14;
        this.mainDir.shadow.camera.near = 0.5;
        this.mainDir.shadow.camera.far = 60;
        this.mainDir.shadow.mapSize.set(2048, 2048); // crisp, properly-scaled shadows
        this.mainDir.shadow.radius = 1.5;            // soft-ish PCF edges (in-between)
        this.mainDir.shadow.bias = -0.0005; // Prevent shadow acne
        this.scene.add(this.mainDir);
        
        // 3. Player Flashlight (SpotLight). Inert until toggled ON — intensity 0
        // AND castShadow false so it neither lights nor reserves a shadow map (a
        // shadow-casting spotlight at intensity 0 can still subtly affect the
        // scene in r128, which read as "the player emits light").
        this.playerSpotlight = new THREE.SpotLight(0xffffff, 0, 15, Math.PI/6, 0.5, 1);
        this.playerSpotlight.position.set(0, 0.8, -0.2);
        this.playerSpotlight.target.position.set(0, 0.8, -1);
        this.playerSpotlight.castShadow = false;
        this.playerSpotlight.visible = false;
    }

    getPlayerLight() {
        return this.playerSpotlight;
    }

    toggleFlashlight() {
        const on = !(this.playerSpotlight.intensity > 0);
        this.playerSpotlight.intensity = on ? 1.5 : 0;
        this.playerSpotlight.castShadow = on;
        this.playerSpotlight.visible = on;
    }

    // #14: read-only flashlight state for the minimap reveal logic.
    isFlashlightOn() {
        return !!(this.playerSpotlight && this.playerSpotlight.intensity > 0);
    }

    /**
     * Factory function to dynamically create and bind a PointLight.
     * @param {THREE.Object3D} parentGroup - The mesh/group to attach the light to.
     * @param {string|number} color - Hex color code.
     * @param {number} intensity - Base illumination strength.
     * @param {number} distance - Falloff distance.
     * @param {object} meta - Configuration object containing flicker/link data.
     * @param {THREE.Vector3} positionOffset - Local offset from the parent.
     */
    addLight(parentGroup, color, intensity, distance, meta, positionOffset) {
        const baseIntensity = intensity !== undefined ? intensity : 1;
        const pl = new THREE.PointLight(color || 0xffffff, baseIntensity, distance || 10);
        
        if (positionOffset) {
            pl.position.copy(positionOffset);
        }
        
        // r128's WebGLRenderer supports only a small number of SHADOW-casting
        // lights; once exceeded, extra shadow lights are silently dropped and the
        // scene's lighting looks broken. Decorative lights (neon, sconces,
        // backlights) therefore do NOT cast shadows — only primary room lights
        // (ceiling fixtures) should, via meta.castShadow. This is why neon
        // "didn't emit light": its shadow-casting lights were being culled. (#9)
        pl.castShadow = (meta && meta.castShadow === true);
        if (pl.castShadow) {
            // Keep point-light shadows SOFT and reasonably sized rather than the
            // harsh, oversized default: a modest map, a PCF blur radius, a near
            // plane so close objects don't blow up the shadow, and a bias to
            // avoid acne. (Decorative lights pass castShadow:false and skip this.)
            pl.shadow.mapSize.set(1024, 1024);
            pl.shadow.radius = 1.5;
            pl.shadow.bias = -0.0008;
            pl.shadow.camera.near = 0.3;
            pl.shadow.camera.far = (distance || 10) + 2;
        }
        pl.userData.isOn = true;
        pl.userData.baseIntensity = baseIntensity;
        
        parentGroup.add(pl);
        
        // Register to Light Network (for switches)
        const lID = meta.linkId || 'main';
        if (!this.lightNet[lID]) this.lightNet[lID] = [];
        this.lightNet[lID].push(pl);
        
        // Register to Animation Loop
        if (meta.flicker) {
            this.advLights.push({
                light: pl,
                meta: meta,
                baseColor: pl.color.clone(),
                timeOffset: Math.random() * 100
            });
        }
        
        return pl;
    }

    /**
     * Toggles the on/off state of all lights associated with a specific link ID.
     */
    toggleLightNetwork(linkId, overrideIntensity) {
        if (this.lightNet[linkId]) {
            this.lightNet[linkId].forEach(l => {
                l.userData.isOn = !l.userData.isOn;
                l.intensity = l.userData.isOn ? (overrideIntensity || l.userData.baseIntensity) : 0;
            });
        }
    }

    /**
     * Processes physics and variable conditions for all animated lights.
     */
    update(time, envContext) {
        this.advLights.forEach(item => {
            let m = item.meta;
            let active = true;
            
            // Check contextual environment variables if required
            if (m.condVar && envContext) {
                active = (envContext[m.condVar] == m.condVal);
                if (m.condReverse) active = !active;
            }
            
            if (active && item.light.userData.isOn) {
                if (m.flickerMode === 'normal') {
                    let wave = Math.sin(time * m.flickerSpeed + item.timeOffset);
                    let noise = Math.random() * ((m.flickerChaos || 5) / 10);
                    item.light.intensity = (wave + noise > 0) ? item.light.userData.baseIntensity : 0;
                } else if (m.flickerMode === 'strobe') {
                    let cArr = (m.strobeColors || '#fff').split(',');
                    let idx = Math.floor(time * m.flickerSpeed) % cArr.length;
                    item.light.color.setStyle(cArr[idx]);
                } else if (m.flickerMode === 'crossfade') {
                    let cArr = (m.strobeColors || '#fff').split(',');
                    let c1 = new THREE.Color(cArr[Math.floor(time * m.flickerSpeed) % cArr.length]);
                    let c2 = new THREE.Color(cArr[Math.ceil(time * m.flickerSpeed) % cArr.length]);
                    item.light.color.copy(c1).lerp(c2, (time * m.flickerSpeed) % 1);
                }
            } else if (!item.light.userData.isOn) {
                item.light.intensity = 0;
            } else {
                // Return to default static state
                item.light.intensity = item.light.userData.baseIntensity;
                item.light.color.copy(item.baseColor);
            }
        });
    }
}

// Export for module systems or attach to the global window
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LightingManager;
} else if (typeof window !== 'undefined') {
    window.LightingManager = LightingManager;
}