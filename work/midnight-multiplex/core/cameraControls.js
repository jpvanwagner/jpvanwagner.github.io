/**
 * Mapster - Camera Controls & Map Rotation Manager
 * Handles Isometric, Free, and First-Person camera logic, plus cinematic swoop animations.
 */

class CameraManager {
    constructor(configSettings, aspect) {
        this.config = configSettings;
        // the ORTHOGRAPHIC view's apparent zoom is its FRUSTUM size, not the
        // camera distance. A map's startZoomDist now also sets the starting
        // frustum (smaller = more zoomed-in) so small rooms aren't lost in a huge
        // frame. We map startZoomDist→frustum roughly 1:1 but keep a sane floor.
        const szd = (configSettings && typeof configSettings.startZoomDist === 'number') ? configSettings.startZoomDist : 14;
        this.frustumSize = Math.max(3, szd * 0.5);
        this.minFrustum = 2.5;
        this.maxFrustum = 28;
        
        // Initialize Cameras
        this.orthCamera = new THREE.OrthographicCamera(
            -this.frustumSize * aspect, this.frustumSize * aspect, 
            this.frustumSize, -this.frustumSize, 1, 1000
        );
        this.perspCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        
        // Define Active State.
        // 'fps' is always first-person. 'fps_toggle' can START in either
        // view per the map's fpsStartView setting ('first' | 'third', default
        // 'third'). 'fps_zoom' always starts zoomed-out (third) and zooms in.
        let startFps = (this.config.camMode === 'fps');
        if (this.config.camMode === 'fps_toggle') {
            startFps = (this.config.fpsStartView === 'first');
        }
        this.activeCam = startFps ? this.perspCamera : this.orthCamera;
        this.listener = null;

        // Core Spatial Variables
        this.isoAngle = Math.PI / 4;
        // a map may request a CLOSER (or farther) starting zoom via
        // config.startZoomDist. Smaller = more zoomed-in. Default 20; the debug
        // room ships ~9 (≈2x+ closer) so it opens nice and tight.
        this.isoDist = (this.config && typeof this.config.startZoomDist === 'number')
            ? this.config.startZoomDist : 20;
        
        // Pitch & Tilt
        this.tiltAngle = 0;
        this.camPitch = Math.atan(1 / Math.sqrt(2)) - this.tiltAngle;
        this._tiltDeg = 0;
        
        // Cinematic State
        this.isCinematic = false;
        this.cinematicMode = 'normal';
        this.tCamPos = new THREE.Vector3();
        this.tLookAt = new THREE.Vector3();
        this.tCamZoom = 1;
    }

    init(startX, startY, startZ) {
        let cX = Math.sin(this.isoAngle) * this.isoDist;
        let cZ = Math.cos(this.isoAngle) * this.isoDist;
        let cY = Math.tan(this.camPitch) * this.isoDist;
        
        this.orthCamera.position.set(startX + cX, startY + cY, startZ + cZ);
        this.perspCamera.position.set(startX, startY + 1.2, startZ);
        this.orthCamera.lookAt(startX, startY, startZ);
    }

    setListener(audioListener) {
        if(this.listener && this.activeCam) this.activeCam.remove(this.listener);
        this.listener = audioListener;
        this.activeCam.add(this.listener);
    }

    resize(aspect) {
        this.orthCamera.left = -this.frustumSize * aspect;
        this.orthCamera.right = this.frustumSize * aspect;
        this.orthCamera.top = this.frustumSize;
        this.orthCamera.bottom = -this.frustumSize;
        this.orthCamera.updateProjectionMatrix();
        
        this.perspCamera.aspect = aspect;
        this.perspCamera.updateProjectionMatrix();
    }

    // InputOffset returns 0..3 — the number of 90° steps the camera has
    // rotated from its default angle. WASD input is rotated by this many
    // steps so "W" is always toward screen-up, regardless of camera angle.
    //
    // For 45° snap modes (iso_45), the camera can sit at 45°-multiples
    // BETWEEN cardinal directions. We snap to whichever cardinal the camera
    // is closest to (using Math.round). For exact 45° angles, we bias toward
    // the next direction so the camera and input rotate together — i.e.
    // pressing E once at 0° rotates the camera 45° and shifts the input
    // mapping by 1 step. This makes single-step rotations feel responsive
    // even in 45° mode.
    get InputOffset() {
        // Normalize angle into [0, 2π) first to avoid negative rounding issues.
        let a = this.isoAngle % (Math.PI * 2);
        if (a < 0) a += Math.PI * 2;
        // #2 FIX: snap the input mapping to whichever cardinal the camera is
        // closest to, rounding at the 45° midpoint TOWARD the direction the
        // camera has turned. So in iso_45, pressing E once (camera → 45°) shifts
        // the WASD mapping by one step immediately, keeping "W = screen-up" as
        // the view rotates. (The previous −epsilon biased 45° back to 0, so the
        // input lagged the camera by a step and movement felt mis-aligned.)
        let d = Math.round((a + 1e-6) / (Math.PI / 2)) % 4;
        if (d < 0) d += 4;
        return d;
    }

    // InputOffset8 returns 0..7 — the number of 45° steps the camera has rotated
    // from north. Used by the FFT-style camera-relative movement mapping
    // (ISO8_DIR in engine.js) so the controls track the camera in 45° increments
    // instead of snapping to the nearest 90° (which lagged a half-step at the
    // in-between angles). isoAngle is always a 45° multiple here (default π/4,
    // Q/E step π/4 in iso_45 / fps_toggle third-person), so this is exact.
    get InputOffset8() {
        let a = this.isoAngle % (Math.PI * 2);
        if (a < 0) a += Math.PI * 2;
        let d = Math.round(a / (Math.PI / 4)) % 8;
        if (d < 0) d += 8;
        return d;
    }

    // new#3: tilt readout for the compass. The ladder runs -30°..+30° in 15°
    // steps; we report the current degrees and the min/max of the range.
    getTiltInfo() {
        const D = Math.PI / 180;
        return { deg: Math.round((this.tiltAngle || 0) / D), min: -30, max: 30, enabled: !!this.config.tiltEnabled };
    }

    handleKeyDown(key) {
        if (key === 't') {
            // Honor the "Enable Upward Tilt Cycle (T)" setting in Mapster.
            if (!this.config.tiltEnabled) {
                if (this.tiltAngle !== 0) {
                    this.tiltAngle = 0;
                    this.camPitch = Math.atan(1 / Math.sqrt(2));
                }
                return false;
            }
            // Cycle the tilt through a sequence that includes BOTH upward and
            // downward tilts so the camera can be angled either way:
            //   0  →  +15° (look UP)  →  +30° (look further UP)
            //      →  -15° (look DOWN) →  -30° (look further DOWN) →  back to 0
            // Positive tiltAngle REDUCES camPitch (camera drops toward eye level
            // = looking up); negative tiltAngle INCREASES camPitch (camera rises
            // = more top-down). We snap through the fixed ladder below.
            const D = Math.PI / 180;
            const ladder = [0, 15 * D, 30 * D, -15 * D, -30 * D];
            // Find current index (closest), advance to next, wrap.
            let idx = 0, best = Infinity;
            ladder.forEach((v, i) => { const d = Math.abs(v - this.tiltAngle); if (d < best) { best = d; idx = i; } });
            this.tiltAngle = ladder[(idx + 1) % ladder.length];
            // new#3: record a human-readable tilt step (sorted low→high) so the
            // compass can show the current tilt and the full range.
            this._tiltDeg = Math.round(this.tiltAngle / D);
            // Base iso pitch minus tilt; clamp so the camera never flips under
            // the floor or past straight-down.
            const base = Math.atan(1 / Math.sqrt(2));
            this.camPitch = Math.max(0.08, Math.min(1.45, base - this.tiltAngle));
            return true;
        }
        if (key === 'v' && this.config.camMode === 'fps_toggle') {
            // #K: don't snap between views — run a short ZOOM transition. Going to
            // first-person, the iso view zooms IN toward the player and then hands
            // off to the FP camera; coming back, drop to the iso camera already
            // zoomed in and zoom OUT to normal. (See _startViewTween / update().)
            this._startViewTween();
            return true;
        }
        if (this.config.camMode.startsWith('iso_') || this.config.camMode === 'free'
            || (this.config.camMode === 'fps_zoom' && this.activeCam === this.orthCamera)
            || (this.config.camMode === 'fps_toggle' && this.activeCam === this.orthCamera)) {
            // #12/#17: when viewing the third-person (orthographic) camera — in
            // iso_*, free, fps_zoom, OR fps_toggle after pressing V — Q/E should
            // orbit the iso camera. (Previously fps_toggle was omitted, so after
            // toggling back out of first-person you couldn't turn the view.)
            let amt = (this.config.camMode === 'iso_90' ? Math.PI/2 : (this.config.camMode === 'free' ? 0.1 : Math.PI/4));
            if (key === 'q') { this.isoAngle -= amt; return true; }
            if (key === 'e') { this.isoAngle += amt; return true; }
        }
        return false;
    }

    handleScroll(deltaY) {
        if (this.isCinematic) return;
        // Special mode: 'fps_zoom' — scrolling in shrinks isoDist; once it
        // drops below the configured threshold the camera becomes first-person,
        // and scrolling back out past the threshold returns to isometric.
        if (this.config.camMode === 'fps_zoom') {
            this.isoDist = Math.max(2, Math.min(40, this.isoDist + (deltaY > 0 ? 1.5 : -1.5)));
            const threshold = this.config.fpsZoomDist || 6;
            const wantFps = this.isoDist <= threshold;
            const isFps = this.activeCam === this.perspCamera;
            // while still third-person, drive the ORTHOGRAPHIC zoom so the
            // view visibly zooms in as you scroll toward the threshold (just
            // moving an ortho camera closer doesn't enlarge the image — only the
            // frustum zoom does). Map isoDist∈[threshold, threshold+12] → zoom
            // ∈[~2.4, 1] so it grows smoothly right up to the FPS hand-off.
            if (!wantFps) {
                const span = 12;
                const t = Math.max(0, Math.min(1, (this.isoDist - threshold) / span));
                this.tCamZoom = 1 + (1 - t) * 1.4;   // 1.0 (far) … 2.4 (near threshold)
            }
            if (wantFps && !isFps) {
                if (this.listener) this.activeCam.remove(this.listener);
                this.activeCam = this.perspCamera;
                if (this.listener) this.activeCam.add(this.listener);
            } else if (!wantFps && isFps) {
                if (this.listener) this.activeCam.remove(this.listener);
                this.activeCam = this.orthCamera;
                if (this.listener) this.activeCam.add(this.listener);
            }
            return;
        }
        // Three zoom modes, set by Mapster's "Camera Zoom" dropdown:
        //   'locked'      — no zoom at all; scroll wheel ignored.
        //   'incremental' — discrete zoom levels (1x, 1.5x, 2x, 3x, 4x).
        //                   Each scroll click steps one level.
        //   'free'        — continuous zoom by adjusting isoDist (distance
        //                   from player). Older behavior, smooth.
        if (this.config.zoomMode === 'free') {
            this.isoDist = Math.max(5, Math.min(50, this.isoDist + (deltaY > 0 ? 2 : -2)));
            return;
        }
        if (this.config.zoomMode === 'incremental') {
            // tCamZoom is the orthographic-camera target zoom level lerped
            // toward each frame in tick(). Default is 1; we step in / out.
            const steps = [1, 1.5, 2, 3, 4];
            // Find nearest step to current target.
            let idx = 0; let best = Infinity;
            steps.forEach((s, i) => { const d = Math.abs(s - this.tCamZoom); if (d < best) { best = d; idx = i; } });
            if (deltaY < 0)      idx = Math.min(steps.length - 1, idx + 1);   // scroll up = zoom in
            else if (deltaY > 0) idx = Math.max(0, idx - 1);                   // scroll down = zoom out
            this.tCamZoom = steps[idx];
        }
        // 'locked' falls through with no action.
    }

    startCinematic(type, targetPos, playerPos, overheadDist, overheadRot) {
        this.isCinematic = true;
        this.cinematicMode = type;
        // #14: remember the player's current zoom so we can RESTORE it when the
        // cinematic ends — otherwise stopCinematic reset it to 1 and the map
        // "zoomed back out" after every dialogue, losing the player's zoom level.
        this._savedCamZoom = this.tCamZoom;
        
        if (type === 'fps') {
            // Position the camera looking AT the target, but never let it sit
            // inside or past the target (which would clip through the NPC/object
            // the swoop is meant to focus on). We place the camera a fixed
            // standoff distance back from the target, along the line from the
            // target to the player, and clamp so it never crosses the target.
            const eye = new THREE.Vector3(0, 0.8, 0);
            const tgt = targetPos.clone().add(eye);
            const ply = playerPos.clone().add(eye);
            const toPlayer = new THREE.Vector3().subVectors(ply, tgt);
            const dist = toPlayer.length();
            const standoff = 1.6;                       // min focus distance from target
            if (dist < 0.001) {
                // Player essentially on top of target — back off along -Z.
                this.tCamPos.copy(tgt).add(new THREE.Vector3(0, 0, standoff));
            } else {
                // Camera sits `standoff` from the target toward the player, but
                // never further than the player's own position.
                const useDist = Math.min(standoff, dist);
                this.tCamPos.copy(tgt).add(toPlayer.normalize().multiplyScalar(useDist));
            }
            this.tLookAt.copy(tgt);
        } else if (type === 'close') {
            this.tCamPos.copy(targetPos).add(new THREE.Vector3(2, 2, 2));
            this.tCamZoom = 4;
            this.tLookAt.copy(targetPos);
        } else if (type === 'overhead') {
            this.tCamPos.copy(targetPos).add(new THREE.Vector3(0, overheadDist || 10, 0));
            this.tCamZoom = 1;
            this.tLookAt.copy(targetPos);
            if (overheadRot && overheadRot !== 'keep') {
                this.isoAngle = parseInt(overheadRot) * (Math.PI / 2);
            }
        } else {
            this.tCamPos.copy(targetPos).add(new THREE.Vector3(5, 5, 5));
            this.tCamZoom = 2;
            this.tLookAt.copy(targetPos);
        }
    }

    stopCinematic() {
        this.isCinematic = false;
        // #14: restore the player's pre-dialogue zoom rather than snapping to 1
        // (that snap was the unwanted "zoom back out" after a conversation).
        this.tCamZoom = (this._savedCamZoom != null) ? this._savedCamZoom : this.tCamZoom;
    }

    // #K: FIRST-PERSON ZOOM TRANSITION (V toggle in fps_toggle mode). Rather than
    // hard-cutting between the iso (orthographic) and FP (perspective) cameras, we
    // briefly zoom the iso camera toward/away from the player around the swap so
    // the change reads as moving INTO / OUT OF the character's eyes.
    // HOW TO MODIFY: config.fpZoomPeak = how far the iso view zooms in (default 3.2);
    // dur below = transition seconds.
    _startViewTween() {
        if (this._viewTween && this._viewTween.active) return;
        const peak = (this.config && this.config.fpZoomPeak) || 5.0;   // #11: more dramatic zoom
        if (this.activeCam === this.orthCamera) {
            // 3P → FP: zoom the iso view IN, then hand off to the FP camera at the end.
            this._viewTween = { active: true, dir: 'toFps', t: 0, dur: 0.34, peak: peak };
        } else {
            // FP → 3P: drop to the iso camera already zoomed in, then zoom OUT.
            if (this.listener) this.activeCam.remove(this.listener);
            this.activeCam = this.orthCamera;
            if (this.listener) this.activeCam.add(this.listener);
            this.orthCamera.zoom = peak; this.orthCamera.updateProjectionMatrix();
            this._viewTween = { active: true, dir: 'toIso', t: 0, dur: 0.30, peak: peak };
        }
    }
    _advanceViewTween(dt) {
        this._tweenZoom = null;
        const vt = this._viewTween;
        if (!vt || !vt.active) return;
        vt.t += dt / vt.dur;
        const tt = Math.min(1, vt.t);
        const ease = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
        if (vt.dir === 'toFps') {
            this._tweenZoom = 1 + (vt.peak - 1) * ease;
            if (tt >= 1) {   // hand off to the FP camera
                if (this.listener) this.activeCam.remove(this.listener);
                this.activeCam = this.perspCamera;
                if (this.listener) this.activeCam.add(this.listener);
                this.orthCamera.zoom = 1; this.orthCamera.updateProjectionMatrix();
                vt.active = false; this._tweenZoom = null;
            }
        } else {   // toIso: zoom back out to normal
            this._tweenZoom = vt.peak + (1 - vt.peak) * ease;
            if (tt >= 1) { this._tweenZoom = 1; vt.active = false; }
        }
    }

    update(dt, player) {
        // #K: advance any V-toggle view ZOOM transition first (it may swap activeCam).
        this._advanceViewTween(dt);
        // #11: while zooming INTO first-person, swing the iso view around to sit
        // BEHIND the player (over-the-shoulder) and ease toward their heading, so
        // the handoff lands already facing where they look — it reads as turning
        // into their eyes, not just a flat zoom.
        if (this._viewTween && this._viewTween.active && this._viewTween.dir === 'toFps' && player) {
            const vt = this._viewTween;
            if (vt._angleStart === undefined) {
                vt._angleStart = this.isoAngle;
                let d = (player.rotation.y + Math.PI) - this.isoAngle;
                d = Math.atan2(Math.sin(d), Math.cos(d));   // shortest way round
                vt._angleTarget = this.isoAngle + d;
            }
            const tt = Math.min(1, vt.t);
            const ease = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
            this.isoAngle = vt._angleStart + (vt._angleTarget - vt._angleStart) * ease;
        }
        let renderCam = this.activeCam;

        if (this.isCinematic) {
            if (this.cinematicMode === 'fps') {
                this.perspCamera.position.copy(this.tCamPos);
                this.perspCamera.lookAt(this.tLookAt);
                renderCam = this.perspCamera;
            } else {
                this.activeCam.position.lerp(this.tCamPos, 8 * dt);
                if (this.activeCam.isOrthographicCamera) {
                    this.activeCam.zoom += (this.tCamZoom - this.activeCam.zoom) * 8 * dt;
                    this.activeCam.updateProjectionMatrix();
                } else {
                    this.activeCam.rotation.set(0, player.rotation.y, 0);
                }
                this.activeCam.lookAt(this.tLookAt);
            }
        } else if (this.config.camMode === 'fps' || (this.config.camMode === 'fps_toggle' && this.activeCam === this.perspCamera) || (this.config.camMode === 'fps_zoom' && this.activeCam === this.perspCamera)) {
            this.activeCam.position.copy(player.position);
            this.activeCam.position.y += 0.8;
            this.activeCam.rotation.set(0, player.rotation.y, 0);
        } else {
            // SMOOTH the orbit ANGLE only (so Q/E rotation sweeps), but follow the
            // player's POSITION RIGIDLY with a constant offset. The old code lerped
            // the whole camera position toward a target derived from the moving
            // player, so every per-tile start/stop made the camera rubber-band —
            // the "wobble" when walking. A constant offset tracks the player exactly.
            if (this._isoAngleSmooth === undefined) this._isoAngleSmooth = this.isoAngle;
            let da = ((this.isoAngle - this._isoAngleSmooth + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            this._isoAngleSmooth += da * Math.min(1, 12 * dt);
            if (Math.abs(da) < 0.0005) this._isoAngleSmooth = this.isoAngle;
            let cX = Math.sin(this._isoAngleSmooth) * this.isoDist;
            let cZ = Math.cos(this._isoAngleSmooth) * this.isoDist;
            let cY = Math.tan(this.camPitch) * this.isoDist;
            // look slightly ABOVE the player's feet (at torso height) so the
            // character sits vertically centered in the panel rather than low.
            const lookBiasY = 0.9;
            const focus = player.position.clone(); focus.y += lookBiasY;
            // Normally the focus tracks the player RIGIDLY (no wobble). During a
            // stair/ladder CLIMB we let it LAG, so the player visibly rises/lowers
            // in the frame and the move reads as traversal instead of a teleport.
            // A high catch-up rate when not climbing keeps it effectively rigid and
            // lets it ease back to centre smoothly once the climb ends (no snap).
            if (!this._focusSmooth) this._focusSmooth = focus.clone();
            const climbing = (typeof window !== 'undefined' && window.__climbing);
            const rate = climbing ? 3.5 : 60;
            this._focusSmooth.lerp(focus, Math.min(1, rate * dt));
            const f = this._focusSmooth;
            this.activeCam.position.copy(f).add(new THREE.Vector3(cX, cY, cZ));   // rigid follow normally; lagged during a climb
            if (this.activeCam.isOrthographicCamera) {
                if (this._tweenZoom != null) {
                    // #K: during a V-toggle transition, drive the zoom directly from
                    // the eased tween so the zoom-in/out is crisp.
                    this.activeCam.zoom = this._tweenZoom;
                    this.activeCam.updateProjectionMatrix();
                } else {
                    // Zoom target depends on mode:
                    //   'incremental' — driven by mouse wheel (see handleScroll).
                    //                   tCamZoom holds the latest step (1/1.5/2/3/4).
                    //   'free'        — distance-based zoom; orthographic 'zoom'
                    //                   stays at 1 and isoDist does the work.
                    //   'locked'      — fixed at 1.
                    const targetZoom = (this.config.zoomMode === 'incremental' || this.config.camMode === 'fps_zoom') ? this.tCamZoom : 1;
                    this.activeCam.zoom += (targetZoom - this.activeCam.zoom) * 10 * dt;
                    this.activeCam.updateProjectionMatrix();
                }
            }
            this.activeCam.lookAt(f);
        }

        return renderCam;
    }
}