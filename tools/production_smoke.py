#!/usr/bin/env python3
"""Production must serve the actual checked-out release, not just return HTTP 200."""
import hashlib
import json
import os
from pathlib import Path
from html.parser import HTMLParser
import subprocess
import tempfile
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

BASE='https://hero-extermination-inc.vercel.app/'
ROOT=Path(__file__).resolve().parent.parent
revision=os.environ.get('GITHUB_SHA','smoke')
def fetch(path):
    suffix='&' if '?' in path else '?'
    req=Request(BASE+path+suffix+'qa='+revision,headers={'Cache-Control':'no-cache','User-Agent':'Dungeon-Idel-Release-QA'})
    with urlopen(req,timeout=15) as response:
        if response.status!=200:raise RuntimeError(f'{path}: {response.status}')
        return response.read()
def digest(data):return hashlib.sha256(data).hexdigest()
expected=(ROOT/'index.html').read_bytes()
last_error='not checked'
for attempt in range(36):
    try:
        actual=fetch('')
        if actual==expected:break
        last_error=f'production index differs from release: {digest(actual)} != {digest(expected)}'
    except Exception as error:last_error=str(error)
    time.sleep(4)
else:raise SystemExit('DEPLOYMENT_NOT_CURRENT: '+last_error)
class Assets(HTMLParser):
    def __init__(self):super().__init__();self.paths=set()
    def handle_starttag(self,tag,attrs):
        values=dict(attrs)
        value=values.get('src') if tag in ('script','img') else values.get('href') if tag=='link' else None
        if value and not urlsplit(value).scheme and not value.startswith('//'):self.paths.add(value)
assets=Assets();assets.feed(expected.decode())
assets.paths.update('assets/icon-'+name+'.svg' for name in ('dorm','recruit','workshop','shop','forge','storage','ops'))
assets.paths.update('assets/art-v014/'+name+'.webp' for name in ('headquarters','dormitory','recruitment','workshop','shop'))
for directory in ('assets/art-v015', 'assets/art-v016', 'assets/items-v017'):
    assets.paths.update(str(path.relative_to(ROOT)) for path in (ROOT/directory).rglob('*')
                        if path.is_file() and path.suffix.lower() in ('.png', '.webp', '.svg', '.jpg', '.jpeg'))
verified=[]
with tempfile.TemporaryDirectory() as folder:
    for path in sorted(assets.paths):
        relative=urlsplit(path).path.lstrip('/')
        local=ROOT/relative
        if not local.is_file():raise SystemExit('SOURCE_ASSET_MISSING: '+relative)
        data=fetch(path)
        if not data or data!=local.read_bytes():raise SystemExit('PRODUCTION_ASSET_MISMATCH: '+relative)
        if relative.endswith('.js'):
            temporary=Path(folder)/relative
            temporary.parent.mkdir(parents=True,exist_ok=True);temporary.write_bytes(data)
            subprocess.run(['node','--check',str(temporary)],check=True)
        verified.append(relative)
print('PRODUCTION_FRONTEND_SMOKE_OK=1')
print(json.dumps({'revision':revision,'indexSha256':digest(expected),'matchingAssets':verified},ensure_ascii=False))
