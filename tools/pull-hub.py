#!/usr/bin/env python3
"""
PULL-HUB.PY - Copies each project's public files from its own repository into this site.
Run by .github/workflows/pull-hub.yml (daily, or "Run workflow" in the Actions tab); the
sources are listed in config/sources.json.

Each entry in "games" / "tools" is {"repo": "Owner/Name", "dest": "folder/in/this/site"} plus,
optionally, "files": {"path/in/source/repo": "path/inside/dest", ...}.

  * With "files": ONLY those files are copied. Use this for any repo that also holds private
    material, e.g. TOOL-Course-Catalog, whose real tool contains client names; only its
    anonymized portfolio copy may be published.
  * Without "files": the whole repo is copied EXCEPT developer files (see is_dev_file): notes
    for Claude, READMEs and changelogs, top-level docs/ tests/ scripts/ folders (a docs/ that
    holds an index.html is a built site and IS published), Python / batch / shell launchers,
    and package/git housekeeping files.

Pruning: a file the source repo has but that is no longer published (a developer file, or not
listed in "files") is deleted from the site if an earlier sync copied it there. Files that
exist only in this site are never touched.

Each synced folder also gets a SOURCE.txt naming the repo and commit it came from.
Needs PORTFOLIO_TOKEN (read access to the source repos) in the environment as MY_PAT.
"""
import json, os, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── What counts as a developer file (never published) ──────────────────────────────────────
DEV_DIRS_ANYWHERE = {'.git', '.github', '.claude', '__pycache__', 'node_modules'}
DEV_DIRS_AT_TOP = {'docs', 'tests', 'test', 'scripts'}          # only at the repo's top level
# ...except a docs/ folder that holds an index.html: that's a built site (GitHub Pages style,
# e.g. Restaurant Rush builds its playable game into docs/index.html), so it IS published.
DEV_FILES_AT_TOP = {'package.json', 'package-lock.json'}
DEV_FILE_NAMES = {'CLAUDE.md', 'requirements.txt', 'tailwind.config.js',
                  '.gitignore', '.gitattributes', 'gitignore', '.DS_Store'}
DEV_NAME_PREFIXES = ('README', 'CHANGELOG')                      # any case, any extension
DEV_EXTENSIONS = ('.py', '.bat', '.sh', '.vbs')


def is_dev_file(rel, docs_is_site=False):
    """rel: a path inside the source repo, with forward slashes. docs_is_site: the repo's
    docs/ folder contains an index.html (a built site), so it isn't developer documentation."""
    parts = rel.split('/')
    name = parts[-1]
    if any(p in DEV_DIRS_ANYWHERE for p in parts[:-1]):
        return True
    if len(parts) > 1 and parts[0] in DEV_DIRS_AT_TOP and not (parts[0] == 'docs' and docs_is_site):
        return True
    if len(parts) == 1 and name in DEV_FILES_AT_TOP:
        return True
    return (name in DEV_FILE_NAMES or name.upper().startswith(DEV_NAME_PREFIXES)
            or name.lower().endswith(DEV_EXTENSIONS))


# ── Helpers ────────────────────────────────────────────────────────────────────────────────
def clone(repo, into):
    """Shallow-clone repo into the folder `into`; returns its commit hash."""
    pat = os.environ.get('MY_PAT')
    if not pat:
        sys.exit('ERROR: PORTFOLIO_TOKEN is missing or empty! Check your Repository Secrets.')
    subprocess.run(['git', 'clone', '-q', '--depth', '1', f'https://{pat}@github.com/{repo}.git', into], check=True)
    return subprocess.check_output(['git', '-C', into, 'rev-parse', 'HEAD']).decode().strip()


def repo_files(src):
    """Every file in a cloned repo, as forward-slash paths relative to it (skipping .git)."""
    out = []
    for base, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d != '.git']
        for f in files:
            out.append(os.path.relpath(os.path.join(base, f), src).replace(os.sep, '/'))
    return sorted(out)


def remove(dest, rel):
    """Delete dest/rel if present, then any folders it leaves empty (never dest itself)."""
    path = os.path.join(dest, rel)
    if not os.path.isfile(path):
        return False
    os.remove(path)
    parent = os.path.dirname(path)
    while os.path.abspath(parent) != os.path.abspath(dest) and os.path.isdir(parent) and not os.listdir(parent):
        os.rmdir(parent)
        parent = os.path.dirname(parent)
    return True


def sync(item, workdir):
    repo, dest = item['repo'], os.path.join(ROOT, item['dest'])
    print(f'Fetching {repo} -> {item["dest"]}')
    src = os.path.join(workdir, 'src')
    shutil.rmtree(src, ignore_errors=True)
    commit = clone(repo, src)
    os.makedirs(dest, exist_ok=True)
    listed = item.get('files')

    if listed:
        for s in listed:
            if not os.path.isfile(os.path.join(src, s)):
                sys.exit(f'ERROR: {repo} has no {s} (listed in config/sources.json); nothing copied.')
        publish = {}                                   # dest-relative path -> source path
        for s, t in listed.items():
            publish[t] = s
    else:
        docs_is_site = os.path.isfile(os.path.join(src, 'docs', 'index.html'))
        publish = {rel: rel for rel in repo_files(src) if not is_dev_file(rel, docs_is_site)}

    # Prune what earlier syncs copied but is no longer published
    pruned = [rel for rel in repo_files(src) if rel not in publish and remove(dest, rel)]
    for rel in pruned:
        print(f'  removed {item["dest"]}/{rel}')

    for target, s in publish.items():
        out = os.path.join(dest, target)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        shutil.copy2(os.path.join(src, s), out)

    with open(os.path.join(dest, 'SOURCE.txt'), 'w') as sf:
        sf.write(f'Source: {repo}\nCommit: {commit}\n')
    shutil.rmtree(src, ignore_errors=True)


def main():
    with open(os.path.join(ROOT, 'config', 'sources.json')) as f:
        config = json.load(f)
    with tempfile.TemporaryDirectory() as workdir:
        for item in config.get('games', []) + config.get('tools', []):
            sync(item, workdir)

        # Shared files copied into several projects (like Midnight's engine.js)
        for shared in config.get('shared_dependencies', []):
            print(f'Fetching shared dependencies from {shared["source_repo"]}...')
            src = os.path.join(workdir, 'shared')
            shutil.rmtree(src, ignore_errors=True)
            clone(shared['source_repo'], src)
            for d in shared['destinations']:
                out = os.path.join(ROOT, d)
                os.makedirs(os.path.dirname(out), exist_ok=True)
                shutil.copy2(os.path.join(src, shared['source_path']), out)
            shutil.rmtree(src, ignore_errors=True)


if __name__ == '__main__':
    main()
