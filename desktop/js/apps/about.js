/**
 * ABOUT.JS - Start > About This Site: logo, OS name/version, a playful "system manifest",
 * and a button for credits.txt (global: AboutOS).
 * Quick reference: open(). The version number comes from osVersion in config/site-config.js.
 */
window.AboutOS = {
    open() {
        const cfg = window.SiteConfig || { osName: 'Portfolio', ownerName: '' };

        const version = cfg.osVersion || "1.0";

        const ua = navigator.userAgent;
        let os = "Unknown";
        if (ua.indexOf("Win") != -1) os = "Windows";
        if (ua.indexOf("Mac") != -1) os = "MacOS";
        if (ua.indexOf("Linux") != -1) os = "Linux";
        if (ua.indexOf("Android") != -1) os = "Android";
        if (/iPhone|iPad/.test(ua)) os = "iOS";

        const html = `
            <div style="display:flex; flex-direction:column; align-items:center; padding:10px; gap:10px; font-family:var(--user-font, sans-serif);">

                <img src="images/icons/logo.svg" style="width:64px; height:64px; image-rendering:pixelated;">

                <h2 style="margin:0; text-align:center;">${cfg.osName}</h2>
                <p style="margin:0;">Version ${version}</p>
                <center>The portfolio of ${cfg.ownerName}.</center>
                <div style="width:100%; background:#fff; color:#000; border:2px inset var(--ui-dark); padding:5px; margin-top:5px; font-size: 11px;">
                    <strong>System:</strong><br>
                    ${os}<br>
                    Display: ${screen.width} x ${screen.height}
                </div>

                <div style="display:flex; gap:10px; width:100%; justify-content:center; margin-top:5px;">
                    <button class="bevel-out" onclick="window.NotesApp.open('credits.txt', 'credits.txt', { width: 680, height: 560 })" style="flex:1; padding:4px; cursor:pointer; font-size:11px;">Credits</button>
                </div>

                <button class="bevel-out" onclick="WM.close('about')" style="margin-top:5px; width: 80px; padding:4px; font-weight:bold; cursor:pointer;">OK</button>
            </div>
        `;

        WM.open('about', 'About This Site', html, 'images/icons/default/info.png');

        // Give the window manager a split second to draw the window, then size and center it
        setTimeout(() => {
            const win = document.getElementById('window-about');
            if(win) {
                const winWidth = 340;
                win.style.width = winWidth + 'px';
                win.style.height = 'auto';

                const winHeight = win.offsetHeight;
                win.style.left = Math.max(0, (window.innerWidth / 2) - (winWidth / 2)) + 'px';
                win.style.top = Math.max(0, (window.innerHeight / 2) - (winHeight / 2)) + 'px';
            }
        }, 50);
    }
};
