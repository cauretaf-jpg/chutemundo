
import { chromium } from 'playwright';

const sizes = [
  { name:'mobile-small', width:360,height:800 },
  { name:'mobile-standard', width:390,height:844 },
  { name:'mobile-large', width:412,height:915 },
  { name:'tablet', width:768,height:1024 },
  { name:'desktop', width:1440,height:900 }
];
const sections = ['inicio','torneos','partidos','equipos','jugadores','estadisticas','disciplina','administracion'];
const browser = await chromium.launch({headless:true});
const failures=[];
try {
  for(const size of sizes) {
    const context=await browser.newContext({viewport:size,serviceWorkers:'block'});
    const page=await context.newPage();
    const pageErrors=[], badResources=[];
    page.on('pageerror',error=>pageErrors.push(String(error)));
    page.on('response',r=>{if(r.status()>=400&&/\.(?:mjs|css|js)(?:\?|$)/i.test(r.url()))badResources.push(r.status()+' '+r.url());});
    try {
      await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.ChuteExperience?.enabled===true&&window.ChuteMundoCore&&document.querySelector('#cm62Root h1'),{timeout:20000});
      const status=await page.evaluate(()=>({
        version:window.CHUTE_APP_VERSION,
        rootVisible:getComputedStyle(document.getElementById('cm62Root')).display!=='none',
        oldPageVisible:getComputedStyle(document.getElementById('inicio')).display!=='none',
        navVisible:getComputedStyle(document.getElementById('cm62BottomNav')).display!=='none',
        titleCount:document.querySelectorAll('#cm62Root h1').length,
        width:document.documentElement.scrollWidth,
        viewport:document.documentElement.clientWidth
      }));
      if(status.version!=='6.2.0')failures.push(size.name+': versión incorrecta '+JSON.stringify(status));
      if(!status.rootVisible||status.oldPageVisible)failures.push(size.name+': fuente antigua visible o experiencia oculta');
      if(status.titleCount!==1)failures.push(size.name+': Inicio contiene títulos principales duplicados');
      if(status.width>status.viewport+3)failures.push(size.name+': Inicio desborda '+JSON.stringify(status));
      if(size.width<=760&&!status.navVisible)failures.push(size.name+': falta navegación móvil');
      if(size.width>760&&status.navVisible)failures.push(size.name+': navegación móvil visible en escritorio');
      if(size.name==='mobile-standard')await page.screenshot({path:'/tmp/chute-6-2-inicio.png',fullPage:true});
      for(const id of sections) {
        await page.evaluate(id=>window.ChuteExperience.navigate('/'+id),id);
        await page.waitForTimeout(35);
        const view=await page.evaluate(()=>({
          title:document.querySelector('#cm62Root h1')?.textContent||'',
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
          content:document.querySelector('#cm62Root .cm62-content')?.textContent?.length||0
        }));
        if(!view.title||view.content<20)failures.push(size.name+': pantalla '+id+' sin contenido '+JSON.stringify(view));
        if(view.overflow>3)failures.push(size.name+': desbordamiento en '+id+' '+JSON.stringify(view));
      }
      const keys=await page.evaluate(()=>{
        const source=window.ChuteMundoCore.getState();
        const t=source.tournaments?.find(t=>(t.matches||[]).some(m=>m.stage!=='bye'))||source.tournaments?.[0];
        const m=t?.matches?.find(m=>m.stage!=='bye');
        const club=source.teams?.find(t=>(t.players||[]).length);
        const player=club?.players?.[0];
        const name=Array.isArray(player)?player[0]:player?.name;
        return {t:t?.id||'',m:m?.id||'',club:club?.id||'',player:name||''};
      });
      if(!keys.t||!keys.m||!keys.club||!keys.player) {
        failures.push(size.name+': datos base incompletos '+JSON.stringify(keys));
        continue;
      }
      const enc=encodeURIComponent;
      const routes=[
        '/torneos/'+enc(keys.t),
        '/torneos/'+enc(keys.t)+'/partidos',
        '/torneos/'+enc(keys.t)+'/tabla',
        '/torneos/'+enc(keys.t)+'/lideres',
        '/torneos/'+enc(keys.t)+'/historia',
        '/partidos/'+enc(keys.t)+'/'+enc(keys.m),
        '/partidos/'+enc(keys.t)+'/'+enc(keys.m)+'/eventos',
        '/partidos/'+enc(keys.t)+'/'+enc(keys.m)+'/alineaciones',
        '/equipos/'+enc(keys.club),
        '/equipos/'+enc(keys.club)+'/plantel',
        '/equipos/'+enc(keys.club)+'/partidos',
        '/equipos/'+enc(keys.club)+'/historia',
        '/jugadores/'+enc(keys.club)+'/'+enc(keys.player),
        '/jugadores/'+enc(keys.club)+'/'+enc(keys.player)+'/carrera',
        '/jugadores/'+enc(keys.club)+'/'+enc(keys.player)+'/palmares',
        '/estadisticas/tabla','/estadisticas/fifa','/estadisticas/historico','/estadisticas/palmares','/estadisticas/records','/estadisticas/h2h'
      ];
      for(const route of routes) {
        await page.evaluate(route=>window.ChuteExperience.navigate(route),route);
        const view=await page.evaluate(()=>({
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
          error:Boolean(document.querySelector('#cm62Root .cm62-error')),
          content:document.querySelector('#cm62Root .cm62-content')?.textContent?.length||0,
          route:window.ChuteExperience.route()
        }));
        if(view.error||view.content<20||view.route!==route||view.overflow>3)
          failures.push(size.name+': ruta '+route+' falló '+JSON.stringify(view));
      }
      if(size.name==='mobile-standard'){
        await page.evaluate(()=>window.ChuteExperience.navigate('/torneos/'+encodeURIComponent(keys.t)));
        await page.screenshot({path:'/tmp/chute-6-2-torneo.png',fullPage:true});
        await page.evaluate(()=>window.ChuteExperience.navigate('/equipos/'+encodeURIComponent(keys.club)));
        await page.screenshot({path:'/tmp/chute-6-2-club.png',fullPage:true});
      }
      await page.evaluate(()=>window.ChuteExperience.navigate('/torneos'));
      await page.evaluate(()=>window.ChuteExperience.navigate('/equipos/'+encodeURIComponent(keys.club)));
      await page.evaluate(()=>window.ChuteExperience.back());
      await page.waitForFunction(()=>window.ChuteExperience.route()==='/torneos',{timeout:4000});
      if(badResources.length) failures.push(size.name+': recursos rotos '+badResources.join(' | '));
      const critical=pageErrors.filter(e=>!/FirebaseError|firestore|permission-denied|Failed to fetch|network|ERR_/i.test(e));
      if(critical.length)failures.push(size.name+': errores JavaScript '+critical.join(' | '));
    }catch(error){
      failures.push(size.name+': '+String(error));
    }finally{
      await context.close();
    }
  }
}finally{
  await browser.close();
}
if(failures.length){
  console.error('ChuteMundo 6.2 immersive smoke: FALLÓ');
  failures.forEach(x=>console.error(' - '+x));
  process.exit(1);
}
console.log('ChuteMundo 6.2 immersive smoke: OK; 8 secciones + 21 rutas contextuales + 5 resoluciones');
