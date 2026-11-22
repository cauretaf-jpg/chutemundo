
export function createViews(core, model) {
  const esc = model.esc;
  const E = (tag, attrs = {}, ...children) => {
    const attributes = Object.entries(attrs).filter(([key, value]) => value !== undefined && value !== null && value !== false).map(([key, value]) => ' ' + key + '="' + esc(String(value)) + '"').join('');
    return '<' + tag + attributes + '>' + children.flat(Infinity).join('') + '</' + tag + '>';
  };
  const D = (cls, ...children) => E('div', { class: cls }, ...children);
  const S = (cls, ...children) => E('section', { class: cls }, ...children);
  const A = (label, route, cls = '') => E('a', { href: '#' + route, 'data-cm62-route': route, class: cls }, label);
  const B = (label, route, cls = '') => A(label, route, 'cm62-btn ' + cls);
  const P = (content, cls = '') => E('p', { class: cls }, content);
  const H = (title, subtitle = '', kicker = '') => D('cm62-pagehead', P(esc(kicker), 'cm62-kicker'), E('h1', {}, esc(title)), subtitle ? P(esc(subtitle), 'cm62-muted') : '');
  const card = (...parts) => { const last=parts.at(-1); const cls=parts.length>1 && /^cm62-[a-z0-9 -]+$/.test(last) ? parts.pop() : ''; return E('article', { class: 'cm62-card ' + cls }, parts); };
  const empty = (label) => D('cm62-empty', esc(label));
  const state = () => core.getState() || {teams:[],tournaments:[]};
  const played = (match) => core.matchPlayed(match);
  const teams = () => state().teams || [];
  const tournaments = () => state().tournaments || [];
  const teamName = (id) => id ? core.teamName(id) : 'Por definir';
  const team = (id) => teams().find(x=>x.id===id);
  const tournament = (id) => tournaments().find(x=>x.id===id);
  const players = () => teams().flatMap(x=>(x.players||[]).map(p=>({teamId:x.id,name:model.playerName(p),position:model.playerPosition(p)})));
  const stats = (selected) => model.playerStatistics(core, selected).filter(x=>x.role!=='coach');
  const photo = (id,name,cls='') => E('img',{src:model.photoUrl(id,name),alt:name,loading:'lazy',class:'cm62-photo '+cls});
  const logo = (id,cls='') => id ? E('img',{src:model.logoUrl(id),alt:teamName(id),loading:'lazy',class:'cm62-logo '+cls}) : D('cm62-logo cm62-logo-blank','?');
  const club = (id,small=false) => A(logo(id,small?'is-small':'')+E('strong',{},esc(teamName(id))),'/equipos/'+encodeURIComponent(id||''),'cm62-club-link');
  const playerRoute = (id,name,tab='resumen') => '/jugadores/'+encodeURIComponent(id)+'/'+encodeURIComponent(name)+(tab==='resumen'?'':'/'+tab);
  const pLink = (id,name) => A(esc(name),playerRoute(id,name),'cm62-inline-link');
  const teamRoute = (id,tab='resumen') => '/equipos/'+encodeURIComponent(id)+(tab==='resumen'?'':'/'+tab);
  const tournamentRoute = (id,tab='resumen') => '/torneos/'+encodeURIComponent(id)+(tab==='resumen'?'':'/'+tab);
  const matchRoute = (t,m,tab='resumen') => '/partidos/'+encodeURIComponent(t)+'/'+encodeURIComponent(m)+(tab==='resumen'?'':'/'+tab);
  const allMatches = (selected=tournaments()) => selected.flatMap(t=>(t.matches||[]).filter(m=>m.stage!=='bye').map(m=>({tournament:t,match:m})));
  const matchTeams = (t,m) => [core.resolveHome(t,m),core.resolveAway(t,m)];
  const dateText = (m) => [m.date || 'Fecha por confirmar',m.time&&m.time!=='00:00'?m.time:'',m.venue||''].filter(Boolean).join(' · ');
  const matchResult = (m) => played(m) ? String(m.homeGoals)+' – '+String(m.awayGoals) : 'VS';
  const progress = (t) => {
    const arr=(t.matches||[]).filter(m=>m.stage!=='bye'), done=arr.filter(played).length;
    return {total:arr.length,done,pending:arr.length-done,percent:arr.length?Math.round(done*100/arr.length):0};
  };
  const active = () => [...tournaments()].reverse().find(t=>t.status==='active') || [...tournaments()].reverse()[0];
  const stageMatches = (t,g=null) => (t.matches||[]).filter(m=>m.stage!=='bye' && (!g||m.group===g.name));
  const tableFor = (teamIds,matchRows) => {
    const map=new Map((teamIds||[]).map(id=>[id,{teamId:id,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,dg:0,pts:0}]));
    for(const m of matchRows.filter(played)){
      const t=map.get(m.home),v=map.get(m.away); if(!t||!v)continue;
      const a=Number(m.homeGoals),b=Number(m.awayGoals);
      t.pj++;v.pj++;t.gf+=a;t.gc+=b;v.gf+=b;v.gc+=a;
      if(a>b){t.pg++;v.pp++;t.pts+=3}else if(b>a){v.pg++;t.pp++;v.pts+=3}else{t.pe++;v.pe++;t.pts++;v.pts++}
    }
    return [...map.values()].map(r=>({...r,dg:r.gf-r.gc})).sort((a,b)=>b.pts-a.pts||b.dg-a.dg||b.gf-a.gf||teamName(a.teamId).localeCompare(teamName(b.teamId),'es'));
  };
  const standingForTournament = (t,g) => {
    if(g) return tableFor(g.teamIds||[],stageMatches(t,g));
    if(t.manualStandings?.length) return t.manualStandings.slice().sort((a,b)=>(a.pos||0)-(b.pos||0));
    return tableFor(t.teamIds||[],(t.matches||[]).filter(m=>m.stage==='regular'||m.stage==='group'));
  };
  const historical = (selected=tournaments()) => {
    const rows=tableFor(teams().map(t=>t.id),allMatches(selected).map(x=>x.match));
    return rows.map(r=>({...r,titles:selected.filter(t=>t.champion===r.teamId).length}))
      .sort((a,b)=>b.titles-a.titles||b.pts-a.pts||b.dg-a.dg||b.gf-a.gf);
  };
  const metrics = (entries) => D('cm62-metrics',entries.map(([value,label])=>D('cm62-metric',E('strong',{},esc(String(value))),E('span',{},esc(label)))));
  const heading = (title,more='') => D('cm62-section-head',E('h2',{},esc(title)),more);
  const scoreCard = ({tournament:t,match:m},cls='') => {
    const [h,a]=matchTeams(t,m),url=matchRoute(t.id,m.id);
    return A(D('cm62-match-sides',D('cm62-match-team',logo(h,'is-small'),E('b',{},esc(teamName(h)))),D('cm62-score',E('strong',{},esc(matchResult(m))),E('small',{},played(m)?'Finalizado':'Próximo')),D('cm62-match-team is-away',logo(a,'is-small'),E('b',{},esc(teamName(a)))))+D('cm62-match-meta',esc(t.name)+' · '+esc(m.round||m.group||'Partido')+' · '+esc(dateText(m))+'  ›'),url,'cm62-result '+cls);
  };
  const miniTable = (rows,options={}) => {
    if(!rows.length)return empty('Todavía no hay clasificación disponible.');
    const headers=['#','Club','PJ','PG','PE','PP','DG','Pts'];
    return D('cm62-table-scroll',E('table',{class:'cm62-table'},E('thead',{},E('tr',{},headers.map(s=>E('th',{},s)))),E('tbody',{},rows.map((r,i)=>E('tr',{},E('td',{},String(i+1)),E('td',{},club(r.teamId,true)),E('td',{},String(r.pj||0)),E('td',{},String(r.pg||0)),E('td',{},String(r.pe||0)),E('td',{},String(r.pp||0)),E('td',{},String(r.dg||0)),E('td',{},E('strong',{},String(r.pts||0))))))));
  };
  const tabNav = (base,items,current) => E('nav',{class:'cm62-tabs','aria-label':'Secciones de esta entidad'},items.map(([key,label])=>A(esc(label),base+(key==='resumen'?'':'/'+key),'cm62-tab'+(current===key?' active':''))));
  const breadcrumbs = (pairs) => D('cm62-crumbs',pairs.map(([label,url],i)=>(i?' / ':'')+(url?A(esc(label),url):E('span',{},esc(label)))));
  const sectionTile = (title,desc,url,icon='↗') => A(D('cm62-tile-copy',E('span',{class:'cm62-tile-icon'},icon),E('strong',{},esc(title)),E('small',{},esc(desc))),E('span',{class:'cm62-tile-arrow'},'›'),url,'cm62-tile');
  const playerGrid = (rows) => rows.length ? D('cm62-players-grid',rows.map(p=>A(D('cm62-player-img',photo(p.teamId,p.name)),D('cm62-player-copy',E('strong',{},esc(p.name)),E('span',{},esc(p.position||'Jugador')),E('small',{},esc(teamName(p.teamId))+' · Ver trayectoria  ›')),playerRoute(p.teamId,p.name),'cm62-player-card'))) : empty('No hay jugadores con esos filtros.');
  const resultsList = (rows,limit=999) => rows.length ? D('cm62-results',rows.slice(0,limit).map(x=>scoreCard(x))) : empty('Todavía no existen partidos para mostrar.');
  function home() {
    const t=active();
    if(!t)return H('Bienvenido a ChuteMundo','La competición comenzará cuando se registre un torneo.');
    const pr=progress(t);
    const matches=allMatches([t]);
    const pending=matches.filter(x=>!played(x.match)),recent=matches.filter(x=>played(x.match)).reverse().slice(0,3);
    const next=pending[0]||null;
    const standings=(t.groups?.length?standingForTournament(t,t.groups[0]):standingForTournament(t)).slice(0,3);
    const leaderRows=stats([t]);
    const scorers=leaderRows.slice().sort((a,b)=>b.goals-a.goals);
    const assistants=leaderRows.slice().sort((a,b)=>b.assists-a.assists);
    const suspensions=model.disciplineRows(core).filter(r=>r.suspended).length;
    const hero=S('cm62-hero',D('cm62-hero-copy',P('COMPETICIÓN ACTUAL','cm62-kicker'),E('h1',{},esc(t.name)),E('span',{class:'cm62-status'},esc(t.status==='active'?'En disputa':t.status==='historical'?'Finalizado':'Próximo')),P(pr.done+' partidos jugados · '+pr.pending+' pendientes'),D('cm62-hero-buttons',B('Explorar torneo  ›',tournamentRoute(t.id),'is-light'),A('Tabla',tournamentRoute(t.id,'tabla')),A('Partidos',tournamentRoute(t.id,'partidos')))),D('cm62-hero-side',D('cm62-logo-cluster',(t.teamIds||[]).slice(0,6).map(id=>logo(id))),D('cm62-progress',E('span',{},'Avance del torneo'),E('b',{},pr.percent+' %'),D('cm62-progress-track',E('div',{class:'cm62-progress-fill',style:'width:'+pr.percent+'%'})))));
    const upcoming=next?card(heading('Próximo partido',A('Abrir encuentro ›',matchRoute(t.id,next.match.id))),scoreCard(next)):card(heading('Próximo partido'),empty('Calendario pendiente de programación.'));
    const tab=card(heading('Tabla / grupos',A('Ver tabla ›',tournamentRoute(t.id,'tabla'))),miniTable(standings));
    const last=card(heading('Últimos resultados',A('Ver partidos ›','/partidos')),resultsList(recent));
    const people=D('cm62-feature-grid',card(P('GOLEADOR','cm62-kicker'),scorers[0]&&scorers[0].goals?E('strong',{},pLink(scorers[0].teamId,scorers[0].name))+P(scorers[0].goals+' goles'):empty('Sin goles atribuidos'),'cm62-feature'),card(P('ASISTIDOR','cm62-kicker'),assistants[0]&&assistants[0].assists?E('strong',{},pLink(assistants[0].teamId,assistants[0].name))+P(assistants[0].assists+' asistencias'):empty('Sin asistencias atribuidas'),'cm62-feature'),card(P('DISCIPLINA','cm62-kicker'),E('strong',{},suspensions?suspensions+' posibles suspendidos':'Sin suspensiones registradas'),A('Ver disciplina ›','/disciplina'),'cm62-feature'));
    return hero+D('cm62-grid cm62-grid-2',upcoming,tab)+last+heading('Protagonistas',A('Todas las estadísticas ›','/estadisticas'))+people;
  }
  function tournamentCatalog(filters) {
    const selected=tournaments().filter(t=>filters.tournamentStatus==='all'||t.status===filters.tournamentStatus).filter(t=>t.name.toLowerCase().includes(filters.tournamentSearch.toLowerCase()));
    return H('Torneos','Explora competiciones activas, próximas e históricas.','COMPETENCIAS')+D('cm62-controls',E('input',{id:'cm62TournamentSearch',placeholder:'Nombre, año o formato…',type:'search',value:filters.tournamentSearch,'aria-label':'Buscar torneo'}),E('select',{id:'cm62TournamentStatus','aria-label':'Estado'},[['all','Todos'],['active','En disputa'],['historical','Finalizados'],['upcoming','Próximos']].map(([k,v])=>E('option',{value:k,...(filters.tournamentStatus===k?{selected:'selected'}:{})},v))))+D('cm62-catalog',selected.slice().reverse().sort((a,b)=>Number(b.status==='active')-Number(a.status==='active')).map(t=>{const p=progress(t);return card(D('cm62-card-top',E('span',{class:'cm62-status is-soft'},esc(t.status==='active'?'En disputa':t.status==='historical'?'Finalizado':'Próximo')),E('span',{},p.done+' / '+p.total+' encuentros')),E('h2',{},esc(t.name)),P((t.teamIds||[]).length+' equipos · '+p.pending+' pendientes','cm62-muted'),D('cm62-logo-cluster',(t.teamIds||[]).slice(0,6).map(id=>logo(id,'is-small'))),D('cm62-progress-track',E('div',{class:'cm62-progress-fill',style:'width:'+p.percent+'%'})),B('Abrir competición ›',tournamentRoute(t.id),'is-primary'));}));
  }
  function tournamentDetail(id,tab='resumen') {
    const t=tournament(id);if(!t)return H('Torneo no encontrado')+B('Ver torneos','/torneos');
    const p=progress(t),rows=allMatches([t]),unplayed=rows.filter(x=>!played(x.match));
    const base=tournamentRoute(id),top=breadcrumbs([['Torneos','/torneos'],[t.name,null]])+D('cm62-entity-hero',P('CENTRO DE TORNEO','cm62-kicker'),E('h1',{},esc(t.name)),E('span',{class:'cm62-status'},esc(t.status==='active'?'En disputa':t.status==='historical'?'Finalizado':'Próximo')),P(p.done+'/'+p.total+' encuentros · '+(t.teamIds||[]).length+' equipos','cm62-muted'),D('cm62-entity-logos',(t.teamIds||[]).slice(0,8).map(id=>logo(id,'is-small'))));
    const nav=tabNav(base,[['resumen','Resumen'],['partidos','Partidos'],['tabla','Tabla'],['lideres','Líderes'],['historia','Historia']],tab);
    let body='';
    if(tab==='resumen'){
      body=metrics([[p.done,'Jugados'],[p.pending,'Pendientes'],[p.percent+'%','Disputado']])+D('cm62-grid cm62-grid-2',card(heading('Próximo encuentro'),unplayed.length?scoreCard(unplayed[0]):empty('No quedan partidos pendientes.')),card(heading('Explorar la copa'),D('cm62-tiles',sectionTile('Tabla','Posiciones y clasificación',tournamentRoute(id,'tabla'),'▤'),sectionTile('Partidos','Fixture y resultados',tournamentRoute(id,'partidos'),'⚽'),sectionTile('Líderes','Goles y asistencias',tournamentRoute(id,'lideres'),'★'),sectionTile('Historia','Archivo de esta edición',tournamentRoute(id,'historia'),'🏆'))));
    }else if(tab==='partidos')body=card(heading('Fixture y resultados'),resultsList(rows));
    else if(tab==='tabla')body=t.groups?.length ? (t.groups||[]).map(g=>card(heading(g.name),miniTable(standingForTournament(t,g)))).join('') : card(heading('Tabla de posiciones'),miniTable(standingForTournament(t)));
    else if(tab==='lideres'){
      const r=stats([t]).filter(x=>x.goals||x.assists);body=card(heading('Goles y asistencias'),r.length?D('cm62-list',r.sort((a,b)=>b.goals-a.goals||b.assists-a.assists).slice(0,25).map(x=>A(photo(x.teamId,x.name,'is-face')+D('cm62-row-copy',E('strong',{},esc(x.name)),E('small',{},esc(teamName(x.teamId))))+E('b',{},x.goals+' G · '+x.assists+' A'),playerRoute(x.teamId,x.name),'cm62-list-row'))):empty('Aún no se registran goles o asistencias individualizadas.'));
    }else{
      body=card(heading('Archivo de la competición'),metrics([[t.champion?teamName(t.champion):'—','Campeón'],[t.runnerUp?teamName(t.runnerUp):'—','Subcampeón'],[t.third?teamName(t.third):'—','Tercer lugar']]),D('cm62-tiles',(t.teamIds||[]).map(id=>sectionTile(teamName(id),'Consultar trayectoria del club',teamRoute(id),'🛡'))));
    }
    return top+nav+body;
  }
  function matchCatalog(filters) {
    const rows=allMatches().filter(x=>(filters.matchTournament==='all'||x.tournament.id===filters.matchTournament)&&(filters.matchStatus==='all'||(filters.matchStatus==='played'?played(x.match):!played(x.match))));
    const options=[['all','Todos los torneos'],...tournaments().map(t=>[t.id,t.name])];
    return H('Partidos','El calendario como acceso al relato de cada encuentro.','CALENDARIO')+D('cm62-controls',E('select',{id:'cm62MatchTournament','aria-label':'Torneo'},options.map(([k,v])=>E('option',{value:k,...(filters.matchTournament===k?{selected:'selected'}:{})},esc(v)))),E('select',{id:'cm62MatchStatus','aria-label':'Estado'},[['all','Todos los estados'],['played','Finalizados'],['pending','Pendientes']].map(([k,v])=>E('option',{value:k,...(filters.matchStatus===k?{selected:'selected'}:{})},v))))+card(heading('Encuentros',''),resultsList(rows));
  }
  function matchDetail(tid,mid,tab='resumen') {
    const t=tournament(tid),m=t?.matches?.find(x=>x.id===mid);if(!t||!m)return H('Partido no encontrado')+B('Ver partidos','/partidos');
    const [h,a]=matchTeams(t,m),base=matchRoute(tid,mid);
    const hero=breadcrumbs([['Torneos','/torneos'],[t.name,tournamentRoute(tid)],['Partido',null]])+D('cm62-scoreboard',P(esc(m.round||m.group||'PARTIDO')+' · '+esc(t.name),'cm62-kicker'),D('cm62-scoreboard-main',A(logo(h,'is-xl')+E('strong',{},esc(teamName(h))),teamRoute(h),'cm62-scoreboard-team'),D('cm62-score-large',E('b',{},esc(matchResult(m))),E('small',{},played(m)?'Finalizado':'Por jugar')),A(logo(a,'is-xl')+E('strong',{},esc(teamName(a))),teamRoute(a),'cm62-scoreboard-team')),P(esc(dateText(m)),'cm62-muted'));
    const nav=tabNav(base,[['resumen','Resumen'],['eventos','Eventos'],['alineaciones','Alineaciones'],['estadisticas','Estadísticas']],tab);
    const eventRows=[];
    for(const g of m.goals||[])eventRows.push({minute:Number(g.minute)||0,kind:'Gol',name:g.playerName||'',teamId:g.teamId|| (g.side==='away'?a:h)});
    for(const g of m.cards||[])eventRows.push({minute:Number(g.minute)||0,kind:g.type==='red'?'Tarjeta roja':'Tarjeta amarilla',name:g.playerName||'',teamId:g.teamId||(g.side==='away'?a:h)});
    for(const s of m.substitutions||[])eventRows.push({minute:Number(s.minute)||0,kind:'Sustitución',name:s.inName||s.playerIn||'',teamId:s.teamId});
    eventRows.sort((a,b)=>a.minute-b.minute);
    const timeline=eventRows.length?D('cm62-timeline',eventRows.map(x=>D('cm62-event',E('span',{},x.minute?x.minute+'′':'—'),D('cm62-event-body',E('strong',{},esc(x.kind)),x.name?pLink(x.teamId,x.name):'Sin jugador individualizado',E('small',{},esc(teamName(x.teamId))))))):empty('No hay eventos individuales registrados para este encuentro.');
    let body='';
    if(tab==='resumen')body=D('cm62-grid cm62-grid-2',card(heading('El encuentro'),P(played(m)?'Resultado oficial registrado':'Encuentro pendiente','cm62-muted'),P(esc(m.notes||'')),D('cm62-tiles',sectionTile('Eventos','Goles, tarjetas y minutos',matchRoute(tid,mid,'eventos'),'◴'),sectionTile('Alineaciones','Planteles y formación',matchRoute(tid,mid,'alineaciones'),'♟'))),card(heading('Protagonistas'),timeline))+D('cm62-action-row',B('Ver torneo ›',tournamentRoute(tid),'is-outline'),B('Compartir partido','/compartir/'+encodeURIComponent(tid)+'/'+encodeURIComponent(mid),'is-outline'));
    else if(tab==='eventos')body=card(heading('Cronología del encuentro'),timeline);
    else if(tab==='alineaciones'){
      const l=m.lineups||{};
      const sides=[['home',h],['away',a]];
      const hasLineups=sides.some(([side])=>(l[side]?.starters||[]).length>0);
      body=card(heading('Alineaciones registradas'),hasLineups?D('cm62-grid cm62-grid-2',sides.map(([side,id])=>D('cm62-roster-column',E('h3',{},esc(teamName(id))),D('cm62-list',(l[side]?.starters||[]).map(name=>D('cm62-lineup-player',esc(typeof name==='string'?name:model.playerName(name))))),P((l[side]?.changes||[]).length+' sustituciones registradas','cm62-muted')))):empty('Alineaciones no registradas para este partido.'));
    }else{
      body=card(heading('Datos del encuentro'),metrics([[played(m)?m.homeGoals:'—','Goles local'],[played(m)?m.awayGoals:'—','Goles visita'],[(m.goals||[]).length,'Goles con autor'],[(m.cards||[]).length,'Tarjetas registradas']]));
    }
    if(core.canEdit?.())body+=D('cm62-action-row',E('button',{type:'button',class:'cm62-btn is-primary','data-cm62-edit':tid+'__'+mid},'Editar partido'));
    return hero+nav+body;
  }
  function clubCatalog(filters){
    const q=filters.teamSearch.toLowerCase();
    const rows=teams().filter(t=>t.name.toLowerCase().includes(q)||(t.coach||'').toLowerCase().includes(q)||(t.players||[]).some(p=>model.playerName(p).toLowerCase().includes(q)));
    return H('Equipos','Los clubes como puertas de entrada al universo Chute.','CLUBES')+D('cm62-controls',E('input',{id:'cm62TeamSearch',type:'search',value:filters.teamSearch,placeholder:'Buscar por club, responsable o jugador…','aria-label':'Buscar club'}),E('span',{},rows.length+' clubes'))+D('cm62-clubs-grid',rows.map(x=>A(logo(x.id,'is-xl'),E('h2',{},esc(x.name)),P((x.players||[]).length+' jugadores · '+(x.coach?'DT: '+esc(x.coach):'Plantel y rendimiento'),'cm62-muted'),E('span',{class:'cm62-link-hint'},'Ver club ›'),teamRoute(x.id),'cm62-card cm62-club-card')));
  }
  function matchesForTeam(id){return allMatches().filter(x=>{const [h,a]=matchTeams(x.tournament,x.match);return h===id||a===id})}
  function clubDetail(id,tab='resumen'){
    const t=team(id);if(!t)return H('Club no encontrado')+B('Ver clubes','/equipos');
    const rows=matchesForTeam(id),playedRows=rows.filter(x=>played(x.match));let won=0,gf=0,gc=0;
    for(const x of playedRows){const [home]=matchTeams(x.tournament,x.match),ownHome=home===id,homeGoals=Number(x.match.homeGoals),awayGoals=Number(x.match.awayGoals);gf+=ownHome?homeGoals:awayGoals;gc+=ownHome?awayGoals:homeGoals;if((ownHome?homeGoals:awayGoals)>(ownHome?awayGoals:homeGoals))won++;}
    const titles=tournaments().filter(x=>x.champion===id).length;
    const hero=breadcrumbs([['Equipos','/equipos'],[t.name,null]])+D('cm62-club-hero',logo(id,'is-xxl'),D('',P('CLUB / PERFIL OFICIAL','cm62-kicker'),E('h1',{},esc(t.name)),P(t.coach?'DT: '+esc(t.coach):'Plantel · Resultados · Archivo histórico','cm62-muted'),E('button',{type:'button',class:'cm62-btn is-outline','data-cm62-share':teamRoute(id)},'Compartir club')));
    const base=teamRoute(id),nav=tabNav(base,[['resumen','Resumen'],['plantel','Plantel'],['partidos','Partidos'],['estadisticas','Estadísticas'],['historia','Historia']],tab);
    const clubPlayers=players().filter(p=>p.teamId===id);
    let body='';
    if(tab==='resumen')body=metrics([[playedRows.length,'Partidos'],[won,'Victorias'],[gf,'Goles'],[titles,'Títulos']])+D('cm62-grid cm62-grid-2',card(heading('Últimos partidos'),resultsList(playedRows.slice(-4).reverse())),card(heading('Accesos directos'),D('cm62-tiles',sectionTile('Plantel completo',clubPlayers.length+' jugadores',teamRoute(id,'plantel'),'♟'),sectionTile('Estadísticas del club','Rendimiento oficial',teamRoute(id,'estadisticas'),'▥'),sectionTile('Historial de torneos','Todas las ediciones',teamRoute(id,'historia'),'🏆'))));
    else if(tab==='plantel')body=heading('Plantel oficial',clubPlayers.length+' jugadores')+playerGrid(clubPlayers);
    else if(tab==='partidos')body=card(heading('Resultados y calendario'),resultsList(rows.slice().reverse()));
    else if(tab==='estadisticas')body=metrics([[playedRows.length,'PJ'],[won,'PG'],[gf,'GF'],[gc,'GC'],[gf-gc,'DG'],[titles,'Títulos']])+card(heading('Estadísticas individuales'),D('cm62-list',stats().filter(x=>x.teamId===id).slice(0,15).map(x=>A(E('strong',{},esc(x.name))+E('small',{},' · '+x.goals+' G / '+x.assists+' A'),playerRoute(id,x.name),'cm62-list-row'))));
    else body=card(heading('Trayectoria del club'),D('cm62-tiles',tournaments().filter(x=>(x.teamIds||[]).includes(id)).slice().reverse().map(x=>sectionTile(x.name,x.champion===id?'Campeón':'Competición disputada',tournamentRoute(x.id),'🏆'))));
    return hero+nav+body;
  }
  function playerCatalog(filters){
    const all=players().filter(p=>(filters.playerTeam==='all'||p.teamId===filters.playerTeam)&&(!filters.playerSearch||p.name.toLowerCase().includes(filters.playerSearch.toLowerCase()))&&(filters.playerPosition==='all'||p.position.toLowerCase().includes(filters.playerPosition)));
    return H('Jugadores','Búsqueda rápida y acceso directo a cada carrera.','PLANTELES OFICIALES')+D('cm62-controls',E('input',{id:'cm62PlayerSearch',type:'search',value:filters.playerSearch,placeholder:'Jugador, equipo o posición…','aria-label':'Buscar jugador'}),E('select',{id:'cm62PlayerTeam','aria-label':'Filtrar equipo'},[['all','Todos los clubes'],...teams().map(t=>[t.id,t.name])].map(([k,v])=>E('option',{value:k,...(filters.playerTeam===k?{selected:'selected'}:{})},esc(v)))),E('select',{id:'cm62PlayerPosition','aria-label':'Filtrar posición'},[['all','Todas las posiciones'],['delanter','Delanteros'],['defen','Defensas'],['medi','Mediocampistas'],['arquer','Arqueros']].map(([k,v])=>E('option',{value:k,...(filters.playerPosition===k?{selected:'selected'}:{})},v))))+playerGrid(all);
  }
  function playerDetail(id,name,tab='resumen'){
    const t=team(id),p=players().find(p=>p.teamId===id&&p.name===name);if(!t||!p)return H('Jugador no encontrado')+B('Ver jugadores','/jugadores');
    const r=stats().find(x=>x.teamId===id&&x.name===name)||{goals:0,assists:0,appearances:0,yellows:0,reds:0};
    const hero=breadcrumbs([['Jugadores','/jugadores'],[name,null]])+D('cm62-player-hero',D('cm62-player-portrait',photo(id,name)),D('cm62-player-bio',P('JUGADOR / PERFIL','cm62-kicker'),E('h1',{},esc(name)),P(esc(p.position||'Jugador')+' · '+esc(t.name),'cm62-muted'),club(id,true)));
    const base=playerRoute(id,name),nav=tabNav(base,[['resumen','Resumen'],['temporada','Temporada'],['carrera','Carrera'],['partidos','Partidos'],['palmares','Palmarés']],tab);
    const metric=metrics([[r.appearances||0,'Apariciones registradas'],[r.goals||0,'Goles'],[r.assists||0,'Asistencias'],[(r.yellows||0)+(r.reds||0),'Tarjetas']]);
    const involving=allMatches().filter(x=>(x.match.goals||[]).some(g=>g.playerName===name&&g.teamId===id)||(x.match.cards||[]).some(g=>g.playerName===name&&g.teamId===id));
    const titleRows=tournaments().filter(x=>x.champion===id&&(x.teamIds||[]).includes(id));
    let body='';
    if(tab==='resumen')body=metric+D('cm62-grid cm62-grid-2',card(heading('Trayectoria'),sectionTile(t.name,'Ver historia y partidos del club',teamRoute(id),'🛡')),card(heading('Explorar su carrera'),D('cm62-tiles',sectionTile('Actividad registrada','Partidos con eventos',playerRoute(id,name,'partidos'),'⚽'),sectionTile('Temporada','Datos individuales',playerRoute(id,name,'temporada'),'▤'),sectionTile('Palmarés','Títulos vinculados al club',playerRoute(id,name,'palmares'),'🏆'))));
    else if(tab==='temporada')body=metric+card(heading('Contribución individual'),P('Las cifras se derivan de partidos y registros oficiales.','cm62-muted'));
    else if(tab==='carrera')body=card(heading('Club registrado'),sectionTile(t.name,(t.players||[]).length+' integrantes del plantel',teamRoute(id),'🛡'))+card(heading('Competiciones del club'),D('cm62-tiles',tournaments().filter(x=>(x.teamIds||[]).includes(id)).map(x=>sectionTile(x.name,'Explorar torneo',tournamentRoute(x.id),'🏆'))));
    else if(tab==='partidos')body=card(heading('Partidos con eventos individuales'),involving.length?resultsList(involving):empty('No existen eventos individualizados suficientes para vincular partidos a este jugador.'));
    else body=card(heading('Títulos del club'),titleRows.length?D('cm62-tiles',titleRows.map(x=>sectionTile(x.name,'Torneo ganado por '+t.name,tournamentRoute(x.id),'🏆'))):empty('No hay títulos del club registrados en las competiciones disponibles.'));
    return hero+nav+body;
  }

  function statisticsExplorer(tab='inicio',filters){
    const tiles=[['tabla','Tabla histórica','Acumulado de partidos'],['fifa','Ranking FIFA/ELO','Fuerza competitiva'],['historico','Ranking histórico','Legado y títulos'],['palmares','Palmarés','Campeones y premios'],['records','Récords','Marcas del deporte'],['h2h','Clásicos y H2H','Cara a cara']];
    const division = (t) => t.type==='division_season'||t.eraId==='divisions'||t.era==='division';
    const selected=tournaments().filter(t=>(filters.statPeriod==='all'||filters.statPeriod===(division(t)?'divisions':'leagues'))&&(filters.statTournament==='all'||t.id===filters.statTournament)&&(filters.statFormat==='all'||t.type===filters.statFormat));
    const choose=(id,value,opts,label)=>E('label',{class:'cm62-filter-field'},E('span',{},esc(label)),E('select',{id,'aria-label':label},opts.map(([k,v])=>E('option',{value:k,...(value===k?{selected:'selected'}:{})},esc(v)))));
    const formatTypes=[...new Set(tournaments().map(t=>t.type))].filter(Boolean);
    const globalFilters=E('div',{class:'cm62-stats-filters'},P('FILTROS GLOBALES','cm62-kicker'),D('cm62-filter-grid',
      choose('cm62StatPeriod',filters.statPeriod,[['all','Toda la historia'],['leagues','Era de ligas'],['divisions','Era de divisiones']],'Periodo'),
      choose('cm62StatTournament',filters.statTournament,[['all','Todos los torneos'],...tournaments().map(t=>[t.id,t.name])],'Torneo'),
      choose('cm62StatTeam',filters.statTeam,[['all','Todos los clubes'],...teams().map(t=>[t.id,t.name])],'Equipo'),
      choose('cm62StatFormat',filters.statFormat,[['all','Todos los formatos'],...formatTypes.map(t=>[t,t.replaceAll('_',' ')])],'Formato')));
    if(tab==='inicio')return H('Estadísticas','Explora el archivo oficial y accede a sus protagonistas.','ARCHIVO HISTÓRICO')+D('cm62-archive-intro',E('h2',{},'Explorar la historia de ChuteMundo'),P('Torneos, equipos, jugadores y enfrentamientos conectados.'))+globalFilters+D('cm62-archive-grid',tiles.map(([id,title,desc],i)=>sectionTile(String(i+1).padStart(2,'0')+' · '+title,desc,'/estadisticas/'+id,'▥')));
    const title=tiles.find(t=>t[0]===tab)?.[1]||'Estadísticas';
    const nav=tabNav('/estadisticas',[['tabla','Tabla'],['fifa','FIFA/ELO'],['historico','Histórico'],['palmares','Palmarés'],['records','Récords'],['h2h','H2H']],tab);
    const visibleTeam=(row)=>filters.statTeam==='all'||row.teamId===filters.statTeam;
    let body='';
    if(tab==='fifa'){
      const rows=window.ChuteFifaV525?.compute?.(selected,{source:state(),includeFriendlies:filters.statPeriod==='all'&&filters.statTournament==='all'&&filters.statFormat==='all'})||[];
      const relevant=rows.filter(visibleTeam);
      body=card(heading('Clasificación FIFA/ELO'),relevant.length?D('cm62-list',relevant.map((r,i)=>A(E('b',{},String(i+1))+logo(r.teamId,'is-small')+D('cm62-row-copy',E('strong',{},esc(teamName(r.teamId))),E('small',{},'Rating ELO '+Number(r.rating).toFixed(1)))+E('b',{},Math.round(r.points||0)+' pts'),teamRoute(r.teamId),'cm62-list-row'))):empty('Sin datos FIFA/ELO para los filtros seleccionados.'));
    }else if(tab==='historico'){
      const rows=historical(selected).filter(visibleTeam);
      body=card(heading('Clasificación histórica'),rows.length?D('cm62-list',rows.map((r,i)=>A(E('b',{},String(i+1))+logo(r.teamId,'is-small')+D('cm62-row-copy',E('strong',{},esc(teamName(r.teamId))),E('small',{},r.titles+' títulos · '+r.pts+' puntos')),teamRoute(r.teamId),'cm62-list-row'))):empty('No existen resultados para este filtro.'));
    }else if(tab==='palmares'){
      const titled=selected.filter(t=>t.champion&&(filters.statTeam==='all'||t.champion===filters.statTeam));
      body=card(heading('Campeones'),titled.length?D('cm62-list',titled.map(t=>D('cm62-list-row',A(E('strong',{},esc(t.name)),tournamentRoute(t.id)),club(t.champion,true)))):empty('No hay campeones registrados para esos filtros.'));
    }else if(tab==='records'){
      const games=allMatches(selected).filter(x=>played(x.match)&&(filters.statTeam==='all'||matchTeams(x.tournament,x.match).includes(filters.statTeam))).slice().sort((a,b)=>(Number(b.match.homeGoals)+Number(b.match.awayGoals))-(Number(a.match.homeGoals)+Number(a.match.awayGoals)));
      const scorer=stats(selected).filter(visibleTeam).slice().sort((a,b)=>b.goals-a.goals)[0];
      body=D('cm62-grid cm62-grid-2',card(heading('Máximo goleador'),scorer?.goals?E('strong',{},pLink(scorer.teamId,scorer.name))+P(scorer.goals+' goles'):empty('Sin datos de goleadores')),card(heading('Partido con más goles'),games[0]?scoreCard(games[0]):empty('Sin partidos finalizados')));
    }else if(tab==='h2h'){
      const first=teams()[0]?.id||'',second=teams().find(t=>t.id!==first)?.id||'';
      const a=filters.h2hA||first,b=filters.h2hB||second;
      const duels=allMatches(selected).filter(x=>{const [home,away]=matchTeams(x.tournament,x.match);return played(x.match)&&((home===a&&away===b)||(home===b&&away===a));});
      let winA=0,winB=0,draws=0;
      for(const x of duels){
        const [home]=matchTeams(x.tournament,x.match),ownHome=home===a;
        const ga=ownHome?Number(x.match.homeGoals):Number(x.match.awayGoals),gb=ownHome?Number(x.match.awayGoals):Number(x.match.homeGoals);
        if(ga>gb)winA++;else if(gb>ga)winB++;else draws++;
      }
      const opts=teams().map(t=>[t.id,t.name]);
      const classics=state().classics||[];
      body=card(heading('Enfrentamiento directo'),D('cm62-filter-grid cm62-filter-grid-2',
        choose('cm62H2HA',a,opts,'Club A'),choose('cm62H2HB',b,opts,'Club B')),
        metrics([[winA,'Victorias '+teamName(a)],[draws,'Empates'],[winB,'Victorias '+teamName(b)],[duels.length,'Partidos']]),
        resultsList(duels.slice().reverse()))+
        (classics.length?card(heading('Clásicos registrados'),D('cm62-tiles',classics.map(c=>E('button',{type:'button',class:'cm62-tile','data-cm62-h2h':c.a+'__'+c.b},D('cm62-tile-copy',E('strong',{},esc(c.name||teamName(c.a)+' vs '+teamName(c.b))),E('small',{},'Comparar enfrentamiento')),E('span',{class:'cm62-tile-arrow'},'›'))))):'');
    }else {
      const rows=tableFor(teams().map(t=>t.id),allMatches(selected).map(x=>x.match)).filter(visibleTeam);
      body=card(heading('Tabla histórica acumulada'),miniTable(rows));
    }
    return breadcrumbs([['Estadísticas','/estadisticas'],[title,null]])+H(title,'Datos derivados de los registros oficiales.','ARCHIVO HISTÓRICO')+nav+globalFilters+body;
  }
  function discipline(filters){
    const arr=model.disciplineRows(core).filter(r=>filters.disciplineTeam==='all'||r.teamId===filters.disciplineTeam);
    const all=model.disciplineRows(core),ys=all.reduce((a,b)=>a+b.yellows,0),rs=all.reduce((a,b)=>a+b.reds,0),s=all.filter(r=>r.suspended).length;
    return H('Disciplina','Tarjetas y sanciones conectadas a las fichas deportivas.','CONTROL DISCIPLINARIO')+D('cm62-controls',E('select',{id:'cm62DisciplineTeam','aria-label':'Filtrar equipo'},[['all','Todos los clubes'],...teams().map(t=>[t.id,t.name])].map(([k,v])=>E('option',{value:k,...(filters.disciplineTeam===k?{selected:'selected'}:{})},esc(v)))))+metrics([[ys,'Amarillas'],[rs,'Rojas'],[s,'Posibles suspensiones'],[all.length,'Jugadores con registros']])+card(heading('Registro disciplinario'),arr.length?D('cm62-list',arr.map(x=>A(photo(x.teamId,x.name,'is-face')+D('cm62-row-copy',E('strong',{},esc(x.name)),E('small',{},esc(teamName(x.teamId))+' · '+x.yellows+' amarillas / '+x.reds+' rojas'))+E('b',{class:x.suspended?'cm62-danger':''},x.suspended?'Revisar sanción':'Registrado'),playerRoute(x.teamId,x.name),'cm62-list-row'))):empty('Sin tarjetas registradas para los filtros seleccionados.'));
  }
  function administration(){
    const can=core.isAdmin?.();
    const hero=H('Administración','Área restringida para operación y resguardo del historial.','CENTRO DE CONTROL');
    if(!can)return hero+card(P('ACCESO RESTRINGIDO','cm62-kicker'),E('h2',{},'Solo administradores autorizados'),P('Inicia sesión para consultar las herramientas de gestión.','cm62-muted'),E('button',{type:'button','data-cm62-login':'1',class:'cm62-btn is-primary'},'Iniciar sesión'));
    const features=[['Firebase','Sincronización y fuente oficial','administracion','cloudInfo'],['Integridad','Revisión de relaciones y registros','administracion','cmV6StorageModel'],['Respaldos JSON','Exportación y restauración','administracion','exportButton'],['Torneos','Creación y mantenimiento','torneos','tournamentForm'],['Usuarios y roles','Acceso autorizado por claims','administracion','authButton'],['Reglamento','Definiciones deportivas','administracion','cmV6StorageModel']];
    return hero+card(heading('Operación y resguardo'),D('cm62-archive-grid',features.map(([a,b,page,focus],i)=>E('button',{type:'button',class:'cm62-tile cm62-admin-tile','data-cm62-classic':page,'data-cm62-focus':focus},E('span',{class:'cm62-tile-icon'},['◈','✓','▣','🏆','♟','▤'][i])+D('cm62-tile-copy',E('strong',{},esc(a)),E('small',{},esc(b)))+E('span',{class:'cm62-tile-arrow'},'›')))))+P('La configuración definitiva del custom claim de Firebase sigue pendiente.','cm62-muted');
  }
  function render(route,filters){
    const parts=route.split('/').filter(Boolean).map(x=>{try{return decodeURIComponent(x)}catch{return x}});
    const section=parts[0]||'inicio';
    if(section==='inicio')return home();
    if(section==='torneos')return parts[1]?tournamentDetail(parts[1],parts[2]||'resumen'):tournamentCatalog(filters);
    if(section==='partidos')return parts[1]&&parts[2]?matchDetail(parts[1],parts[2],parts[3]||'resumen'):matchCatalog(filters);
    if(section==='equipos')return parts[1]?clubDetail(parts[1],parts[2]||'resumen'):clubCatalog(filters);
    if(section==='jugadores')return parts[1]&&parts[2]?playerDetail(parts[1],parts[2],parts[3]||'resumen'):playerCatalog(filters);
    if(section==='estadisticas')return statisticsExplorer(parts[1]||'inicio',filters);
    if(section==='disciplina')return discipline(filters);
    if(section==='administracion')return administration();
    if(section==='compartir'&&parts[1]&&parts[2])return matchDetail(parts[1],parts[2]);
    return H('Página no encontrada')+B('Volver al inicio','/inicio');
  }
  return {render,active,players,tournaments,teamRoute,tournamentRoute,matchRoute,playerRoute};
}
