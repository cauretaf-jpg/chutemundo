import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.ChuteMundoCore&&window.ChuteV511Core&&window.ChuteV511Tournaments&&window.ChuteV512);
 const manifest=await page.request.get('http://127.0.0.1:4173/manifest.webmanifest');
 const sw=await page.request.get('http://127.0.0.1:4173/sw.js');
 const result=await page.evaluate(()=>{
  const core=window.ChuteMundoCore,s=JSON.parse(JSON.stringify(core.getState()));
  const source=s.tournaments.find(t=>t.status==='upcoming'&&(t.teamIds||[]).length>1&&!t.matches.some(m=>core.matchPlayed(m)))||s.tournaments.find(t=>(t.teamIds||[]).length>1);
  const copy=JSON.parse(JSON.stringify(source));copy.id='tour_smoke_v512';copy.status='upcoming';copy.matches=(copy.matches||[]).map(m=>({...m,homeGoals:null,awayGoals:null,goals:[],cards:[]}));s.tournaments.push(copy);
  const randomized=window.ChuteV511Tournaments.randomize(s,copy.id);
  const changed=JSON.stringify(randomized.tournaments.find(t=>t.id===copy.id).teamIds)!==JSON.stringify(copy.teamIds)||copy.teamIds.length<2;
  const started=window.ChuteV511Tournaments.changeStatus(randomized,copy.id,'active');
  const search=window.ChuteV511Core.rows((s.teams[0]?.name||'').slice(0,4));
  const issues=window.ChuteV512.issues();
  const suggestions=window.ChuteV512.suggestions(s.tournaments[0]);
  return{core:window.ChuteV511Core.version,tournaments:window.ChuteV511Tournaments.version,integrity:window.ChuteV512.version,changed,started:started.tournaments.find(t=>t.id===copy.id).status,search:search.length,issues:Array.isArray(issues),suggestions:typeof suggestions==='object',manifest:Boolean(document.querySelector('link[rel="manifest"]')),toolbar:Boolean(document.getElementById('cmV511Toolbar')),width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};
 });
 if(!manifest.ok()||!sw.ok()||result.core!=='5.11.0'||result.tournaments!=='5.11.0'||result.integrity!=='5.12.0'||!result.changed||result.started!=='active'||result.search<1||!result.issues||!result.suggestions||!result.manifest||!result.toolbar||result.width>result.viewport+3)throw new Error(JSON.stringify(result));
 const critical=errors.filter(x=>!/favicon|firestore|permission-denied|Failed to load resource|ERR_NAME_NOT_RESOLVED|service worker/i.test(x));if(critical.length)throw new Error(critical.join(' | '));
 console.log('Chute Mundo v5.12 smoke OK',result);
}finally{await browser.close();}