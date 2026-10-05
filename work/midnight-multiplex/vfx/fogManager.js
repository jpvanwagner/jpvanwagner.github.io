/**
 * Mapster - Fog & Atmosphere Manager
 * Handles global fog, local volumetric fog emitters, and weather particle systems (rain/snow/mist).
 */

class FogManager {
    constructor(scene, config, defaultBgColor) {
        this.scene = scene;
        this.config = config;
        this.defaultBgColor = defaultBgColor || 0x0a0a1a;
        
        this.localFogs = [];
        
        // Initialize Weather Particle System (Used for Mist/Rain/Snow)
        const particleCount = 1500;
        const pGeo = new THREE.BufferGeometry();
        this.pMats = new Float32Array(particleCount * 3);
        
        for(let i = 0; i < particleCount * 3; i++) {
            this.pMats[i] = (Math.random() - 0.5) * 50;
        }
        
        pGeo.setAttribute('position', new THREE.BufferAttribute(this.pMats, 3));
        this.pMaterial = new THREE.PointsMaterial({color: 0xffffff, size: 0.1, transparent: true, opacity: 0});
        this.weatherSys = new THREE.Points(pGeo, this.pMaterial);
        this.scene.add(this.weatherSys);
        
        this.curWeather = 'none';
    }

    /**
     * Applies floor-wide fog and atmospheric weather based on outdoor status.
     * Replaces the old 'applyFloorFog' logic.
     */
    applyEnvironment(floorIndex, playerX, playerZ, currentCell) {
        const fSet = this.config.fogSettings[floorIndex];
        
        // 1. Global Floor Fog (Distance-based visibility reduction)
        if (fSet && fSet.enabled) {
            // density slider is 1..100. FogExp2 fog is exponential in DISTANCE, so
            // the old /1000 (=> 0.02 at the default 20) was imperceptible in normal
            // room-sized maps — fog "did nothing." /250 makes the slider meaningful:
            // 20 -> ~0.08 (clearly hazy by ~10 tiles), 100 -> 0.4 (pea-soup).
            this.scene.fog = new THREE.FogExp2(fSet.color, fSet.density / 250);
            this.scene.background = new THREE.Color(fSet.color);
        } else {
            this.scene.fog = null;
            // Revert to default background color if no skybox is active
            if (this.scene.background instanceof THREE.Color) {
                this.scene.background = new THREE.Color(this.defaultBgColor);
            }
        }

        // 2. Weather / Mist Particles
        const flrH = 2.0; // Standard floor height
        if (fSet?.outdoor || (currentCell && currentCell.f?.meta?.isOutdoor)) {
            this.pMaterial.opacity = (fSet.weatherInt || 50) / 100;
            this.weatherSys.position.set(playerX, flrH * floorIndex, playerZ);
            this.curWeather = fSet?.weather || 'none';
        } else {
            this.pMaterial.opacity = 0;
            this.curWeather = 'none';
        }
    }

    /**
     * Spawns a localized volumetric fog/mist cloud around an object.
     * @param {THREE.Object3D} parentGroup - The mesh/scene to attach the fog to.
     * @param {string} color - Hex color code for the fog.
     * @param {number} density - Opacity thickness.
     * @param {boolean} billow - Whether the fog should pulse/rotate.
     * @param {THREE.Vector3} positionOffset - Local offset positioning.
     */
    addLocalFog(parentGroup, color, density, billow, positionOffset) {
        // A convincing little fog VOLUME: several overlapping soft puffs rather
        // than one tiny faint sphere (the old single 1.5r additive sphere at
        // opacity 0.1 was basically invisible — "adding fog did nothing"). The
        // cloud grows and thickens with density, and billows in update().
        const d = (density || 5);
        const op = Math.min(0.55, 0.12 + d / 40);     // density 5 -> ~0.24, 15 -> ~0.49
        const baseR = 1.4 + d * 0.06;                 // grows with density
        const group = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({
            color: color || '#cfd8e3',
            transparent: true,
            opacity: op,
            depthWrite: false,
            blending: THREE.NormalBlending                // reads as haze, not a glow
        });
        const puffs = [[0, 0, 0, 1], [0.9, 0.15, 0.4, 0.7], [-0.8, 0.1, -0.5, 0.7], [0.4, 0.45, -0.7, 0.6], [-0.5, 0.4, 0.7, 0.6]];
        puffs.forEach(p => {
            const m = new THREE.Mesh(new THREE.SphereGeometry(baseR * p[3], 10, 10), mat.clone());
            m.position.set(p[0] * baseR * 0.6, p[1] * baseR * 0.5, p[2] * baseR * 0.6);
            group.add(m);
        });
        if (positionOffset) group.position.copy(positionOffset);
        parentGroup.add(group);
        this.localFogs.push({ mesh: group, billow: billow });
        return group;
    }

    /**
     * Main animation tick for billowing local fogs and falling weather particles.
     */
    update(time, dt) {
        // Animate Local Volumetric Fog
        this.localFogs.forEach(item => {
            if (item.billow) {
                let s = 1 + Math.sin(time * 2 + item.mesh.position.x) * 0.1;
                item.mesh.scale.set(s, s, s);
                item.mesh.rotation.y += 0.01;
            }
        });

        // Animate Global Weather Particles
        if (this.curWeather === 'rain') {
            for (let i = 1; i < this.pMats.length; i += 3) {
                this.pMats[i] -= 20 * dt;
                if (this.pMats[i] < 0) this.pMats[i] = 20;
            }
            this.weatherSys.geometry.attributes.position.needsUpdate = true;
        } else if (this.curWeather === 'snow') {
            for (let i = 0; i < this.pMats.length; i += 3) {
                this.pMats[i+1] -= 5 * dt; // Y axis falling
                if (this.pMats[i+1] < 0) this.pMats[i+1] = 20;
                this.pMats[i] += Math.sin(time + i) * 0.05; // X axis drifting
            }
            this.weatherSys.geometry.attributes.position.needsUpdate = true;
        }
    }
}

// Export for module systems or attach to the global window
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FogManager;
} else if (typeof window !== 'undefined') {
    window.FogManager = FogManager;
}