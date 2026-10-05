/**
 * START-MENU.JS - Builds and shows the Start menu (global: Menu). What's IN the menu is defined
 * in start-menu-data.js; this file only draws it. The menu rebuilds on every open so checkbox
 * labels (Fullscreen, CRT FX...) always match the current state.
 *
 * Quick reference:
 *   toggle() / open() / close()      show or hide (START brick calls toggle)
 *   build()                          draws the panel: side stripe, entries, About / Share / Favorites, Restart / Shut Down
 *   buildWrapper / buildItemsRecursive   folders with hover flyouts (nested submenus supported)
 *   iconPath(name)                   'x.png' -> images/icons/os/x.png, 'default/x.png' -> images/icons/default/x.png
 * Styles: desktop/css/start-menu.css (panel layout is inline below)
 */
window.Menu = {
    isOpen: false,
    
    init() {
        this.build();
        // Leaving this browser window/tab (or clicking into a page inside NetCrawler) closes the menu
        window.addEventListener('blur', () => { if (this.isOpen) this.close(); });
        document.addEventListener('visibilitychange', () => { if (document.hidden && this.isOpen) this.close(); });
        
        document.addEventListener('mousedown', (e) => {
            const menuEl = document.getElementById('start-menu-container');
            const btnEl = document.getElementById('start-brick'); 
            
            if (this.isOpen && menuEl && !menuEl.contains(e.target)) {
                if (btnEl && btnEl.contains(e.target)) return; 
                this.close();
            }
        });
    },

    build() {
        let container = document.getElementById('start-menu-container');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'start-menu-container';
            container.style.cssText = `
                position: fixed;
                bottom: 35px;
                left: 2px;
                background: var(--ui-face, #c0c0c0);
                color: var(--ui-text, black);
                border-top: 2px solid #fff;
                border-left: 2px solid #fff;
                border-bottom: 2px solid #000;
                border-right: 2px solid #000;
                display: none;
                flex-direction: row;
                z-index: 100001; 
                box-shadow: 2px 2px 5px rgba(0,0,0,0.5);
                font-family: var(--user-font, sans-serif);
                font-size: 12px;
                min-width: 220px;
            `;
            
            const stripe = document.createElement('div');
            stripe.style.cssText = `
                width: 32px;
                /* theme colors, darkened by a translucent black layer so the white name is readable in every theme */
                background: linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)),
                            linear-gradient(to bottom, var(--title-grad-1, #000080), var(--title-grad-2, #1084d0));
                display: flex;
                align-items: flex-end;
                padding-bottom: 8px;
            `;
            stripe.innerHTML = `<span style="color:#fff; text-shadow:1px 1px 0 #000, 0 0 3px #000; font-family: 'Arial', sans-serif; font-weight:bold; transform:rotate(-90deg); transform-origin: left bottom; white-space:nowrap; margin-left:26px; font-size:16px; letter-spacing:2px;">${(window.SiteConfig && SiteConfig.osName) || 'Portfolio'}</span>`;
            
            this.itemContainer = document.createElement('div');
            this.itemContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                flex-grow: 1;
                padding: 2px;
            `;

            container.appendChild(stripe);
            container.appendChild(this.itemContainer);
            document.body.appendChild(container);
            
        }

        if (!this.itemContainer) return; 
        this.itemContainer.innerHTML = ''; 

        if (typeof window.StartMenuData === 'undefined') {
            this.itemContainer.innerHTML = '<div style="padding:10px; color:red; font-weight:bold;">ERROR: start-menu-data.js missing.</div>';
            return;
        }

        // 1. MENU DATA (pages, folders, classic-view toggle); see start-menu-data.js
        window.StartMenuData.build().forEach(entry => {
            if (entry.separator) {
                this.itemContainer.appendChild(this.createSeparator());
                return;
            }

            if (entry.items) {
                const subHtml = entry.items.length
                    ? this.buildItemsRecursive(entry.items, entry.keepOrder)
                    : `<div style="padding: 5px 10px; color:var(--ui-text, #888); font-style:italic; font-size:11px; opacity:0.7;">(Empty)</div>`;
                const w = this.buildWrapper(entry.label, entry.icon || "folder.png", subHtml);
                if (entry.tip) w.querySelector('div').title = entry.tip;   // tooltip on the folder name only
                w.dataset.folder = entry.label;                         // right-click menu (menu-shortcuts.js)
                w.dataset.icon = entry.icon || 'folder.png';
                if (entry.action) w.dataset.action = entry.action;
                this.itemContainer.appendChild(w);
                return;
            }

            const item = document.createElement('div');
            item.className = 'os-menu-item';
            if (entry.bold) item.style.fontWeight = 'bold';
            if (entry.tip) item.title = entry.tip;
            item.innerHTML = `<img src="${this.iconPath(entry.icon || 'newfile.png')}" onerror="this.onerror=null; this.style.opacity='0';" style="width:24px;height:24px; image-rendering:pixelated;"> <span>${entry.label}</span>`;
            item.onclick = () => { this.close(); new Function(entry.action)(); };
            item.dataset.action = entry.action;                  // right-click > Add to desktop (menu-shortcuts.js)
            item.dataset.icon = entry.icon || 'newfile.png';
            this.itemContainer.appendChild(item);
        });

        this.itemContainer.appendChild(this.createSeparator());

        // 2. SYSTEM CONTROLS
        const aboutOS = document.createElement('div');
        aboutOS.className = 'os-menu-item';
        aboutOS.innerHTML = `<img src="images/icons/default/info.png" onerror="this.onerror=null; this.style.opacity='0';" style="width:24px;height:24px; image-rendering:pixelated;"> About This Site`;
        aboutOS.title = 'Credits and how this site was made';
        aboutOS.dataset.action = 'if(window.AboutOS) window.AboutOS.open();';
        aboutOS.dataset.icon = 'default/info.png';
        aboutOS.onclick = () => { if(window.AboutOS) window.AboutOS.open(); this.close(); };
        this.itemContainer.appendChild(aboutOS);

        // Share this site / add it to the visitor's real browser favorites (shared/share.js)
        [{ label: 'Share this site...', icon: 'socials.png', tip: 'Share this portfolio on LinkedIn, Facebook, email, and more', action: 'SiteShare.open();' },
         { label: 'Add to Favorites...', icon: 'images/icons/os/favorite.svg', tip: "Save this portfolio in your browser's bookmarks", action: 'SiteShare.bookmark();' }
        ].forEach(x => {
            const row = document.createElement('div');
            row.className = 'os-menu-item';
            row.title = x.tip;
            row.innerHTML = `<img src="${this.iconPath(x.icon)}" onerror="this.onerror=null; this.style.opacity='0';" style="width:24px;height:24px; image-rendering:pixelated;"> <span>${x.label}</span>`;
            row.dataset.action = x.action;                       // right-click > Add to desktop
            row.dataset.icon = x.icon;
            row.onclick = () => { this.close(); new Function(x.action)(); };
            this.itemContainer.appendChild(row);
        });

        this.itemContainer.appendChild(this.createSeparator());

        const restart = document.createElement('div');
        restart.className = 'os-menu-item';
        restart.innerHTML = `<img src="images/icons/os/restart.png" onerror="this.onerror=null; this.style.opacity='0';" style="width:24px;height:24px; image-rendering:pixelated;"> Restart...`;
        restart.title = 'Reload the desktop (plays the start-up screen again)';
        restart.onclick = () => { location.reload(); };
        this.itemContainer.appendChild(restart);

        // System Reset: everything back to the way a first-time visitor sees it (see resetSystem)
        const reset = document.createElement('div');
        reset.className = 'os-menu-item';
        reset.innerHTML = `<img src="images/icons/os/system-reset.svg" onerror="this.onerror=null; this.style.opacity='0';" style="width:24px;height:24px; image-rendering:pixelated;"> System Reset...`;
        reset.title = 'Start fresh: every setting, theme, icon position, file and tip back to how a first-time visitor sees it';
        reset.onclick = () => { this.close(); this.confirmReset(); };
        this.itemContainer.appendChild(reset);

        const shutdown = document.createElement('div');
        shutdown.className = 'os-menu-item';
        shutdown.innerHTML = `<img src="images/icons/os/shutdown.png" onerror="this.onerror=null; this.style.opacity='0';" style="width:24px;height:24px; image-rendering:pixelated;"> Shut Down...`;
        shutdown.title = 'Turn off the retro desktop';
        shutdown.onclick = () => { 
            this.close(); 
            if(window.ShutdownSequence) window.ShutdownSequence.init(); 
        };
        this.itemContainer.appendChild(shutdown);
    },

    /** Ask first (it can't be undone), then wipe everything this site saved in the browser. */
    confirmReset() {
        const html = `
            <div class="sysreset">
                <p><img src="images/icons/os/system-reset.svg" alt="" width="32" height="32" style="float:left;margin:0 10px 4px 0;image-rendering:pixelated;">
                <b>Reset everything to factory defaults?</b></p>
                <p>Themes, wallpaper, settings, icon positions, your folders and text documents, the Rubbish,
                   and Scenemaker demo data will all be cleared, and the tips will show again, just like a first visit.</p>
                <p>This can't be undone.</p>
                <div style="display:flex;gap:8px;justify-content:flex-end;clear:both;">
                    <button type="button" class="bevel-out" data-sr="ok" title="Clear everything and restart"><b>Reset</b></button>
                    <button type="button" class="bevel-out" data-sr="cancel">Cancel</button>
                </div>
            </div>`;
        WM.open('system-reset', 'System Reset', html, 'images/icons/os/system-reset.svg', { width: 380, height: 215, center: true });
        const win = WM.windows['system-reset'];
        if (!win || win.dataset.srHooked) return;
        win.dataset.srHooked = '1';
        win.addEventListener('click', (e) => {
            const b = e.target.closest('[data-sr]');
            if (!b) return;
            if (b.getAttribute('data-sr') === 'ok') this.resetSystem();
            else WM.close('system-reset');
        });
    },

    /** Clear every setting this site stored in this browser, then restart in retro mode. */
    resetSystem() {
        try { localStorage.clear(); } catch (e) {}
        try { sessionStorage.clear(); } catch (e) {}
        try { if (window.indexedDB && indexedDB.databases) indexedDB.databases().then(dbs => dbs.forEach(d => d.name && indexedDB.deleteDatabase(d.name))).catch(() => {}); } catch (e) {}
        // keep the visitor in the retro desktop (a first visit on a phone would otherwise pick Traditional View)
        setTimeout(() => location.replace(location.pathname + '?mode=retro'), 150);
    },

    // Resolves a menu icon name to a real path (see the notes at the top of start-menu-data.js)
    iconPath(icon) {
        if (icon.startsWith('http') || icon.startsWith('data:') || icon.startsWith('images/')) return icon;
        return 'images/icons/' + (icon.includes('/') ? icon : 'os/' + icon);
    },

    buildItemsRecursive(itemsArray, keepOrder = false) {
        let html = "";
        
        const sortedItems = keepOrder ? itemsArray.slice() : itemsArray.slice().sort((a, b) => {
            const labelA = a.label || "";
            const labelB = b.label || "";
            return labelA.localeCompare(labelB);
        });

        sortedItems.forEach(item => {
            if (item.label === '') return;   // a getter returned '' = "hide this entry right now"
            const itemLabel = item.label || "Unknown";
            let itemIcon = item.icon || "";
            const itemAction = item.action || "";

            if (!itemIcon && itemAction.includes('http')) {
                const match = itemAction.match(/https?:\/\/[^'"]+/);
                if (match) {
                    try {
                        const url = new URL(match[0]);
                        itemIcon = `https://www.google.com/s2/favicons?domain=${url.hostname}`;
                    } catch(e) {}
                }
            }
            if (!itemIcon) itemIcon = "newfile.png"; 

            const iconPath = this.iconPath(itemIcon);

            if (item.submenu && item.submenu.length > 0) {
                const deepHtml = this.buildItemsRecursive(item.submenu);
                html += `
                    <div class="os-menu-item os-submenu-wrapper" style="justify-content:space-between;">
                        <div style="display:flex; gap:12px; align-items:center;">
                            <img src="${iconPath}" onerror="this.onerror=null; this.style.opacity='0';" style="width:24px;height:24px; image-rendering:pixelated;">
                            ${itemLabel}
                        </div>
                        <span>▶</span>
                        <div class="os-submenu-content">
                            ${deepHtml}
                        </div>
                    </div>
                `;
            } else {
                // Ensure double quotes in action don't break the HTML string
                html += `
                    <div class="os-menu-item" ${item.tip ? `title="${String(item.tip).replace(/"/g, '&quot;')}"` : ''} data-action="${itemAction.replace(/"/g, '&quot;')}" data-icon="${String(itemIcon).replace(/"/g, '&quot;')}" onclick="${itemAction.replace(/"/g, '&quot;')}; window.Menu.close();">
                        <img src="${iconPath}" onerror="this.onerror=null; this.style.opacity='0';" style="width:24px;height:24px; image-rendering:pixelated;">
                        <span style="flex-grow:1;">${itemLabel}</span>
                    </div>
                `;
            }
        });
        return html;
    },

    buildWrapper(label, icon, contentHtml, isSpecial = false) {
        const wrapper = document.createElement('div');
        wrapper.className = 'os-menu-item os-submenu-wrapper';
        wrapper.style.justifyContent = 'space-between'; 
        
        if (isSpecial) {
            wrapper.style.fontWeight = 'bold';
            wrapper.style.fontSize = '14px';
            wrapper.style.paddingTop = '12px';
            wrapper.style.paddingBottom = '12px';
        }
        
        const iconPath = this.iconPath(icon);
        const imgSize = isSpecial ? '28px' : '24px';
        
        wrapper.innerHTML = `
            <div style="display:flex; gap:12px; align-items:center;">
                <img src="${iconPath}" onerror="this.onerror=null; this.style.opacity='0';" style="width:${imgSize};height:${imgSize}; image-rendering:pixelated;">
                ${label}
            </div>
            <span>▶</span>
            <div class="os-submenu-content">
                ${contentHtml}
            </div>
        `;
        return wrapper;
    },

    createSeparator() {
        const sep = document.createElement('div');
        sep.style.cssText = `
            height: 2px;
            margin: 4px 2px;
            border-top: 1px inset var(--ui-dark, #888);
            border-bottom: 1px inset var(--ui-light, #fff);
        `;
        return sep;
    },

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    open() {
        // MAGIC BULLET: Rebuild the menu dynamically every time it opens! 
        // This forces all checkbox states to update instantly to match reality.
        this.build(); 
        
        const container = document.getElementById('start-menu-container');
        if (container) {
            container.style.display = 'flex';
            this.isOpen = true;
            container.classList.remove('menu-anim'); void container.offsetWidth; container.classList.add('menu-anim');   // slide up (start-menu.css)
            
            const btn = document.getElementById('start-brick');
            if (btn) {
                btn.classList.add('active');           // the MENU brick looks pushed in while the menu is open
                // Open right above the MENU brick (wherever it sits), never on top of it
                const r = btn.getBoundingClientRect();
                container.style.bottom = Math.max(0, window.innerHeight - r.top + 2) + 'px';
                container.style.left = Math.max(2, Math.min(r.left, window.innerWidth - container.offsetWidth - 2)) + 'px';
                container.style.maxHeight = Math.max(200, r.top - 6) + 'px';
            }
        }
    },

    close() {
        const container = document.getElementById('start-menu-container');
        if (container) {
            container.style.display = 'none';
            this.isOpen = false;
            
            const btn = document.getElementById('start-brick');
            if (btn) btn.classList.remove('active');
        }
    }
};

window.MainMenu = window.Menu; 
document.addEventListener('DOMContentLoaded', () => { window.Menu.init(); });