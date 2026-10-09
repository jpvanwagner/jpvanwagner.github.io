/**
 * SHARE.JS - "Share this site" and "Bookmark this site" pop-ups (global: SiteShare).
 * Shared by both views: the Traditional View pages (footer links, Contact page) and the retro
 * desktop (MENU > Share / Add to Favorites). Styles: shared/share.css
 *
 *   SiteShare.open()       share pop-up in three groups: Work (LinkedIn, Teams, Slack, Outlook, Gmail,
 *                          email), Messaging (WhatsApp, Telegram, Discord, texts on phones) and Social
 *                          (Facebook, X, Bluesky, Threads, Reddit, Instagram, TikTok, copy link),
 *                          plus the device's own share sheet when it has one
 *   SiteShare.bookmark()   bookmark pop-up. Web pages aren't allowed to add bookmarks themselves,
 *                          so this shows the right keyboard shortcut for the visitor's system
 *                          (Ctrl+D, Cmd+D, or the phone's browser menu) plus copy/share options.
 * Any element with data-share or data-bookmark opens these when clicked.
 * The address shared is SiteConfig.siteUrl (the live site), never a local file path.
 */
window.SiteShare = {
    url() {
        return (window.SiteConfig && SiteConfig.siteUrl) || location.origin + '/';
    },
    title() {
        return ((window.SiteConfig && SiteConfig.ownerName) || 'My') + ' | Instructional Designer & Educator portfolio';
    },

    /**
     * Every place to share, in three groups (work first).
     *   site      the platform's own web address: its real, current icon (favicon) is loaded live from
     *             Google's favicon service (DuckDuckGo's if that fails), so it stays up to date when a
     *             platform changes its logo. Shown small and doubled with hard pixel edges, on a raised
     *             Win95-style button. If neither service answers, the colored letter badge (color + mark) shows.
     *   color, mark  that fallback badge (and the look for Email / Text / Copy link, which have no platform)
     *   href      opens that site's own "share" or "compose" page with the link filled in
     *   copyThen  sites with no share page (Slack, Discord, Instagram...): copy the link,
     *             then open the site so the visitor can paste it
     *   mobile    only offered on phones/tablets (text messages)
     * Job boards like Indeed and Glassdoor have no way to share a link, so they aren't here.
     */
    targets() {
        const u = encodeURIComponent(this.url()), t = encodeURIComponent(this.title());
        const body = encodeURIComponent('Take a look: ' + this.url());
        const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        return [
            // Work
            { group: 'Work', id: 'linkedin', site: 'linkedin.com', name: 'LinkedIn', color: '#0a66c2', mark: 'in', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
            { group: 'Work', id: 'teams', site: 'teams.microsoft.com', name: 'Teams', color: '#4b53bc', mark: 'T', href: `https://teams.microsoft.com/share?href=${u}&msgText=${t}` },
            { group: 'Work', id: 'slack', site: 'slack.com', name: 'Slack', color: '#4a154b', mark: '#', copyThen: 'https://app.slack.com/client' },
            { group: 'Work', id: 'outlook', site: 'outlook.live.com', name: 'Outlook', color: '#0078d4', mark: 'O', href: `https://outlook.office.com/mail/deeplink/compose?subject=${t}&body=${body}` },
            { group: 'Work', id: 'gmail', site: 'mail.google.com', name: 'Gmail', color: '#d93025', mark: 'M', href: `https://mail.google.com/mail/?view=cm&fs=1&su=${t}&body=${body}` },
            { group: 'Work', id: 'email', name: 'Email app', color: '#5f6b7a', mark: '✉', href: `mailto:?subject=${t}&body=${body}` },
            // Messaging
            { group: 'Messaging', id: 'whatsapp', site: 'whatsapp.com', name: 'WhatsApp', color: '#25d366', mark: 'W', href: `https://wa.me/?text=${t}%20${u}` },
            { group: 'Messaging', id: 'telegram', site: 'telegram.org', name: 'Telegram', color: '#229ed9', mark: '➤', href: `https://t.me/share/url?url=${u}&text=${t}` },
            { group: 'Messaging', id: 'discord', site: 'discord.com', name: 'Discord', color: '#5865f2', mark: 'D', copyThen: 'https://discord.com/channels/@me' },
            ...(mobile ? [{ group: 'Messaging', id: 'sms', name: 'Text message', color: '#34c759', mark: '💬', href: `sms:?&body=${body}` }] : []),
            // Social
            { group: 'Social', id: 'facebook', site: 'facebook.com', name: 'Facebook', color: '#1877f2', mark: 'f', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
            { group: 'Social', id: 'x', site: 'x.com', name: 'X', color: '#000000', mark: 'X', href: `https://x.com/intent/post?url=${u}&text=${t}` },
            { group: 'Social', id: 'bluesky', site: 'bsky.app', name: 'Bluesky', color: '#1185fe', mark: '\u{1F98B}', href: `https://bsky.app/intent/compose?text=${t}%20${u}` },
            { group: 'Social', id: 'threads', site: 'threads.net', name: 'Threads', color: '#101010', mark: '@', href: `https://www.threads.net/intent/post?text=${t}%20${u}` },
            { group: 'Social', id: 'reddit', site: 'reddit.com', name: 'Reddit', color: '#ff4500', mark: 'r/', href: `https://www.reddit.com/submit?url=${u}&title=${t}` },
            { group: 'Social', id: 'instagram', site: 'instagram.com', name: 'Instagram', color: 'linear-gradient(45deg,#f58529,#dd2a7b,#8134af)', mark: '◎', copyThen: 'https://www.instagram.com/' },
            { group: 'Social', id: 'tiktok', site: 'tiktok.com', name: 'TikTok', color: '#010101', mark: '♪', copyThen: 'https://www.tiktok.com/' },
            { group: 'Social', id: 'copy', name: 'Copy link', color: '#2f855a', mark: '\u{1F517}', copy: true }
        ];
    },

    /** A platform icon didn't load: try DuckDuckGo's icon service, then fall back to the letter badge. */
    iconFail(img) {
        if (!img.dataset.tried) {
            img.dataset.tried = '1';
            img.src = 'https://icons.duckduckgo.com/ip3/' + img.dataset.site + '.ico';
            return;
        }
        const b = img.parentNode;
        b.classList.remove('share-fav'); b.classList.add('share-glyph');
        b.style.background = b.dataset.color;
        b.textContent = b.dataset.mark;
    },

    copy(text) {
        const done = () => this.toast('Link copied');
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(done, () => this.copyFallback(text, done));
        } else {
            this.copyFallback(text, done);
        }
    },
    copyFallback(text, done) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { prompt('Copy this link:', text); }
        ta.remove();
    },

    toast(msg) {
        const t = document.querySelector('.share-toast') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'share-toast' }));
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(this._toastT);
        this._toastT = setTimeout(() => t.classList.remove('show'), 2200);
    },

    /** On the retro desktop the pop-ups open as real desktop windows (with a taskbrick). */
    onDesktop() { return typeof WM !== 'undefined' && !!document.getElementById('window-container'); },
    /** A page inside the retro desktop's browser hands the pop-up to the desktop, so it becomes a window. */
    handOff(fn) {
        try {
            if (window.parent !== window && window.parent.SiteShare && window.parent.SiteShare.onDesktop()) {
                window.parent.SiteShare[fn]();
                return true;
            }
        } catch (e) {}
        return false;
    },

    /** A small modal window (retro title bar, works in both views); a real window on the retro desktop. */
    modal(title, bodyHtml) {
        this.close();
        if (this.onDesktop()) {
            const id = title === 'Add to Favorites' ? 'favorites' : 'share';
            const icon = id === 'share' ? 'images/icons/os/socials.png' : 'images/icons/os/favorite.svg';
            WM.open(id, title, `<div class="share-win share-body">${bodyHtml}</div>`, icon,
                { width: id === 'share' ? 560 : 440, height: id === 'share' ? 620 : 300, center: true });
            this._winId = id;
            return document.getElementById('window-' + id);
        }
        const wrap = document.createElement('div');
        wrap.className = 'share-overlay';
        wrap.innerHTML = `
            <div class="share-dialog" role="dialog" aria-modal="true" aria-label="${title}">
                <div class="share-titlebar"><span>${title}</span><button type="button" class="share-x" aria-label="Close" title="Close">X</button></div>
                <div class="share-body">${bodyHtml}</div>
            </div>`;
        document.body.appendChild(wrap);
        wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('.share-x')) this.close(); });
        this._esc = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', this._esc);
        const first = wrap.querySelector('.share-body a, .share-body button');
        if (first) first.focus({ focusVisible: false });   // keyboard users can Tab on; no ring for mouse users
        return wrap;
    },
    close() {
        if (this._winId && typeof WM !== 'undefined') { WM.close(this._winId); this._winId = null; }
        document.querySelectorAll('.share-overlay').forEach(o => o.remove());
        if (this._esc) document.removeEventListener('keydown', this._esc);
    },

    open() {
        if (this.handOff('open')) return;
        const item = x => {
            // A platform's live icon (see targets()); its fallback badge is built by SiteShare.iconFail
            const fav = x.site
                ? `<span class="share-badge share-fav" data-color="${x.color}" data-mark="${x.mark}"><img src="https://www.google.com/s2/favicons?domain=${x.site}&sz=16" width="16" height="16" alt="" data-site="${x.site}" onerror="SiteShare.iconFail(this)"></span>`
                : `<span class="share-badge share-glyph" style="background:${x.color}">${x.mark}</span>`;
            const badge = `${fav}<span>${x.name}</span>`;
            return x.href
                ? `<a class="share-item" href="${x.href}" target="_blank" rel="noopener" data-id="${x.id}" title="Share with ${x.name}">${badge}</a>`
                : `<button type="button" class="share-item" data-id="${x.id}" title="${x.copy ? 'Copy the link' : 'Copies the link, then opens ' + x.name + ' so you can paste it'}">${badge}</button>`;
        };
        const all = this.targets();
        const items = [...new Set(all.map(x => x.group))].map(g =>
            `<div class="share-group">${g}</div><div class="share-grid">${all.filter(x => x.group === g).map(item).join('')}</div>`).join('');
        // The system share sheet is only worth offering on phones/tablets: on desktop Windows it
        // opens a nearly empty box that closes again and does nothing
        let touch = false;
        try { touch = matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches; } catch (e) {}
        const native = navigator.share && touch ? `<button type="button" class="share-more" data-id="native" title="Your phone's own share menu (texts, other apps)">More options…</button>` : '';
        const wrap = this.modal('Share this portfolio', `
            <p class="share-lead">Know someone who's hiring, or who'd enjoy this? Share it:</p>
            ${items}
            <div class="share-link"><input type="text" readonly value="${this.url()}" aria-label="Link to this portfolio"><button type="button" data-id="copy">Copy</button></div>
            ${native}`);
        wrap.addEventListener('click', (e) => {
            const b = e.target.closest('[data-id]');
            if (!b || b.tagName === 'A') { if (b) setTimeout(() => this.close(), 100); return; }
            const x = this.targets().find(t => t.id === b.getAttribute('data-id'));
            if (b.getAttribute('data-id') === 'native') {
                navigator.share({ title: this.title(), url: this.url() }).catch((err) => {
                    // Cancelled by the visitor: fine. Anything else: copy the link instead
                    if (!err || err.name !== 'AbortError') this.copy(this.url());
                });
            } else if (x && x.copyThen) {
                this.copy(this.url());
                this.toast(`Link copied. Paste it into ${x.name}.`);
                window.open(x.copyThen, '_blank', 'noopener');
            } else if (x && x.copy || b.getAttribute('data-id') === 'copy') {
                this.copy(this.url());
            }
        });
    },

    bookmark() {
        if (this.handOff('bookmark')) return;
        const ua = navigator.userAgent;
        const mobile = /Mobi|Android|iPhone|iPad/i.test(ua);
        const mac = /Mac/i.test(navigator.platform || ua);
        const how = mobile
            ? 'Open your browser\'s menu (<b>⋮</b> or the <b>Share</b> button) and choose <b>Add to Favorites</b>, <b>Bookmark</b> or <b>Add to Home Screen</b>.'
            : `Press <kbd>${mac ? '⌘ Cmd' : 'Ctrl'}</kbd> + <kbd>D</kbd> to bookmark this page, or click the <b>☆</b> star in your address bar.`;
        const wrap = this.modal('Add to Favorites', `
            <div class="share-bm"><span class="share-star" aria-hidden="true">★</span>
            <div><p>${how}</p><p class="share-small">Web pages aren't allowed to add bookmarks for you, but it only takes a second.</p></div></div>
            <div class="share-link"><input type="text" readonly value="${this.url()}" aria-label="Link to this portfolio"><button type="button" data-id="copy">Copy link</button></div>
            <p class="share-small"><a href="#" data-id="to-share">Or share it with someone instead</a></p>`);
        wrap.addEventListener('click', (e) => {
            const b = e.target.closest('[data-id]');
            if (!b) return;
            e.preventDefault();
            if (b.getAttribute('data-id') === 'copy') this.copy(this.url());
            if (b.getAttribute('data-id') === 'to-share') this.open();
        });
    }
};

// Any element with data-share / data-bookmark opens the matching pop-up
document.addEventListener('click', function (e) {
    const s = e.target.closest && e.target.closest('[data-share], [data-bookmark]');
    if (!s) return;
    e.preventDefault();
    if (s.hasAttribute('data-share')) SiteShare.open(); else SiteShare.bookmark();
});
