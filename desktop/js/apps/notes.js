/**
 * NOTES.JS - A Notepad clone (global: NotesApp). Opens blank notes, or read-only text files
 * such as readme.txt / credits.txt. File > Save As downloads the text; nothing is uploaded.
 *
 * Quick reference:
 *   open(url, title, size)   url = text file to show read-only, or null for a blank note;
 *                            size = optional { width, height } (readme.txt opens larger)
 *   saveNote / execCmd (cut, copy, paste, select all) / toggleWrap / updateStatus (Ln, Col)
 * Styles: desktop/css/apps.css
 */
window.NotesApp = {
    appIcon: 'images/icons/os/newfile.png',
    instanceCount: 0,

    init() {
    },

    open(url = null, fileTitle = "Untitled", size = null) {
        this.instanceCount++;
        const instId = `notes-inst-${this.instanceCount}`;
        const winId = `notes-${this.instanceCount}`;
        const isReadOnly = url !== null;

        const html = `
            <div id="${instId}" class="app-notes-container" style="display:flex; flex-direction:column; width:100%; height:100%; position:absolute; top:0; left:0; right:0; bottom:0; background:var(--win-bg);">
                
                <div class="notes-menubar" style="display:flex; background:var(--ui-face); border-bottom:1px solid var(--ui-dark); padding:2px 5px; gap:10px; font-size:12px; font-family:var(--user-font, sans-serif);">
                    
                    <div class="notes-menu-item" tabindex="0">
                        File
                        <div class="notes-dropdown">
                            <div onclick="window.NotesApp.newNote(); this.closest('.notes-menu-item').blur()">New</div>
                            ${!isReadOnly ? `<div onclick="window.NotesApp.saveNote('${instId}'); this.closest('.notes-menu-item').blur()">Save As...</div>` : `<div class="disabled">Save As...</div>`}
                            <div class="separator"></div>
                            <div onclick="WM.close('${winId}')">Exit</div>
                        </div>
                    </div>
                    
                    <div class="notes-menu-item" tabindex="0">
                        Edit
                        <div class="notes-dropdown">
                            <div onclick="window.NotesApp.execCmd('${instId}', 'cut'); this.closest('.notes-menu-item').blur()">Cut</div>
                            <div onclick="window.NotesApp.execCmd('${instId}', 'copy'); this.closest('.notes-menu-item').blur()">Copy</div>
                            <div onclick="window.NotesApp.execCmd('${instId}', 'paste'); this.closest('.notes-menu-item').blur()">Paste</div>
                            <div class="separator"></div>
                            <div onclick="window.NotesApp.execCmd('${instId}', 'selectAll'); this.closest('.notes-menu-item').blur()">Select All</div>
                        </div>
                    </div>
                    
                    <div class="notes-menu-item" tabindex="0">
                        Format
                        <div class="notes-dropdown">
                            <div onclick="window.NotesApp.toggleWrap('${instId}'); this.closest('.notes-menu-item').blur()" id="wrap-toggle-${instId}">Word Wrap: ON</div>
                        </div>
                    </div>

                    <div class="notes-menu-item" tabindex="0">
                        Help
                        <div class="notes-dropdown">
                            <div onclick="window.NotesApp.about(); this.closest('.notes-menu-item').blur()">About Notes</div>
                        </div>
                    </div>

                </div>

                <textarea id="textarea-${instId}" class="notes-textarea" spellcheck="false" ${isReadOnly ? 'readonly' : ''} 
                    onkeyup="window.NotesApp.updateStatus('${instId}')" 
                    onmouseup="window.NotesApp.updateStatus('${instId}')" 
                    oninput="window.NotesApp.updateStatus('${instId}')"
                    style="flex:1; width:100%; resize:none; border:none; outline:none; padding:5px; font-family:'Courier New', monospace; font-size:14px; white-space:pre-wrap; background:#fff; color:#000; box-sizing:border-box;"></textarea>
                
                <div id="statusbar-${instId}" style="border-top:1px solid rgba(128,128,128,0.5); padding:2px 5px; font-size:11px; font-family:var(--user-font, sans-serif); display:flex; justify-content:space-between; background:var(--ui-face); color:var(--ui-text);">
                    <span id="status-lncol-${instId}">Ln 1, Col 1</span>
                    <span style="display:flex; gap:15px;">
                        <span>100%</span>
                        <span>Windows (CRLF)</span>
                        <span>UTF-8</span>
                    </span>
                </div>

            </div>
        `;

        // Open the window
        // Classic starting size, unless the caller asked for something bigger
        WM.open(winId, `${fileTitle} - Notes`, html, this.appIcon,
            { width: (size && size.width) || 450, height: (size && size.height) || 350, center: !!size });

        // Fetch Content if URL is provided
        if (url) {
            const ta = document.getElementById(`textarea-${instId}`);
            if (ta) ta.value = "Loading...";
            
            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error("File not found");
                    return res.text();
                })
                .then(text => {
                    if(ta) {
                        ta.value = text;
                        this.updateStatus(instId);
                    }
                })
                .catch(err => {
                    if (!ta) return;
                    // Browsers refuse to read files when the site is opened straight from a folder
                    // (file:// addresses); it works on the live site or through a local web server.
                    ta.value = location.protocol === 'file:'
                        ? `${url} can't be opened while this site is viewed straight from a folder on your computer.\n\n` +
                          `It opens normally on the live site. To test locally, run a small web server in the site folder\n` +
                          `(for example: python -m http.server) and visit http://localhost:8000 instead.`
                        : "Error loading file: " + url;
                });
        }
    },

    newNote() {
        this.open();
    },

    saveNote(instId) {
        const ta = document.getElementById(`textarea-${instId}`);
        if (!ta) return;
        
        const text = ta.value;
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        
        // Generate the bosnotes[datetime] filename
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        const timeString = `${year}${month}${day}${hours}${minutes}${seconds}`;
        a.download = `notes${timeString}.txt`;

        // Temporarily attach to body to ensure the click event fires cleanly in all browsers
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    },

    execCmd(instId, cmd) {
        const ta = document.getElementById(`textarea-${instId}`);
        if (!ta) return;
        
        ta.focus();
        if (cmd === 'selectAll') {
            ta.select();
        } else if (cmd === 'copy' || cmd === 'cut') {
            try {
                document.execCommand(cmd);
            } catch(e) {
                console.error("Browser blocked command:", e);
            }
        } else if (cmd === 'paste') {
            if (navigator.clipboard && navigator.clipboard.readText) {
                navigator.clipboard.readText().then(text => {
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    ta.value = ta.value.substring(0, start) + text + ta.value.substring(end);
                    ta.selectionStart = ta.selectionEnd = start + text.length;
                    this.updateStatus(instId);
                }).catch(err => {
                    alert("Browser blocked paste. Please use Ctrl+V or Cmd+V.");
                });
            } else {
                alert("Clipboard API not supported. Please use Ctrl+V or Cmd+V.");
            }
        }
    },

    toggleWrap(instId) {
        const ta = document.getElementById(`textarea-${instId}`);
        const toggle = document.getElementById(`wrap-toggle-${instId}`);
        if (!ta || !toggle) return;

        if (ta.style.whiteSpace === 'pre') {
            ta.style.whiteSpace = 'pre-wrap';
            ta.wrap = 'soft';
            toggle.innerText = 'Word Wrap: ON';
        } else {
            ta.style.whiteSpace = 'pre';
            ta.wrap = 'off';
            toggle.innerText = 'Word Wrap: OFF';
        }
    },

    updateStatus(instId) {
        const ta = document.getElementById(`textarea-${instId}`);
        const status = document.getElementById(`status-lncol-${instId}`);
        if (!ta || !status) return;
        
        // Calculates exact Line and Column based on cursor position
        const text = ta.value.substring(0, ta.selectionStart);
        const lines = text.split('\n');
        const currLine = lines.length;
        const currCol = lines[lines.length - 1].length + 1;
        
        status.innerText = `Ln ${currLine}, Col ${currCol}`;
    },

    about() {
        WM.open('notes-about', 'About Notes', `
            <div style="padding:15px; text-align:center; font-family:var(--user-font);">
                <img src="${this.appIcon}" style="width:32px; height:32px; image-rendering:pixelated; margin-bottom:10px;">
                <h3 style="margin:0;">Notes</h3>
                <p>A simple text editor. Nothing you type is uploaded anywhere; use File, Save As to keep it.</p>
                <button class="bevel-out" onclick="WM.close('notes-about')" style="margin-top:10px; padding:2px 10px; cursor:pointer;">OK</button>
            </div>
        `, this.appIcon);
        
        setTimeout(() => {
            const win = document.getElementById('window-notes-about');
            if(win) {
                win.style.width = '250px';
                win.style.height = '180px';
            }
        }, 50);
    },

};

document.addEventListener('DOMContentLoaded', () => {
    window.NotesApp.init();
});