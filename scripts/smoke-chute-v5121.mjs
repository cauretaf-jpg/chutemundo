import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
try{
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ChuteV511Core&&window.ChuteV511Tournaments&&window.ChuteV5121Search&&window.ChuteV5121Backup);
  const result=await page.evaluate(()=>{
    const core=window.ChuteMundoCore,team=core.getState().teams.find(item=>(item.players||[]).length),player=team&&team.players[0],name=Array.isArray(player)?player[0]:player?.name;
    const search=name?window.ChuteV511Core.rows(name).find(row=>row[0]==='player'):null;
    const source={teams:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}],tournaments:[{id:'league_test',name:'Liga test',type:'league',status:'active',teamIds:['a','b','c'],matches:[{id:'1',stage:'regular',home:'a',away:'b',homeGoals:2,awayGoals:0},{id:'2',stage:'regular',home:'a',away:'c',homeGoals:1,awayGoals:1},{id:'3',stage:'regular',home:'b',away:'c',homeGoals:0,awayGoals:1}]}]};
    const finished=window.ChuteV511Tournaments.changeStatus(source,'league_test','historical').tournaments[0];
    return{title:document.title,coreVersion:window.ChuteV511Core.version,searchVersion:window.ChuteV5121Search.version,backupVersion:window.ChuteV5121Backup.version,playerId:search?.[1]||'',champion:finished.champion,runnerUp:finished.runnerUp,width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};
  });
  if(!/5\.(12\.1|13|14)/.test(result.title)||result.coreVersion!=='5.11.1'||result.searchVersion!=='5.12.1'||result.backupVersion!=='5.12.1'||!result.playerId.includes('__')||result.playerId.includes('::')||result.champion!=='a'||result.runnerUp!=='c'||result.width>result.viewport+3)throw new Error(JSON.stringify(result));
  console.log('Chute Mundo v5.12.1 regression smoke OK',result);
}finally{await browser.close();}
