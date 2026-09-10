import {chromium} from 'playwright';
import {root} from './database.mjs';
import {uiFixture} from './idle-ui-fixture.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_CHANNEL==='chromium'?{}:{channel:process.env.QA_BROWSER_CHANNEL||'chrome'})}),page=await browser.newPage({viewport:{width:390,height:844}});
await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',r=>r.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})}`}));
await page.goto('http://127.0.0.1:8125',{waitUntil:'networkidle'});
await page.evaluate(s=>{S=s;document.querySelector('#app').classList.remove('hidden');document.querySelector('#authGate').classList.add('hidden');},uiFixture());
const results=await page.evaluate(()=>{
 const results={};for(const name of ['home','hunt','defense']){screen=name;render();const times=[];let mutations=0;const observer=new MutationObserver(()=>{});observer.observe(document.querySelector('#app'),{childList:true,subtree:true});for(let i=0;i<60;i++){const t=performance.now();Campaign.refresh();OfficeUI.refresh();times.push(performance.now()-t);mutations+=observer.takeRecords().length;}observer.disconnect();times.sort((a,b)=>a-b);results[name]={medianMs:times[30],p95Ms:times[57],childMutations:mutations};}return results;
});
mkdirSync(root+'tools/simulation/results',{recursive:true});writeFileSync(`${root}tools/simulation/results/perf-${process.argv[2]||'current'}.json`,JSON.stringify(results,null,2));console.log(results);await browser.close();
