import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import {root} from './database.mjs';
import {uiFixture,catalog} from './idle-ui-fixture.mjs';
const manifest=JSON.parse(readFileSync(new URL('../../assets/items-v017/manifest.json',import.meta.url)));
const names=[...new Set([...catalog.items.map(x=>x.id),...catalog.recipes.map(x=>x.output_item)])];
assert.equal(names.length,232);assert.deepEqual(Object.keys(manifest.items).sort(),names.sort());assert.equal(new Set(Object.values(manifest.items).map(c=>[c.sheet,c.col,c.row].join(':'))).size,232);
const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_CHANNEL==='chromium'?{}:{channel:'chrome'})});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
let state=uiFixture(),hold=false,held=null;
const lite=s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['itemDefs','recipes','sites','account','evolutionDefs','skillDefs'].includes(key)));
await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',r=>r.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.__qaSession||null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})},rpc:async()=>({data:[],error:null})})}`}));
await page.route('https://xtvhisddjtfnsumprgpm.supabase.co/**',async r=>{
 const body=r.request().postDataJSON();if(body.action==='state-lite'&&hold){hold=false;held={route:r,state:structuredClone(state)};return;}
 if(body.action==='candidate-lock')state.player.gold+=10;
 await r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,stateMode:body.stateMode==='lite'?'lite':'full',state:body.stateMode==='lite'?lite(state):state})});
});
const waitHeld=async()=>{const deadline=Date.now()+5000;while(!held&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert(held,'poll held');};
try{
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:8125',{waitUntil:'networkidle'});
 await page.evaluate(s=>{S=s;session=window.__qaSession={access_token:'synthetic-only'};document.querySelector('#authGate').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');screen='hunt';render()},state);
 assert.equal(await page.locator('#view>.campaign-rule').count(),0);
 assert(await page.evaluate(()=>{const button=document.querySelector('.campaign-card-actions button');button.focus();S.sites[0].progress.normal_battles=501;Campaign.refresh();return button.isConnected&&document.activeElement===button}),'progress poll preserves the button being clicked');
 for(const fail of [false,true]){
  hold=true;held=null;await page.evaluate(()=>{window.__heldPoll=window.__frontendPollNow()});await waitHeld();
  await page.evaluate(()=>api('candidate-lock',{candidateId:S.candidates[0].id,locked:true}));
  const gold=state.player.gold;
  await held.route.fulfill({status:fail?500:200,contentType:'application/json',body:JSON.stringify(fail?{error:'server_error'}:{ok:true,state:lite(held.state)})});
  await page.evaluate(()=>window.__heldPoll);assert.equal(await page.evaluate(()=>S.player.gold),gold,'late poll success/error cannot revert newer action');assert.equal(await page.evaluate(()=>S.itemDefs.length),206,'partial commands retain item catalog');
 }
 const coverage=await page.evaluate(async names=>{for(const name of names)if(!ItemArt.has(name)||!itemSvg(itemAsset(name)).includes('data-item-art'))throw Error(name);await Promise.all([...new Set(Object.values(ItemArt.cells).map(c=>c.sheet))].map(sheet=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.width===750&&img.height===750?resolve():reject(Error(sheet+' dimensions'));img.onerror=()=>reject(Error(sheet+' unavailable'));img.src=`assets/items-v017/${sheet}.webp`;})));return names.length},names);
 assert.equal(coverage,232);
 await page.evaluate(names=>{closeModal(true);document.querySelector('#view').innerHTML=`<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">${names.map(name=>`<div style="font-size:10px;text-align:center"><span style="display:block;width:64px;height:64px;margin:auto">${itemSvg(itemAsset(name))}</span>${esc(name)}</div>`).join('')}</div>`},names);
 mkdirSync(root+'tools/simulation/results/items',{recursive:true});await page.screenshot({path:root+'tools/simulation/results/items/gallery.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS 232 exact item sprites, ten loaded atlases, stable hunt controls and late response/error ordering');
}finally{await browser.close()}
