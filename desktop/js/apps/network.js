/**
 * NETWORK.JS - The "Network" window (global: NetworkApp), styled like the Windows 95 Network
 * Neighborhood. "The Network" is an old-school webring: people share their page with me, I add it
 * (`network` in config/site-config.js), and it's listed here and on pages/network.html (the website
 * version). Everything is in this window: what it is, the ring buttons (Prev / List / Random / Next),
 * every member site (titles and icons fetched automatically), how to join, the graphics, and the
 * copy-and-paste HTML for member sites. Data and helpers: shared/network-ring.js.
 * Outside sites open in a real browser tab (most refuse to load inside the NetCrawler frame).
 * Styles: desktop/css/apps.css ("NETWORK")
 */
window.NetworkApp = {
    icon: 'images/icons/os/network.svg',

    open() {
        const R = window.NetworkRing;
        const g = 'images/network/the-network-';
        const html = `
            <div class="net-window">
                <div class="net-address"><span>Address</span><div><img src="${this.icon}" alt=""> The Network</div>
                    <button type="button" class="net-web" title="Open the website version of The Network in NetCrawler">Website version</button></div>
                <div class="net-body">
                    <div class="net-intro">
                        <img src="${g}badge.png" width="88" height="31" alt="The Network">
                        <div>
                            <p><b>The Network is an old-school webring</b> of websites and portfolios from instructional designers,
                            trainers, educators, and other professionals I know.</p>
                            <p>You share your page with me, I add it to The Network, and it gets listed here. Every site on the ring
                            carries the same little Network buttons, so visitors can go <b>back and forth</b> from one member site to the
                            next, jump to a <b>random</b> one, or view the <b>full list</b> of sites.</p>
                        </div>
                    </div>
                    <div class="net-ringbar" aria-label="Travel around The Network">
                        <button type="button" data-go="prev" title="The previous site on the ring (opens in a new tab)"><img src="${g}prev.png" alt="Previous site"></button>
                        <button type="button" data-go="list" title="Every site in The Network"><img src="${g}list.png" alt="Full list"></button>
                        <button type="button" data-go="random" title="A random site on the ring (opens in a new tab)"><img src="${g}random.png" alt="Random site"></button>
                        <button type="button" data-go="next" title="The next site on the ring (opens in a new tab)"><img src="${g}next.png" alt="Next site"></button>
                    </div>

                    <h3 class="net-h">Join The Network</h3>
                    <ol class="net-steps">
                        <li><b>Send me your page.</b> <a href="#email" data-email title="Opens a new email in your mail app">Email me</a> the address of your site or portfolio.</li>
                        <li><b>I add it to the ring.</b> It shows up in the list below, with its title and icon.</li>
                        <li><b>Paste the buttons onto your page.</b> Type your address, copy the code, and paste it anywhere in your page's HTML.</li>
                    </ol>
                    <label class="net-field">Your site's address
                        <input type="url" class="net-your-url" placeholder="https://your-site.com/" spellcheck="false" title="So the Prev and Next buttons know where you are on the ring">
                    </label>
                    <div class="net-preview" aria-label="Preview of the buttons"></div>
                    <textarea class="net-code" rows="7" readonly spellcheck="false" aria-label="HTML to paste onto your page"></textarea>
                    <div class="net-copyrow"><button type="button" class="net-copy" title="Copy the HTML so you can paste it onto your page">Copy the code</button> <span class="net-copied" role="status"></span></div>

                    <h3 class="net-h">The graphics</h3>
                    <p class="net-small">The code loads these straight from this site. To host them yourself, right-click and save them.</p>
                    <div class="net-gfx">
                        <figure><img src="${g}badge.png" alt="Badge"><figcaption>Badge 88&times;31</figcaption></figure>
                        <figure><img src="${g}prev.png" alt="Prev"><figcaption>Prev</figcaption></figure>
                        <figure><img src="${g}list.png" alt="List"><figcaption>List</figcaption></figure>
                        <figure><img src="${g}random.png" alt="Random"><figcaption>Random</figcaption></figure>
                        <figure><img src="${g}next.png" alt="Next"><figcaption>Next</figcaption></figure>
                        <figure><img src="${g}logo.png" alt="Icon"><figcaption>Icon 32&times;32</figcaption></figure>
                    </div>

                    <!-- every member site: folded up at the bottom; the List button opens it -->
                    <details class="net-index" data-sec="list" open>
                        <summary class="net-h" title="Show or hide the full list of sites">Every site in The Network <span class="net-n"></span></summary>
                        <ul class="net-list net-win-list"></ul>
                    </details>
                </div>
                <div class="net-status"></div>
            </div>`;
        WM.open('network', 'The Network', html, this.icon, { width: 640, height: 540, center: true });
        const win = WM.windows['network'];
        if (!win || !R || win._netReady) return;
        win._netReady = true;

        const n = R.renderList(win.querySelector('.net-win-list'), '');
        win.querySelector('.net-n').textContent = '(' + n + (n === 1 ? ' site)' : ' sites)');
        win.querySelector('.net-status').textContent = n + (n === 1 ? ' site' : ' sites') + ' on the ring' + (n < 2 ? '. Yours could be next!' : '');

        win.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
            if (b.dataset.go === 'list') { const d = win.querySelector('[data-sec="list"]'); d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
            const dest = R.target(R.hub, b.dataset.go);
            if (dest) window.open(dest, '_blank', 'noopener');
        }));
        win.querySelector('.net-web').addEventListener('click', () => { if (window.Browser && Browser.openPage) Browser.openPage('network.html'); });
        win.querySelector('[data-email]').addEventListener('click', (e) => { e.preventDefault(); if (window.SiteConfig && SiteConfig.openEmail) SiteConfig.openEmail(); });

        // the copy-and-paste code, with a live preview (the preview uses this site's own images and doesn't navigate)
        const input = win.querySelector('.net-your-url'), code = win.querySelector('.net-code'), prev = win.querySelector('.net-preview');
        const update = () => {
            const snip = R.snippet(input.value.trim() || 'https://YOUR-SITE.com/');
            code.value = snip;
            prev.innerHTML = snip.replace(/<!--[^>]*-->\n?/, '').split(R.hub.replace(/\/$/, '') + '/images/').join('images/');
            prev.querySelectorAll('a').forEach(a => a.removeAttribute('href'));
        };
        input.addEventListener('input', update);
        update();
        code.addEventListener('focus', () => code.select());
        win.querySelector('.net-copy').addEventListener('click', () => {
            const said = win.querySelector('.net-copied');
            const done = (ok) => { said.textContent = ok ? 'Copied! Paste it into your page.' : 'Select the code and press Ctrl+C.'; setTimeout(() => { said.textContent = ''; }, 4000); };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code.value).then(() => done(true), () => { code.select(); done(false); });
            else { code.select(); try { done(document.execCommand('copy')); } catch (e) { done(false); } }
        });
    }
};
