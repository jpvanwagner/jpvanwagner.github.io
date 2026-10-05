#!/usr/bin/env python3
"""
BUILD-SEARCH-INDEX.PY - Rebuilds pages/js/search-index.js, the text the site search looks through.

Run it from the site folder after editing any page's text:
    python tools/build-search-index.py

It reads every page in pages/ (only the <main> content, skipping scripts, comments and
retro-only extras) and writes one entry per page: address, title, headings, tags (the little
boxes in <ul class="tags"> lists, which become clickable search links) and plain text.
The search itself (pages/js/search.js) needs no server, so it also works from a folder (file://).
This tools/ folder is for you only; it doesn't need to be uploaded to Neocities.
"""
import html, json, os, re
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = os.path.join(ROOT, 'pages')
SKIP = {'search.html', 'blocked.html', 'find.html'}     # the results page, and NetCrawler's "opened in a new tab" page

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}

class MainText(HTMLParser):
    """Collects the visible text (and h1-h3 headings) inside <main>, minus scripts and retro-only bits."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_main = False
        self.depth = 0            # nesting depth inside <main>
        self.skip_at = None       # depth where a skipped element started
        self.text, self.heads, self.cur_head = [], [], None
        self.tags, self.tags_at, self.cur_tag = [], None, None   # <ul class="tags"> items = page tags

    def handle_starttag(self, tag, attrs):
        if tag == 'main':
            self.in_main = True; self.depth = 0; return
        if not self.in_main or tag in VOID:
            if self.in_main and tag == 'br': self.text.append(' ')
            return
        self.depth += 1
        cls = dict(attrs).get('class') or ''
        if self.skip_at is None and (tag in ('script', 'style', 'noscript', 'button') or 'retro-only' in cls.split()):
            self.skip_at = self.depth
        if self.skip_at is None:
            if tag in ('h1', 'h2', 'h3'): self.cur_head = []
            if tag == 'ul' and 'tags' in cls.split() and self.tags_at is None: self.tags_at = self.depth
            if tag == 'li' and self.tags_at is not None: self.cur_tag = []
            self.text.append(' ')

    def handle_endtag(self, tag):
        if tag == 'main':
            self.in_main = False; return
        if not self.in_main or tag in VOID: return
        if self.skip_at is not None and self.depth == self.skip_at:
            self.skip_at = None
        elif self.skip_at is None and tag in ('h1', 'h2', 'h3') and self.cur_head is not None:
            h = ' '.join(''.join(self.cur_head).split())
            if h: self.heads.append(h)
            self.cur_head = None
        elif self.skip_at is None and tag == 'li' and self.cur_tag is not None:
            t = ' '.join(''.join(self.cur_tag).split())
            if t and t not in self.tags: self.tags.append(t)
            self.cur_tag = None
        if tag == 'ul' and self.tags_at == self.depth: self.tags_at = None
        self.depth -= 1
        if self.skip_at is None: self.text.append(' ')

    def handle_data(self, data):
        if not self.in_main or self.skip_at is not None: return
        self.text.append(data)
        if self.cur_head is not None: self.cur_head.append(data)
        if self.cur_tag is not None: self.cur_tag.append(data)

def shared_blocks():
    """The shared HTML blocks from config/shared-content.js (name: `html`), so pages that show them
    with an empty data-shared="..." placeholder still have that text in the search index."""
    path = os.path.join(os.path.dirname(PAGES), 'config', 'shared-content.js')
    try: js = open(path, encoding='utf-8').read()
    except OSError: return {}
    return {k: v for k, v in re.findall(r'(\w+):\s*`(.*?)`', js, re.S)}

def fill_shared(src, blocks):
    def camel(n): return re.sub(r'-([a-z])', lambda m: m.group(1).upper(), n)
    def rep(m):
        html_ = blocks.get(camel(m.group(2)), '')
        return m.group(1) + html_ + m.group(3)
    return re.sub(r'(<(\w+)[^>]*data-shared="([^"]+)"[^>]*>)(</\2>)',
                  lambda m: m.group(1) + blocks.get(camel(m.group(3)), '') + m.group(4), src)

def build():
    entries = []
    blocks = shared_blocks()
    for name in sorted(os.listdir(PAGES)):
        if not name.endswith('.html') or name in SKIP: continue
        src = open(os.path.join(PAGES, name), encoding='utf-8').read()
        src = re.sub(r'<!--.*?-->', ' ', src, flags=re.S)
        src = fill_shared(src, blocks)
        m = re.search(r'data-title="([^"]*)"', src)
        title = html.unescape(m.group(1)) if m else name
        p = MainText(); p.feed(src)
        text = ' '.join(''.join(p.text).split())
        entries.append({'url': name, 'title': title, 'headings': p.heads, 'tags': p.tags, 'text': text})
    out = os.path.join(PAGES, 'js', 'search-index.js')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('/* SEARCH-INDEX.JS - generated by tools/build-search-index.py; do not edit by hand. */\n')
        f.write('window.SEARCH_INDEX = ' + json.dumps(entries, ensure_ascii=False, indent=0) + ';\n')
    print(f'Indexed {len(entries)} pages -> {os.path.relpath(out, ROOT)}')

if __name__ == '__main__':
    build()
    # a rebuilt index means a new upload: stamp a new site version (resets the tutorial tips)
    import importlib.util
    spec = importlib.util.spec_from_file_location('stamp_version', os.path.join(ROOT, 'tools', 'stamp-version.py'))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); mod.stamp(); mod.bust_caches(); mod.page_versions(); mod.bust_caches()
