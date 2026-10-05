/**
 * CLOCK-TIMERS.JS - The Stopwatch and Alarm Timer windows, opened from the Clock app.
 * Adds methods onto window.ClockApp (defined in clock.js, which must load first).
 */
Object.assign(window.ClockApp, {
    // ==========================================
    // STOPWATCH LOGIC
    // ==========================================
    openStopwatch() {
        const id = 'stopwatch-' + Date.now();
        
        this.stopwatches[id] = {
            startTime: 0,
            elapsedTime: 0,
            interval: null,
            isRunning: false
        };

        const html = `
            <div id="sw-container-${id}" style="padding:10px; background:var(--ui-face); color:var(--ui-text); font-family:var(--user-font, sans-serif); height:100%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; gap:10px;">
                <div id="sw-display-${id}" style="background:#fff; color:#000; border:2px inset var(--ui-dark); width:100%; text-align:center; font-family:monospace; font-size:24px; padding:10px 0; font-weight:bold; letter-spacing:2px;">
                    00:00:00.00
                </div>
                <div style="display:flex; gap:10px; width:100%;">
                    <button id="sw-btn-${id}" class="bevel-out" onclick="window.ClockApp.toggleStopwatch('${id}')" onmousedown="this.classList.replace('bevel-out','bevel-in')" onmouseup="this.classList.replace('bevel-in','bevel-out')" onmouseleave="this.classList.replace('bevel-in','bevel-out')" style="flex:2; padding:5px; font-weight:bold; cursor:pointer;">START</button>
                    <button class="bevel-out" onclick="window.ClockApp.resetStopwatch('${id}')" onmousedown="this.classList.replace('bevel-out','bevel-in')" onmouseup="this.classList.replace('bevel-in','bevel-out')" onmouseleave="this.classList.replace('bevel-in','bevel-out')" style="flex:1; padding:5px; cursor:pointer;">Reset</button>
                </div>
            </div>
        `;

        if (typeof WM !== 'undefined') {
            // Randomize spawn slightly so multiple windows cascade
            const offset = Math.floor(Math.random() * 40) - 20; 
            
            WM.open(id, 'Stopwatch', html, 'images/icons/os/clock.png');
            
            setTimeout(() => {
                const win = document.getElementById('window-' + id);
                if (win) {
                    win.style.width = '240px';
                    win.style.height = '140px';
                    win.style.left = (window.innerWidth / 2 - 120 + offset) + 'px';
                    win.style.top = (window.innerHeight / 2 - 70 + offset) + 'px';
                }
            }, 50);
        }
    },

    toggleStopwatch(id) {
        const sw = this.stopwatches[id];
        if (!sw) return;

        const btn = document.getElementById(`sw-btn-${id}`);

        if (sw.isRunning) {
            clearInterval(sw.interval);
            sw.isRunning = false;
            if(btn) { btn.innerText = "START"; btn.style.color = ""; }
        } else {
            sw.startTime = Date.now() - sw.elapsedTime;
            sw.interval = setInterval(() => this.updateStopwatchTick(id), 10);
            sw.isRunning = true;
            if(btn) { btn.innerText = "STOP"; btn.style.color = "#a00000"; }
        }
    },

    resetStopwatch(id) {
        const sw = this.stopwatches[id];
        if (!sw) return;

        clearInterval(sw.interval);
        sw.isRunning = false;
        sw.elapsedTime = 0;
        
        const display = document.getElementById(`sw-display-${id}`);
        const btn = document.getElementById(`sw-btn-${id}`);
        if (display) display.innerText = "00:00:00.00";
        if (btn) { btn.innerText = "START"; btn.style.color = ""; }
    },

    updateStopwatchTick(id) {
        const win = document.getElementById('window-' + id);
        const sw = this.stopwatches[id];
        
        // Garbage Collection: If window was closed by user, kill the interval
        if (!win) {
            clearInterval(sw.interval);
            delete this.stopwatches[id];
            return;
        }

        sw.elapsedTime = Date.now() - sw.startTime;
        
        let ms = sw.elapsedTime;
        let totalSec = Math.floor(ms / 1000);
        let hours = Math.floor(totalSec / 3600);
        let mins = Math.floor((totalSec % 3600) / 60);
        let secs = totalSec % 60;
        let millis = Math.floor((ms % 1000) / 10); 

        const display = document.getElementById(`sw-display-${id}`);
        if (display) {
            display.innerText = `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(millis).padStart(2,'0')}`;
        }
    },

    // ==========================================
    // ALARM / TIMER LOGIC
    // ==========================================
    openTimer() {
        const id = 'timer-' + Date.now();
        
        this.timers[id] = {
            durationMs: 0,
            endTime: 0,
            interval: null,
            isRunning: false,
            isRinging: false
        };

        // Build the dropdown options for sounds
        let soundOptions = this.alarmSounds.map(s => `<option value="${s}">${s}</option>`).join('');

        const html = `
            <div id="tmr-container-${id}" style="padding:10px; background:var(--ui-face); color:var(--ui-text); font-family:var(--user-font, sans-serif); height:100%; box-sizing:border-box; display:flex; flex-direction:column; gap:10px;">
                
                <div id="tmr-display-wrap-${id}" style="display:none; flex-direction:column; align-items:center; flex-grow:1; justify-content:center;">
                    <div id="tmr-display-${id}" style="background:#fff; color:#000; border:2px inset var(--ui-dark); width:100%; text-align:center; font-family:monospace; font-size:28px; padding:15px 0; font-weight:bold; letter-spacing:2px; transition: background 0.2s, color 0.2s;">
                        00:00:00
                    </div>
                </div>

                <div id="tmr-input-wrap-${id}" style="display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; gap:5px; text-align:center;">
                        <div>
                            <input type="number" id="tmr-h-${id}" value="0" min="0" max="99" style="width:45px; text-align:center; font-family:monospace; border:2px inset var(--ui-dark);">
                            <div style="font-size:10px; margin-top:2px;">HRS</div>
                        </div>
                        <div style="font-size:20px; font-weight:bold; line-height:24px;">:</div>
                        <div>
                            <input type="number" id="tmr-m-${id}" value="5" min="0" max="59" style="width:45px; text-align:center; font-family:monospace; border:2px inset var(--ui-dark);">
                            <div style="font-size:10px; margin-top:2px;">MIN</div>
                        </div>
                        <div style="font-size:20px; font-weight:bold; line-height:24px;">:</div>
                        <div>
                            <input type="number" id="tmr-s-${id}" value="0" min="0" max="59" style="width:45px; text-align:center; font-family:monospace; border:2px inset var(--ui-dark);">
                            <div style="font-size:10px; margin-top:2px;">SEC</div>
                        </div>
                    </div>
                    
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-top:5px; font-size:11px;">
                        <span>Alarm Sound:</span>
                        <select id="tmr-sound-${id}" style="width:120px; font-family:var(--user-font); font-size:11px; padding:2px;">
                            ${soundOptions}
                        </select>
                    </div>
                </div>

                <div style="display:flex; gap:10px; width:100%; margin-top:auto;">
                    <button id="tmr-btn-${id}" class="bevel-out" onclick="window.ClockApp.toggleTimer('${id}')" onmousedown="this.classList.replace('bevel-out','bevel-in')" onmouseup="this.classList.replace('bevel-in','bevel-out')" onmouseleave="this.classList.replace('bevel-in','bevel-out')" style="flex:2; padding:5px; font-weight:bold; cursor:pointer;">START</button>
                    <button class="bevel-out" onclick="window.ClockApp.resetTimer('${id}')" onmousedown="this.classList.replace('bevel-out','bevel-in')" onmouseup="this.classList.replace('bevel-in','bevel-out')" onmouseleave="this.classList.replace('bevel-in','bevel-out')" style="flex:1; padding:5px; cursor:pointer;">Clear</button>
                </div>
            </div>
        `;

        if (typeof WM !== 'undefined') {
            const offset = Math.floor(Math.random() * 40) - 20; 
            WM.open(id, 'Timer', html, 'images/icons/os/clock.png');
            
            setTimeout(() => {
                const win = document.getElementById('window-' + id);
                if (win) {
                    win.style.width = '250px';
                    win.style.height = '180px';
                    win.style.left = (window.innerWidth / 2 - 125 + offset) + 'px';
                    win.style.top = (window.innerHeight / 2 - 90 + offset) + 'px';
                }
            }, 50);
        }
    },

    toggleTimer(id) {
        const tmr = this.timers[id];
        if (!tmr) return;

        const btn = document.getElementById(`tmr-btn-${id}`);
        const inputWrap = document.getElementById(`tmr-input-wrap-${id}`);
        const displayWrap = document.getElementById(`tmr-display-wrap-${id}`);
        const display = document.getElementById(`tmr-display-${id}`);

        // If it's currently ringing, Stop turns it off entirely
        if (tmr.isRinging) {
            this.resetTimer(id);
            return;
        }

        if (tmr.isRunning) {
            // PAUSE
            clearInterval(tmr.interval);
            tmr.isRunning = false;
            
            // Calculate what is left and update the inputs to match paused state
            const leftMs = Math.max(0, tmr.endTime - Date.now());
            let totalSec = Math.floor(leftMs / 1000);
            document.getElementById(`tmr-h-${id}`).value = Math.floor(totalSec / 3600);
            document.getElementById(`tmr-m-${id}`).value = Math.floor((totalSec % 3600) / 60);
            document.getElementById(`tmr-s-${id}`).value = totalSec % 60;

            if(btn) { btn.innerText = "RESUME"; btn.style.color = ""; }
            if(inputWrap) inputWrap.style.display = "flex";
            if(displayWrap) displayWrap.style.display = "none";

        } else {
            // START
            const h = parseInt(document.getElementById(`tmr-h-${id}`).value) || 0;
            const m = parseInt(document.getElementById(`tmr-m-${id}`).value) || 0;
            const s = parseInt(document.getElementById(`tmr-s-${id}`).value) || 0;
            
            const totalMs = ((h * 3600) + (m * 60) + s) * 1000;
            
            if (totalMs <= 0) return; // Don't start a 0 timer

            tmr.endTime = Date.now() + totalMs;
            tmr.isRunning = true;
            
            if(inputWrap) inputWrap.style.display = "none";
            if(displayWrap) displayWrap.style.display = "flex";
            if(btn) { btn.innerText = "PAUSE"; btn.style.color = "#a00000"; }
            
            // Force immediate visual update
            this.updateTimerTick(id); 
            tmr.interval = setInterval(() => this.updateTimerTick(id), 100);
        }
    },

    resetTimer(id) {
        const tmr = this.timers[id];
        if (!tmr) return;

        clearInterval(tmr.interval);
        tmr.isRunning = false;
        tmr.isRinging = false;
        
        const inputWrap = document.getElementById(`tmr-input-wrap-${id}`);
        const displayWrap = document.getElementById(`tmr-display-wrap-${id}`);
        const display = document.getElementById(`tmr-display-${id}`);
        const btn = document.getElementById(`tmr-btn-${id}`);
        
        if (display) {
            display.style.background = "#fff";
            display.style.color = "#000";
            display.innerText = "00:00:00";
        }
        if(inputWrap) inputWrap.style.display = "flex";
        if(displayWrap) displayWrap.style.display = "none";
        if (btn) { btn.innerText = "START"; btn.style.color = ""; }
    },

    updateTimerTick(id) {
        const win = document.getElementById('window-' + id);
        const tmr = this.timers[id];
        
        // Garbage Collection
        if (!win) {
            clearInterval(tmr.interval);
            delete this.timers[id];
            return;
        }

        const leftMs = tmr.endTime - Date.now();
        const display = document.getElementById(`tmr-display-${id}`);
        const btn = document.getElementById(`tmr-btn-${id}`);

        if (leftMs <= 0) {
            // ALARM TRIGGERED!
            clearInterval(tmr.interval);
            tmr.isRunning = false;
            tmr.isRinging = true;
            
            if (display) {
                display.innerText = "00:00:00";
                // Start blinking effect
                tmr.interval = setInterval(() => {
                    if (display.style.background === "rgb(255, 255, 255)" || display.style.background === "#fff" || display.style.background === "white") {
                        display.style.background = "#d30000";
                        display.style.color = "#fff";
                    } else {
                        display.style.background = "#fff";
                        display.style.color = "#000";
                    }
                }, 300);
            }

            if (btn) { btn.innerText = "STOP ALARM"; btn.style.color = "#d30000"; }
            
            // Console log the placeholder sound
            const soundSelect = document.getElementById(`tmr-sound-${id}`);
            const soundName = soundSelect ? soundSelect.value : "Alarm";
            console.log(`[ClockApp] Timer ${id} reached 0. Playing Placeholder Sound: "${soundName}"`);
            
            return;
        }

        // Standard Tick Update
        let totalSec = Math.floor(leftMs / 1000);
        let hours = Math.floor(totalSec / 3600);
        let mins = Math.floor((totalSec % 3600) / 60);
        let secs = totalSec % 60;
        
        if (display) {
            display.innerText = `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        }
    },
});
