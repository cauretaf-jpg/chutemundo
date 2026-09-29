
const core = window.ChuteMundoCore;
const model = window.ChuteDetailModel || {};
const VERSION = window.CHUTE_APP_VERSION || '6.0.0';
if (!core) throw new Error('Chute Mundo no está disponible para iniciar la capa v6.');

const esc = model.esc || ((value='') => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])));
const state = () => core.getState?.() || { teams:[], tournaments:[], friendlies:[] };
const teamName = id => core.teamName?.(id) || state().teams?.find(team => team.id === id)?.name || id || 'Por definir';
const played = match => core.matchPlayed?.(match) ?? (match?.homeGoals !== null && match?.homeGoals !== '' && match?.awayGoals !== null && match?.awayGoals !== '');
const resolve = (tournament, match) => ({
  home: match?.home || match?.homeTeamId || core.resolveHome?.(tournament, match),
  away: match?.away || match?.awayTeamId || core.resolveAway?.(tournament, match)
});
const allOfficialMatches = () => (state().tournaments || []).flatMap((tournament, tournamentIndex) =>
  (tournament.matches || []).filter(match => match?.stage !== 'bye').map((match, matchIndex) => ({ tournament, match, tournamentIndex, matchIndex, ...resolve(tournament, match) }))
);

function parseDate(value) {
  if (!value) return null;
  if (typeof value === 'number') return value;
  const raw = String(value).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d,m,y] = raw.split('/');
    const n = Date.parse(`${y}-${m}-${d}T12:00:00`);
    return Number.isFinite(n) ? n : null;
  }
  const n = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw);
  return Number.isFinite(n) ? n : null;
}

function ensureStyle() {
  if (document.getElementById('cmV6Css')) return;
  const link = document.createElement('link');
  link.id = 'cmV6Css';
  link.rel = 'stylesheet';
  link.href = `/styles/enhancements.css?v=${VERSION}`;
  document.head.appendChild(link);
}

function canonicalVersion() {
  document.documentElement.dataset.chuteVersion = VERSION;
  document.title = `Chute Mundo v${VERSION} · Competición`;
  const version = document.querySelector('.hero .eyebrow');
  if (version) version.textContent = `CHUTE MUNDO v${VERSION}`;
}

function installStateEvents() {
  if (core.setState?.__cmV6EventBridge) return;
  const original = core.setState.bind(core);
  const bridged = next => {
    const result = original(next);
    document.dispatchEvent(new CustomEvent('chute:state-changed', { detail:{ source:'core.setState' } }));
    return result;
  };
  Object.defineProperty(bridged, '__cmV6EventBridge', { value:true });
  core.setState = bridged;
}

function nextMatch() {
  const rows = allOfficialMatches().filter(row => row.home && row.away && !played(row.match));
  rows.sort((a,b) => {
    const da = parseDate(a.match.date) ?? Number.MAX_SAFE_INTEGER;
    const db = parseDate(b.match.date) ?? Number.MAX_SAFE_INTEGER;
    return da-db || a.tournamentIndex-b.tournamentIndex || a.matchIndex-b.matchIndex;
  });
  return rows[0] || null;
}

function recentMatches(limit=3) {
  return allOfficialMatches().filter(row => row.home && row.away && played(row.match)).sort((a,b) => {
    const da = parseDate(a.match.date) ?? (a.tournamentIndex*1000+a.matchIndex);
    const db = parseDate(b.match.date) ?? (b.tournamentIndex*1000+b.matchIndex);
    return db-da;
  }).slice(0,limit);
}

function topPlayer() {
  const rows = model.playerStatistics?.(core) || [];
  return [...rows].sort((a,b) => b.contributions-a.contributions || b.goals-a.goals || b.assists-a.assists)[0] || null;
}

function matchLine(row) {
  if (!row) return '<p class="empty">No hay un partido pendiente definido.</p>';
  const score = played(row.match) ? `${Number(row.match.homeGoals||0)}–${Number(row.match.awayGoals||0)}` : 'vs';
  return `<div class="cm-v6-match-line"><span><strong>${esc(teamName(row.home))}</strong><small>${esc(row.tournament.name||'Torneo')}</small></span><b>${score}</b><span class="away"><strong>${esc(teamName(row.away))}</strong><small>${esc(row.match.date||row.match.venue||'Por programar')}</small></span></div>`;
}

function renderDashboard() {
  const home = document.getElementById('inicio');
  if (!home) return;
  let root = document.getElementById('cmV6Dashboard');
  if (!root) {
    root = document.createElement('section');
    root.id = 'cmV6Dashboard';
    root.className = 'cm-v6-dashboard-grid';
    const notice = document.getElementById('sourceNotice');
    (notice || home.querySelector('.hero'))?.insertAdjacentElement('afterend', root);
  }
  const next = nextMatch();
  const recent = recentMatches(2);
  const star = topPlayer();
  root.innerHTML = `
    <article class="cm-v6-dashboard-card"><p class="eyebrow">PRÓXIMO</p><h3>Próximo partido</h3>${matchLine(next)}</article>
    <article class="cm-v6-dashboard-card"><p class="eyebrow">RESULTADOS</p><h3>Últimos partidos</h3>${recent.length?recent.map(matchLine).join(''):'<p class="empty">Aún no hay resultados.</p>'}</article>
    <article class="cm-v6-dashboard-card"><p class="eyebrow">JUGADOR</p><h3>Máxima contribución</h3>${star?`<div class="cm-v6-player-hero">${model.photo?.(star.teamId,star.name,'cm-player-face-lg')||''}<div class="cm-v6-player-meta"><h2>${esc(star.name)}</h2><p>${esc(teamName(star.teamId))}</p><p><strong>${star.goals||0}</strong> goles · <strong>${star.assists||0}</strong> asistencias</p></div></div>`:'<p class="empty">Sin estadísticas individuales.</p>'}</article>`;
}

function historicalRows() {
  const rows = new Map((state().teams || []).map(team => [team.id,{ teamId:team.id,titles:0,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0 }]));
  const get = id => {
    if (!rows.has(id)) rows.set(id,{teamId:id,titles:0,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0});
    return rows.get(id);
  };
  for (const tournament of state().tournaments || []) {
    if (tournament.champion) get(tournament.champion).titles += 1;
    for (const match of tournament.matches || []) {
      if (match?.stage === 'bye' || !played(match)) continue;
      const {home,away} = resolve(tournament,match);
      if (!home || !away) continue;
      const hg=Number(match.homeGoals||0), ag=Number(match.awayGoals||0);
      for (const [id,gf,gc] of [[home,hg,ag],[away,ag,hg]]) {
        const row=get(id); row.pj++; row.gf+=gf; row.gc+=gc;
        if (gf>gc){row.pg++;row.pts+=3;} else if(gf===gc){row.pe++;row.pts+=1;} else row.pp++;
      }
    }
  }
  return [...rows.values()].map(row=>({...row,dg:row.gf-row.gc}))
    .filter(row=>row.pj||row.titles)
    .sort((a,b)=>b.titles-a.titles||b.pts-a.pts||b.dg-a.dg||b.gf-a.gf||teamName(a.teamId).localeCompare(teamName(b.teamId),'es'));
}

function renderHistoricalRanking() {
  const page = document.getElementById('estadisticas');
  if (!page) return;
  let intro = document.getElementById('cmV6RankingIntro');
  if (!intro) {
    intro = document.createElement('article');
    intro.id='cmV6RankingIntro';
    intro.className='panel';
    const filter = page.querySelector('.filter-panel');
    (filter||page.querySelector('.page-title'))?.insertAdjacentElement('afterend',intro);
  }
  intro.innerHTML = `<div class="panel-head"><div><p class="eyebrow">TRES LECTURAS</p><h2>Cómo leer el rendimiento histórico</h2></div></div>
  <div class="cm-v6-ranking-intro">
    <button type="button" data-cm-v6-jump="fifa"><strong>Ranking FIFA</strong><span>Fuerza actual: ELO, rival, fase, diferencia de gol y bonos.</span></button>
    <button type="button" data-cm-v6-jump="historical"><strong>Ranking histórico</strong><span>Legado: primero títulos, luego puntos y diferencia de gol.</span></button>
    <button type="button" data-cm-v6-jump="table"><strong>Tabla histórica</strong><span>Rendimiento acumulado puro de los partidos oficiales.</span></button>
  </div>`;
  let panel=document.getElementById('cmV6HistoricalRanking');
  if(!panel){
    panel=document.createElement('article');
    panel.id='cmV6HistoricalRanking';
    panel.className='panel';
    const tournamentStats=document.getElementById('tournamentStats')?.closest('.panel');
    (tournamentStats||intro).insertAdjacentElement('afterend',panel);
  }
  const rows=historicalRows();
  panel.innerHTML=`<div class="cm-v6-historical-head"><div><p class="eyebrow">LEGADO</p><h2>Ranking histórico</h2><p>Orden oficial de legado: títulos, puntos históricos, diferencia de gol y goles a favor.</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>Equipo</th><th>Títulos</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>Pts</th><th>DG</th></tr></thead><tbody>${rows.map((row,index)=>`<tr><td><b>${index+1}</b></td><td><strong>${esc(teamName(row.teamId))}</strong></td><td>${row.titles}</td><td>${row.pj}</td><td>${row.pg}</td><td>${row.pe}</td><td>${row.pp}</td><td><strong>${row.pts}</strong></td><td>${row.dg>0?'+':''}${row.dg}</td></tr>`).join('')}</tbody></table></div>
    <p class="cm-v6-method-note">Este ranking no reemplaza el Ranking FIFA/ELO. Mide legado histórico y conserva el criterio utilizado en el archivo histórico de ChuteMundo.</p>`;
}

function playerRow(teamId,name) {
  return (model.playerStatistics?.(core)||[]).find(row=>row.teamId===teamId && row.name===name) || {teamId,name,goals:0,assists:0,appearances:0,yellows:0,reds:0,contributions:0};
}

function playerRecent(teamId,name) {
  return allOfficialMatches().filter(row=>played(row.match)&&(row.home===teamId||row.away===teamId)).filter(row=>{
    return (row.match.goals||[]).some(event=>event.playerName===name||event.scorer===name||event.assistName===name||event.assist===name) ||
      (row.match.cards||[]).some(event=>event.playerName===name) ||
      JSON.stringify(row.match.lineups||row.match.lineup||row.match.substitutions||[]).includes(name);
  }).sort((a,b)=>(parseDate(b.match.date)||0)-(parseDate(a.match.date)||0)).slice(0,5);
}

function playerTitles(teamId) {
  return (state().tournaments||[]).filter(t=>t.champion===teamId).map(t=>t.name);
}

function openPlayerProfile(teamId,name) {
  const team=state().teams?.find(item=>item.id===teamId);
  if(!team||!name) return;
  const source=(team.players||[]).find(p=>(Array.isArray(p)?p[0]:p.name)===name);
  const position=Array.isArray(source)?source[1]:(source?.position||'Sin posición');
  const row=playerRow(teamId,name);
  const recent=playerRecent(teamId,name);
  const titles=playerTitles(teamId);
  core.openModal?.(`<div class="cm-v6-player-profile">
    <div class="cm-v6-player-hero">${model.photo?.(teamId,name,'cm-player-face-lg')||''}<div class="cm-v6-player-meta"><p class="eyebrow">PERFIL DE JUGADOR</p><h2>${esc(name)}</h2><p>${esc(position)} · ${esc(team.name)}</p><p>${row.appearances||0} apariciones registradas</p></div></div>
    <div class="cm-v6-player-stats"><span><b>${row.goals||0}</b><small>Goles</small></span><span><b>${row.assists||0}</b><small>Asistencias</small></span><span><b>${row.contributions||0}</b><small>G+A</small></span><span><b>${row.yellows||0}</b><small>Amarillas</small></span><span><b>${row.reds||0}</b><small>Rojas</small></span></div>
    <h3>Palmarés con el club actual</h3><p>${titles.length?titles.map(esc).join(' · '):'Sin títulos registrados con el club actual.'}</p>
    <h3>Actividad reciente registrada</h3>${recent.length?recent.map(matchLine).join(''):'<p class="empty">No hay eventos individuales recientes suficientes para construir la forma del jugador.</p>'}
  </div>`);
}

function wirePlayerCards() {
  document.querySelectorAll('#cmPlayersGrid .cm-player-card').forEach(card=>{
    if(card.dataset.cmV6Ready) return;
    card.dataset.cmV6Ready='1';
    card.tabIndex=0;
    card.setAttribute('role','button');
    const open=()=>openPlayerProfile(card.dataset.cmTeam,card.querySelector('strong')?.textContent?.trim());
    card.addEventListener('click',open);
    card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
  });
}

function enhanceTournamentForm() {
  const form=document.getElementById('tournamentForm');
  if(!form||form.querySelector('.cm-v6-form-advanced')) return;
  const grid=form.querySelector('.form-grid');
  const help=document.getElementById('formatHelp');
  if(!grid) return;
  const details=document.createElement('details');
  details.className='cm-v6-form-advanced';
  details.innerHTML='<summary>Configuración avanzada</summary>';
  grid.insertAdjacentElement('beforebegin',details);
  details.appendChild(grid);
  if(help) details.appendChild(help);
}

function renderStorageModel() {
  const admin=document.getElementById('administracion');
  if(!admin) return;
  let panel=document.getElementById('cmV6StorageModel');
  if(!panel){
    panel=document.createElement('article');
    panel.id='cmV6StorageModel';
    panel.className='panel';
    admin.querySelector('.page-title')?.insertAdjacentElement('afterend',panel);
  }
  panel.innerHTML=`<p class="eyebrow">ARQUITECTURA DE DATOS</p><h2>Fuente oficial y respaldos</h2>
  <div class="cm-v6-source-grid">
    <div class="cm-v6-source-card is-primary"><strong>Firebase · fuente oficial</strong><span>Torneos, equipos, partidos, eventos y estadísticas compartidas.</span></div>
    <div class="cm-v6-source-card"><strong>Almacenamiento local · caché</strong><span>Permite recuperación rápida y trabajo resiliente, pero no define la verdad oficial.</span></div>
    <div class="cm-v6-source-card"><strong>JSON · respaldo portable</strong><span>Exportación para recuperación, auditoría y migraciones controladas.</span></div>
  </div>`;
}

function ensureMobileNavigation() {
  if(document.getElementById('cmV6MobileNav')) return;
  const nav=document.createElement('nav');
  nav.id='cmV6MobileNav';
  nav.className='cm-v6-mobile-nav';
  nav.setAttribute('aria-label','Navegación móvil');
  nav.innerHTML=`
    <button data-cm-v6-page="inicio"><span>⌂</span>Inicio</button>
    <button data-cm-v6-page="torneos"><span>🏆</span>Torneos</button>
    <button data-cm-v6-page="partidos"><span>⚽</span>Partidos</button>
    <button data-cm-v6-page="equipos"><span>🛡️</span>Equipos</button>
    <button data-cm-v6-more><span>•••</span>Más</button>`;
  document.body.appendChild(nav);
  const sheet=document.createElement('div');
  sheet.id='cmV6MoreSheet';
  sheet.className='cm-v6-more-sheet';
  sheet.hidden=true;
  sheet.innerHTML=`
    <button data-cm-v6-page="jugadores">Jugadores</button>
    <button data-cm-v6-page="estadisticas">Estadísticas</button>
    <button data-cm-v6-page="disciplina">Disciplina</button>
    <button data-cm-v6-page="administracion">Administración</button>`;
  document.body.appendChild(sheet);
  syncMobileNavigation();
}

function syncMobileNavigation() {
  const active=[...document.querySelectorAll('.page')].find(page=>!page.hidden)?.id||'inicio';
  document.querySelectorAll('[data-cm-v6-page]').forEach(button=>button.classList.toggle('active',button.dataset.cmV6Page===active));
}

function jumpRanking(target) {
  let node=null;
  if(target==='fifa') node=document.querySelector('[data-cm-v525-panel="fifa"]')||document.querySelector('[data-cm-v521-panel="fifa"]');
  if(target==='historical') node=document.getElementById('cmV6HistoricalRanking');
  if(target==='table') node=document.getElementById('globalTable')?.closest('.panel')||document.getElementById('globalTable');
  node?.scrollIntoView({behavior:'smooth',block:'start'});
}

function refresh() {
  canonicalVersion();
  renderDashboard();
  renderHistoricalRanking();
  renderStorageModel();
  enhanceTournamentForm();
  wirePlayerCards();
  syncMobileNavigation();
}

document.addEventListener('click',event=>{
  const page=event.target.closest('[data-cm-v6-page]');
  if(page){core.navigate(page.dataset.cmV6Page);document.getElementById('cmV6MoreSheet').hidden=true;setTimeout(refresh,0);return;}
  if(event.target.closest('[data-cm-v6-more]')){const sheet=document.getElementById('cmV6MoreSheet');sheet.hidden=!sheet.hidden;return;}
  const jump=event.target.closest('[data-cm-v6-jump]');
  if(jump) jumpRanking(jump.dataset.cmV6Jump);
  setTimeout(()=>{wirePlayerCards();syncMobileNavigation();},0);
});
document.addEventListener('chute:state-changed',()=>requestAnimationFrame(refresh));
document.addEventListener('chute:ready',()=>requestAnimationFrame(refresh));
document.addEventListener('chute:boot-complete',()=>requestAnimationFrame(refresh));

ensureStyle();
installStateEvents();
ensureMobileNavigation();
refresh();

window.ChuteV6 = Object.freeze({version:VERSION,refresh,historicalRows,openPlayerProfile});
