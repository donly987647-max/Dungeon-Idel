from pathlib import Path

p = Path('app.js')
s = p.read_text()
repls = {
    '<span>MONSTER PERSONNEL</span><h2>몬스터 인사부</h2>': '<span>MONSTER ROSTER</span><h2>몬스터 리스트</h2>',
    '<button data-go="monsters">직원 인사기록</button>': '<button data-go="monsters">몬스터 리스트</button>',
    "esc(m?.name||'직원')": "esc(m?.name||'몬스터')",
    "esc(m?.name||'직원')} · 서버 자동전투 관전": "esc(m?.name||'몬스터')} · 서버 자동전투 관전",
}
for old, new in repls.items():
    s = s.replace(old, new)
p.write_text(s)
