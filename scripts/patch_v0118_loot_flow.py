from pathlib import Path

patch = Path('scripts/patch_v0126_party_roles.py')
code = compile(patch.read_text(), str(patch), 'exec')
exec(code, {'__name__': '__main__'})
