#!/usr/bin/env python3
"""Run the real shop frontend with synthetic state, never a real account.
Requires playwright==1.56.0 and its Chromium browser.
QA_BASE_URL optionally exercises deployed frontend bytes with mocked backend.
"""
import copy
import json
import mimetypes
import os
from pathlib import Path
import subprocess
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(os.getenv('QA_OUTPUT_DIR', ROOT / 'artifacts/shop-crafting-usage'))
OUTPUT.mkdir(parents=True, exist_ok=True)
fixture = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    "import {uiFixture} from './tools/simulation/idle-ui-fixture.mjs';console.log(JSON.stringify(uiFixture()))"
], cwd=ROOT, text=True))
fixture['player']['workshop_level'] = 1
fixture['craftJobs'] = []
fixture['sellJobs'] = []
state = copy.deepcopy(fixture)
actions, errors, checks = [], [], []
widths = [320, 360, 390, 430, 768, 1024]
remote_base = os.getenv('QA_BASE_URL')
base = remote_base or 'https://shop-usage.test'

with sync_playwright() as pw:
    options = {'headless': True}
    if os.getenv('QA_CHROMIUM_EXECUTABLE'):
        options['executable_path'] = os.environ['QA_CHROMIUM_EXECUTABLE']
    browser = pw.chromium.launch(**options)
    page = browser.new_page(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    page.set_default_timeout(10000)
    page.on('pageerror', lambda error: errors.append(str(error)))

    def route(request):
        url = request.request.url
        if url.endswith('/supabase.min.js'):
            request.fulfill(content_type='application/javascript', body="""
window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.__qaSession||null},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},
 rpc:async()=>({data:null,error:null})})};
""")
        elif '.supabase.co/' in url:
            data = request.request.post_data_json or {}
            actions.append(data)
            if data.get('action') == 'sell':
                item = next(x for x in state['inventory'] if x['item_id'] == data['itemId'])
                item['qty'] -= data['quantity']
                state['sellJobs'].append({'id':'synthetic-sale','item_id':data['itemId'],'quantity':data['quantity'],
                     'status':'running','started_at':'2026-01-01T00:00:00Z','finish_at':'2099-01-01T00:00:00Z'})
            request.fulfill(content_type='application/json', body=json.dumps({'ok':True,'state':state}))
        elif url.startswith(base):
            if remote_base:
                request.continue_()
            else:
                path = (ROOT / (urlparse(url).path.lstrip('/') or 'index.html')).resolve()
                if path.is_relative_to(ROOT) and path.is_file():
                    request.fulfill(content_type=mimetypes.guess_type(str(path))[0] or 'application/octet-stream', body=path.read_bytes())
                else:
                    request.fulfill(status=404,body='Missing test asset')
        else:
            request.abort()
    page.route('**/*', route)

    def install(data=None):
        page.evaluate("""x=>{S=x;window.__qaSession={access_token:'synthetic-test-only'};session=window.__qaSession;
 document.querySelector('#authGate').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');render();}
""", copy.deepcopy(data or state))

    def show_shop(search=''):
        page.evaluate("()=>{closeModal(true);IdleEconomy.show('sell')}")
        page.locator('[data-idle-econ="catalog"]').click()
        if search:
            page.locator('[data-idle-filter="text"]').fill(search)

    def usage(item):
        page.evaluate('item=>ShopCraftingUsage.show(item)', item)
        page.wait_for_selector('.shop-usage-root')

    def back():
        page.locator('[data-global-back]').click()
        page.wait_for_timeout(40)

    def layout(label):
        problems=page.evaluate("""()=>{
 const p=[],sheet=document.querySelector('#modal:not(.hidden) .sheet');
 if(document.documentElement.scrollWidth>innerWidth+2)p.push('document overflow');
 if(sheet&&sheet.scrollWidth>sheet.clientWidth+2)p.push('sheet overflow '+sheet.scrollWidth+'/'+sheet.clientWidth);
 const visible=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
 const intersects=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
 for(const el of document.querySelectorAll('.usage-hero-icon,.usage-product-icon,.usage-small-icon,.idle-item-icon')){
  if(!visible(el))continue;const r=el.getBoundingClientRect();if(Math.abs(r.width-r.height)>1)p.push('icon ratio');
  const sprite=el.querySelector(':scope>.pixel-item');if(sprite&&visible(sprite)){
   const s=sprite.getBoundingClientRect();if(s.width>r.width+1||s.height>r.height+1)p.push('sprite outside icon');
  }
 }
 for(const row of document.querySelectorAll('.idle-sale-item,.usage-product-open,.usage-ingredients li,.usage-sale-actions')){
  const children=[...row.children].filter(visible);
  for(let i=0;i<children.length;i++)for(let j=i+1;j<children.length;j++)
   if(intersects(children[i].getBoundingClientRect(),children[j].getBoundingClientRect()))p.push('sibling overlap '+row.className);
 }
 return p;
}""")
        assert not problems, f'{label}: {problems}'

    try:
        page.goto(base, wait_until='networkidle')
        install()
        page.locator('.facility-row.shop').click()
        page.locator('[data-idle-econ="catalog"]').click()
        page.locator('[data-idle-filter="text"]').fill('거친 천')
        assert page.locator('.idle-sale-item').count()==1
        old_actions=len([x for x in actions if x.get('action') not in ('state','state-lite')])
        page.locator('.idle-item-open').click()
        page.wait_for_selector('.shop-usage-root')
        assert page.locator('.usage-product').count()==8
        expected={r['id'] for r in state['recipes'] if '거친 천' in r['inputs']}
        actual=set(page.locator('.usage-product').evaluate_all('(xs)=>xs.map(x=>x.dataset.usageRecipe)'))
        assert actual==expected
        assert len([x for x in actions if x.get('action') not in ('state','state-lite')])==old_actions
        checks.append('item image/name opens all real direct recipes without selling')
        page.locator('[data-idle-econ="usage-filter"][data-filter="gear"]').click()
        assert page.locator('.usage-product').count()==4
        page.locator('.usage-product details summary').first.click()
        assert page.locator('.usage-selected-material').count()==4
        assert '필요 6' in page.locator('.usage-selected-material').first.inner_text()
        page.locator('.usage-product-open').first.click()
        assert page.locator('.usage-item-hero b').inner_text()=='산골 침투 작업복'
        assert page.locator('[data-idle-econ="usage-sell"]').count()==0
        page.locator('.usage-made-from summary').click()
        assert '강화석' in page.locator('.usage-made-from').inner_text()
        back()
        assert page.locator('[data-filter="gear"]').get_attribute('aria-pressed')=='true'
        assert page.locator('.usage-product details').first.get_attribute('open') is not None
        checks.append('equipment recipes, ingredients and nested detail/back preserve the selected tab')
        page.locator('[data-idle-econ="usage-craft"]').first.click()
        assert page.locator('[data-idle-econ="confirm"]').get_attribute('data-mode')=='craft'
        back();back()
        assert page.locator('[data-idle-filter="text"]').input_value()=='거친 천'
        page.locator('[data-idle-filter="text"]').fill('나무 조각')
        assert '보유' in page.locator('.idle-item-copy').inner_text()
        page.locator('.idle-item-queue').click()
        assert page.locator('[data-idle-econ="confirm"]').get_attribute('data-mode')=='sell'
        checks.append('craft preview does not corrupt sale mode, filters, or navigation')
        usage('잡화 꾸러미')
        assert '판매용 상품' in page.locator('.usage-purpose').inner_text()
        assert page.locator('.usage-product').count()==0
        assert page.locator('[data-idle-econ="usage-sell"]').is_enabled()
        page.locator('[data-idle-econ="usage-sell"]').click()
        page.locator('#idleQuantity').fill('2')
        page.locator('[data-idle-econ="confirm"]').click()
        page.wait_for_selector('.idle-economy-sheet')
        assert [x for x in actions if x.get('action')=='sell']==[{'action':'sell','itemId':'잡화 꾸러미','quantity':2}]
        assert next(x for x in state['inventory'] if x['item_id']=='잡화 꾸러미')['qty']==38
        checks.append('usage detail sells only the chosen item and quantity through the existing API')
        usage('강화석')
        assert page.locator('.usage-product').count()==60
        assert '대장간' in page.locator('.usage-purpose').inner_text()
        assert page.locator('.usage-product-status .locked').count()>0
        assert page.locator('[data-idle-econ="usage-sell"]').count()==0
        checks.append('locked higher recipes remain visible; enhancement stones cannot be sold')
        usage('거친 천')
        page.locator('[data-usage-recipe="scrap_bundle"] summary').click()
        state['inventory']= [{**x,'qty':0} if x['item_id']=='거친 천' else x for x in state['inventory']]
        install()
        page.evaluate('()=>IdleEconomy.refresh()')
        assert page.locator('[data-idle-econ="usage-sell"]').is_disabled()
        assert page.locator('[data-usage-recipe="scrap_bundle"] details').get_attribute('open') is not None
        assert page.locator('[data-usage-recipe="scrap_bundle"] [data-idle-econ="usage-craft"]').is_disabled()
        checks.append('live inventory refresh preserves expanded details and disables unavailable actions')
        state=copy.deepcopy(fixture);state['player']['workshop_level']=1;state['craftJobs']=[]
        state['sellJobs']=[{'id':f'full-{i}','status':'queued','item_id':'검증상품','quantity':1,'started_at':'2099-01-01','finish_at':'2099-01-02'} for i in range(5)]
        install();usage('거친 천')
        assert '대기열 가득' in page.locator('[data-idle-econ="usage-sell"]').inner_text()
        assert page.locator('[data-idle-econ="usage-sell"]').is_disabled()
        checks.append('full sales queue keeps usage readable and blocks enqueue')
        state=copy.deepcopy(fixture);state['player']['workshop_level']=1;state['craftJobs']=[];state['sellJobs']=[];install()
        for width in widths:
            page.set_viewport_size({'width':width,'height':844})
            show_shop('거친 천');layout(f'shop {width}')
            if width==360:page.screenshot(path=str(OUTPUT/'shop-360.png'),full_page=True)
            page.locator('.idle-item-open').click()
            page.locator('[data-usage-recipe="scrap_bundle"] summary').click()
            layout(f'usage {width}')
            page.locator('.sheet').evaluate('(e)=>e.scrollTop=0')
            if width in (320,360,768):page.screenshot(path=str(OUTPUT/f'usage-{width}.png'),full_page=True)
            page.locator('[data-idle-econ="usage-sell"]').click();layout(f'quantity {width}')
        checks.append('320/360/390/430/768/1024px: no horizontal overflow, sibling overlap, or squashed icons')
        unusual='검증<재료>"'
        state['itemDefs'].append({'id':unusual,'kind':'material','sale_gold':1,'sell_seconds':1,'description':'<script>bad</script>'})
        state['inventory'].append({'item_id':unusual,'qty':1})
        state['recipes'].append({'id':'qa-weird','output_item':'검증 상품','inputs':{unusual:1},'sale_gold':1,'output_qty':1,'craft_seconds':1,'workshop_level':1})
        install();usage(unusual)
        assert page.locator('.usage-item-hero b').inner_text()==unusual
        assert page.locator('.shop-usage-root script').count()==0
        checks.append('unknown artwork fallback and escaped item labels')
        assert errors==[], errors
        report={'passed':True,'base':base,'widths':widths,'synthetic_state_only':True,'real_account_data_used':False,'checks':checks,'page_errors':errors}
        (OUTPUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(json.dumps(report,ensure_ascii=False,indent=2))
    except Exception as exc:
        page.screenshot(path=str(OUTPUT/'failure.png'),full_page=True)
        (OUTPUT/'failure.json').write_text(json.dumps({'error':str(exc),'page_errors':errors,'modal':page.evaluate("document.querySelector('#modal')?.innerHTML||document.body.innerText"),'actions':actions},ensure_ascii=False,indent=2))
        raise
    finally:
        browser.close()
