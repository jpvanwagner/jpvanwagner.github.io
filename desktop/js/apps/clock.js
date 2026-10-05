/**
 * CLOCK.JS - The "Clock & Timers" window: analog + digital clock with the visitor's time zone
 * (global: ClockApp). The Stopwatch and Alarm Timer windows are in clock-timers.js.
 * Quick reference: open(), initCentralClock() (ticks the hands every second while open)
 */
window.ClockApp = {
    clockInterval: null,

    stopwatches: {},

    timers: {},

    alarmSounds: ['Classic Beep', 'Digital Chime', 'Buzzer', 'Marimba'],

    open() {
        const html = `
            <div style="padding:10px; background:var(--ui-face); color:var(--ui-text); font-family:var(--user-font, sans-serif); height:100%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; gap:15px;">
                
                <div style="position:relative; width:120px; height:120px; border-radius:50%; border:2px inset var(--ui-dark); background:#fff; margin-top:5px; box-shadow: inset 1px 1px 3px rgba(0,0,0,0.3);">
                    <div style="position:absolute; width:8px; height:8px; background:#000; border-radius:50%; top:50%; left:50%; transform:translate(-50%, -50%); z-index:10;"></div>
                    
                    <div id="app-hour-hand" style="position:absolute; width:4px; height:35px; background:#000; bottom:50%; left:calc(50% - 2px); transform-origin:bottom; transform:rotate(0deg); z-index:7; border-radius:2px;"></div>
                    <div id="app-min-hand" style="position:absolute; width:2px; height:50px; background:#000; bottom:50%; left:calc(50% - 1px); transform-origin:bottom; transform:rotate(0deg); z-index:8; border-radius:1px;"></div>
                    <div id="app-sec-hand" style="position:absolute; width:1px; height:55px; background:#d30000; bottom:50%; left:calc(50% - 0.5px); transform-origin:bottom; transform:rotate(0deg); z-index:9;"></div>
                </div>

                <div style="text-align:center;">
                    <div id="app-digital-time" style="font-size:16px; font-weight:bold; font-family:monospace; letter-spacing:1px; margin-bottom:4px;">00:00:00 AM</div>
                    <div id="app-timezone" style="font-size:11px; opacity:0.8;">Detecting Timezone...</div>
                </div>

                <div style="width:100%; border-top:2px solid var(--ui-dark); border-bottom:1px solid var(--ui-light); margin: 5px 0;"></div>

                <div style="display:flex; width:100%; gap:10px; justify-content:center;">
                    <button class="bevel-out" onclick="window.ClockApp.openStopwatch()" onmousedown="this.classList.replace('bevel-out','bevel-in')" onmouseup="this.classList.replace('bevel-in','bevel-out')" onmouseleave="this.classList.replace('bevel-in','bevel-out')" style="flex:1; padding:6px; cursor:pointer; font-weight:bold; font-family:var(--user-font);">
                        <img src="images/icons/os/clock.png" onerror="this.style.display='none'" style="width:14px; vertical-align:middle; margin-right:4px;"> Stopwatch
                    </button>
                    <button class="bevel-out" onclick="window.ClockApp.openTimer()" onmousedown="this.classList.replace('bevel-out','bevel-in')" onmouseup="this.classList.replace('bevel-in','bevel-out')" onmouseleave="this.classList.replace('bevel-in','bevel-out')" style="flex:1; padding:6px; cursor:pointer; font-weight:bold; font-family:var(--user-font);">
                        <img src="images/icons/os/clock.png" onerror="this.style.display='none'" style="width:14px; vertical-align:middle; margin-right:4px;"> Alarm Timer
                    </button>
                </div>
            </div>
        `;

        if (typeof WM !== 'undefined') {
            WM.open('app-clock-main', 'Time & Alarms', html, 'images/icons/os/clock.png');
            
            setTimeout(() => {
                const win = document.getElementById('window-app-clock-main');
                if (win) {
                    win.style.width = '260px';
                    win.style.height = '330px';
                }
                this.initCentralClock();
            }, 50);
        }
    },

    initCentralClock() {
        // Detect System Location / Timezone
        const tzEl = document.getElementById('app-timezone');
        if (tzEl) {
            try {
                const tzName = window.SysClock ? SysClock.zone() : Intl.DateTimeFormat().resolvedOptions().timeZone;
                const shortCode = new Date().toLocaleTimeString('en-us',{timeZoneName:'short', timeZone: tzName}).split(' ')[2];
                tzEl.innerText = `${tzName.replace('_', ' ')} (${shortCode})`;
            } catch(e) {
                tzEl.innerText = "Local System Time";
            }
        }

        if (this.clockInterval) clearInterval(this.clockInterval);
        
        this.clockInterval = setInterval(() => {
            const win = document.getElementById('window-app-clock-main');
            if (!win) {
                clearInterval(this.clockInterval); // Garbage collection if window is closed
                return;
            }

            // the desktop's clock (sys-clock.js), so a changed date/time/zone shows here too
            const t = window.SysClock ? SysClock.parts() : (d => ({ hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds() }))(new Date());
            const h = t.hour;
            const m = t.minute;
            const s = t.second;

            const hrHand = document.getElementById('app-hour-hand');
            const minHand = document.getElementById('app-min-hand');
            const secHand = document.getElementById('app-sec-hand');
            const digText = document.getElementById('app-digital-time');

            if (hrHand) hrHand.style.transform = `rotate(${(h % 12) * 30 + m * 0.5}deg)`;
            if (minHand) minHand.style.transform = `rotate(${m * 6 + s * 0.1}deg)`;
            if (secHand) secHand.style.transform = `rotate(${s * 6}deg)`;
            if (digText) digText.innerText = `${h % 12 || 12}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;

        }, 1000);
        
        // Trigger immediately so it doesn't wait 1 second to draw
        this.clockInterval; 
    },
};