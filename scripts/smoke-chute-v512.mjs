import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
try{
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ChuteMundoCore&&window.ChuteV511Core&&window.ChuteV511Tournaments&&window.ChuteV511MatchShare&&window.ChuteV512);
  const manifest=await page.request.get('http://127.0.0.1:4173/manifest.webmanifest');
  const sw=await page.request.get('http://127.0.0.1:4173/sw.js');
  const result=await page.evaluate(()=>{
    const core=window.ChuteMundoCore;
    const state=JSON.parse(JSON.stringify(core.getState()));
    const source=state.tournaments.find(t=>(t.teamIds||[]).length>1);
    const copy=JSON.parse(JSON.stringify(source));
    copy.id='tour_smoke_v512';copy.status='upcoming';copy.matches=(copy.matches||[]).map(m=>({...m,homeGoals:null,awayGoals:null,goals:[],cards:[]}));state.tournaments.push(copy);
    const next=window.ChuteV511Tournaments.randomize(state,copy.id);
    const target=next.tournaments.find(t=>t.id===copy.id);
    const sameTeams=[...target.teamIds].sort().join('|')===[...copy.teamIds].sort().join('|');
    const started=window.ChuteV511Tournaments.changeStatus(next,copy.id,'active');
    return {core:window.ChuteV511Core.version,tournaments:window.ChuteV511Tournaments.version,share:window.ChuteV511MatchShare.version,integrity:window.ChuteV512.version,sameTeams,started:started.tournaments.find(t=>t.id===copy.id).status,search:window.ChuteV511Core.rows((state.teams[0]?.name||'').slice(0,3)).length,issues:Array.isArray(window.ChuteV512.issues()),manifest:Boolean(document.querySelector('link[rel="manifest"]')),toolbar:Boolean(document.getElementById('cmV511Toolbar')),width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};
  });
  if(!manifest.ok()||!sw.ok()||result.core!=='5.11.0'||result.tournaments!=='5.11.0'||result.share!=='5.11.0'||result.integrity!=='5.12.0'||!result.sameTeams||result.started!=='active'||result.search<1||!result.issues||!result.manifest||!result.toolbar||result.width>result.viewport+3)throw new Error(JSON.stringify(result));
  console.log('Chute Mundo v5.12 smoke OK',result);
}finally{await browser.close();}