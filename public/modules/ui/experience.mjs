
import { createViews } from './experience-views.mjs';

const core = window.ChuteMundoCore;
const model = window.ChuteDetailModel;
if (!core || !model) throw new Error('La experiencia ChuteMundo 6.2 requiere el núcleo deportivo y su modelo de datos.');

const classic = new URLSearchParams(location.search).get('classic') === '1';
if (classic) {
  const banner = document.createElement('div');
  banner.className = 'cm62-classic-banner';
  banner.innerHTML = '<span>Herramientas clásicas de administración · ChuteMundo 6.2</span><a href="/">Volver a la experiencia deportiva →</a>';
  document.body.prepend(banner);
  const classicPage=location.hash.startsWith('#/') ? location.hash.slice(2).split('/')[0] : '';
  if (['administracion','torneos','partidos','equipos','jugadores','estadisticas','disciplina'].includes(classicPage)) core.navigate(classicPage);
  const focus=new URLSearchParams(location.search).get('focus');
  if (focus) setTimeout(()=>document.getElementById(focus)?.scrollIntoView({behavior:'smooth',block:'start'}),500);
  window.ChuteExperience = Object.freeze({ enabled: false, version: '6.2.0' });
} else {
  const views = createViews(core, model);
  const filters = {
    tournamentSearch: '',
    tournamentStatus: 'all',
    matchTournament: 'all',
    matchStatus: 'all',
    teamSearch: '',
    playerSearch: '',
    playerTeam: 'all',
    playerPosition: 'all',
    disciplineTeam: 'all',
    statPeriod: 'all',
    statTournament: 'all',
    statTeam: 'all',
    statFormat: 'all',
    h2hA: '',
    h2hB: ''
  };
  const pages = {
    inicio: ['Inicio', '⌂'],
    torneos: ['Torneos', '🏆'],
    partidos: ['Partidos', '⚽'],
    equipos: ['Equipos', '🛡'],
    jugadores: ['Jugadores', '♟'],
    estadisticas: ['Estadísticas', '▥'],
    disciplina: ['Disciplina', '▣'],
    administracion: ['Administración', '⚙']
  };
  const main = document.querySelector('main.container');
  if (!main) throw new Error('No existe contenedor principal para ChuteMundo 6.2.');
  const screen = document.createElement('div');
  screen.id = 'cm62Root';
  screen.className = 'cm62-root';
  screen.setAttribute('role','main');
  main.prepend(screen);
  document.body.classList.add('cm62-active');

  const nav = document.createElement('nav');
  nav.className = 'cm62-bottom-nav';
  nav.id = 'cm62BottomNav';
  nav.setAttribute('aria-label','Navegación principal móvil');
  nav.innerHTML = [
    ['inicio','⌂','Inicio'],
    ['torneos','🏆','Torneos'],
    ['partidos','⚽','Partidos'],
    ['equipos','🛡','Equipos']
  ].map(([id,icon,label]) => '<a href="#/'+id+'" data-cm62-route="/'+id+'" data-cm62-nav="'+id+'"><span aria-hidden="true">'+icon+'</span>'+label+'</a>').join('') +
    '<button type="button" data-cm62-more aria-expanded="false"><span aria-hidden="true">···</span>Más</button>';
  const sheet = document.createElement('div');
  sheet.id = 'cm62MoreSheet';
  sheet.className = 'cm62-more-sheet';
  sheet.hidden = true;
  sheet.innerHTML = [
    ['jugadores','Jugadores'],
    ['estadisticas','Estadísticas'],
    ['disciplina','Disciplina'],
    ['administracion','Administración']
  ].map(([id,label]) => '<a href="#/'+id+'" data-cm62-route="/'+id+'">'+label+'<span>›</span></a>').join('');
  document.body.append(nav,sheet);
  const desktopNav = document.querySelector('.nav');
  const desktopMenu = document.createElement('div');
  desktopMenu.className = 'cm62-desktop-menu';
  desktopMenu.innerHTML = '<button type="button" data-cm62-desktop-more aria-expanded="false">Más ▾</button>' +
    '<div class="cm62-desktop-menu-panel" hidden>' +
    '<a href="#/disciplina" data-cm62-route="/disciplina">Disciplina</a>' +
    '<a href="#/administracion" data-cm62-route="/administracion">Administración</a>' +
    '</div>';
  desktopNav?.appendChild(desktopMenu);
  function closeDesktopMenu() {
    const panel=desktopMenu.querySelector('.cm62-desktop-menu-panel');
    if(panel)panel.hidden=true;
    desktopMenu.querySelector('[data-cm62-desktop-more]')?.setAttribute('aria-expanded','false');
  }
  const actions = document.querySelector('.top-actions');
  if (actions && !actions.querySelector('[data-cm62-search]')) {
    const search = document.createElement('button');
    search.type = 'button';
    search.className = 'cm62-global-search';
    search.dataset.cm62Search = '1';
    search.setAttribute('aria-label','Buscar jugadores');
    search.textContent = '⌕';
    actions.prepend(search);
  }
  const brandSmall = document.querySelector('.brand small');
  if (brandSmall) brandSmall.textContent = 'El universo de la competición';
  const brand = document.querySelector('.brand strong');
  if (brand) brand.textContent = 'CHUTE MUNDO';

  if (!location.hash.startsWith('#/')) history.replaceState({ cm62: true,cm62Depth:0 }, '', location.pathname + location.search + '#/inicio');
  let route = '';
  let depth = Number(history.state?.cm62Depth||0);
  let lastSignature = '';
  let refreshScheduled = false;
  const normalize = (value) => {
    const v = String(value || '/inicio').trim().replace(/^#/, '');
    return /^\/(?:inicio|torneos|partidos|equipos|jugadores|estadisticas|disciplina|administracion|compartir)(?:\/|$)/.test(v) ? v : '/inicio';
  };
  const routeFromHash = () => normalize(location.hash.slice(1));
  const sourceSignature = () => {
    const state = core.getState() || {};
    return JSON.stringify([
      state.version, state.updatedAt,
      state.tournaments?.map(t => [t.id,t.name,t.status,t.champion,t.matches?.map(m=>[m.id,m.homeGoals,m.awayGoals,m.goals?.length,m.cards?.length])]),
      state.teams?.map(t => [t.id,t.name,t.players?.length]),
      state.discipline?.records?.length
    ]);
  };
  function updateNav() {
    const page = route.split('/')[1] || 'inicio';
    document.querySelectorAll('[data-cm62-nav]').forEach(a => a.classList.toggle('active',a.dataset.cm62Nav===page));
    const more = document.querySelector('[data-cm62-more]');
    more?.classList.toggle('active',!['inicio','torneos','partidos','equipos'].includes(page));
    document.querySelectorAll('.nav-button[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===page));
  }
  function closeSheet() {
    sheet.hidden = true;
    document.querySelector('[data-cm62-more]')?.setAttribute('aria-expanded','false');
  }
  function fallbackRoute(path) {
    const parts = path.split('/').filter(Boolean);
    if (parts[0]==='jugadores') return '/jugadores';
    if (parts[0]==='partidos'&&parts.length>=3) return '/torneos/'+encodeURIComponent(parts[1]);
    if (parts[0]==='torneos') return '/torneos';
    if (parts[0]==='equipos') return '/equipos';
    if (parts[0]==='estadisticas') return '/estadisticas';
    return '/inicio';
  }
  function draw({keepFocus='',keepScroll=false}={}) {
    const next = routeFromHash();
    route = next;
    const oldTop = window.scrollY;
    const input = keepFocus && document.getElementById(keepFocus);
    let pos = 0;
    try { pos = input?.selectionStart ?? 0; } catch {}
    const parts = next.split('/').filter(Boolean);
    const detail = parts.length > 1 && parts[0] !== 'estadisticas';
    const back = detail ? '<button type="button" class="cm62-back" data-cm62-back aria-label="Volver al contexto anterior">← Volver</button>' : '';
    try {
      screen.innerHTML = back + '<div class="cm62-content">' + views.render(next,filters) + '</div>';
    } catch(error) {
      console.error('No se pudo renderizar la experiencia ChuteMundo 6.2',error);
      screen.innerHTML = back + '<div class="cm62-error"><h1>No fue posible mostrar esta sección</h1><p>El contenido deportivo permanece guardado. Puedes regresar a Inicio o usar las herramientas originales.</p><a href="#/inicio" data-cm62-route="/inicio">Volver a Inicio</a></div>';
    }
    updateNav();
    closeSheet();
    closeDesktopMenu();
    const target = keepFocus && document.getElementById(keepFocus);
    if (target) {
      target.focus({preventScroll:true});
      try {target.setSelectionRange(pos,pos);} catch{}
    }
    if (keepScroll) window.scrollTo({top:oldTop,behavior:'instant'});
    else window.scrollTo({top:0,behavior:'instant'});
    lastSignature = sourceSignature();
    document.title = 'ChuteMundo · '+(pages[parts[0]]?.[0] || 'Competición')+' · 6.2';
  }
  function go(target,{replace=false}={}){
    const next=normalize(target);
    if(next.startsWith('/compartir/')) {
      const parts=next.split('/');
      void share('#/partidos/'+parts[2]+'/'+parts[3]);
      return;
    }
    if(next===route) {closeSheet();return;}
    if(replace) history.replaceState({cm62:true,cm62Depth:depth},'', '#'+next);
    else {depth=Number(history.state?.cm62Depth||0)+1;history.pushState({cm62:true,cm62Depth:depth},'', '#'+next);}
    draw();
  }
  function back(){
    if(Number(history.state?.cm62Depth||0)>0){history.back();}
    else go(fallbackRoute(route));
  }
  async function share(path) {
    const link = location.origin+location.pathname+'#'+path.replace(/^#/,'');
    try {
      if(navigator.share) await navigator.share({title:'ChuteMundo',url:link});
      else if(navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        core.showToast?.('Enlace copiado.');
      } else {
        const input=document.createElement('input');
        input.value=link;document.body.appendChild(input);input.select();
        const copied=document.execCommand('copy');input.remove();
        if(copied)core.showToast?.('Enlace copiado.');
      }
    } catch (error) {
      if(error?.name!=='AbortError')core.showToast?.('No se pudo compartir el enlace.');
    }
  }
  const filterIds = {
    cm62TournamentSearch:'tournamentSearch',
    cm62TournamentStatus:'tournamentStatus',
    cm62MatchTournament:'matchTournament',
    cm62MatchStatus:'matchStatus',
    cm62TeamSearch:'teamSearch',
    cm62PlayerSearch:'playerSearch',
    cm62PlayerTeam:'playerTeam',
    cm62PlayerPosition:'playerPosition',
    cm62DisciplineTeam:'disciplineTeam',
    cm62StatPeriod:'statPeriod',
    cm62StatTournament:'statTournament',
    cm62StatTeam:'statTeam',
    cm62StatFormat:'statFormat',
    cm62H2HA:'h2hA',
    cm62H2HB:'h2hB'
  };
  function filterChange(target) {
    const key=filterIds[target?.id];
    if(!key)return false;
    filters[key]=target.value;
    draw({keepFocus:target.id,keepScroll:true});
    return true;
  }
  document.addEventListener('input',event=>{if(filterIds[event.target?.id])filterChange(event.target);},true);
  document.addEventListener('change',event=>{if(filterIds[event.target?.id])filterChange(event.target);},true);
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('[data-cm62-route]');
    if(link) {
      event.preventDefault();
      event.stopImmediatePropagation();
      go(link.dataset.cm62Route);
      return;
    }
    const backButton=event.target.closest?.('[data-cm62-back]');
    if(backButton){event.preventDefault();event.stopImmediatePropagation();back();return;}
    const desktopMore=event.target.closest?.('[data-cm62-desktop-more]');
    if(desktopMore) {
      event.preventDefault();
      const panel=desktopMenu.querySelector('.cm62-desktop-menu-panel');
      panel.hidden=!panel.hidden;
      desktopMore.setAttribute('aria-expanded',String(!panel.hidden));
      return;
    }
    const more=event.target.closest?.('[data-cm62-more]');
    if(more){event.preventDefault();sheet.hidden=!sheet.hidden;more.setAttribute('aria-expanded',String(!sheet.hidden));return;}
    const search=event.target.closest?.('[data-cm62-search]');
    if(search){event.preventDefault();go('/jugadores');setTimeout(()=>document.getElementById('cm62PlayerSearch')?.focus(),0);return;}
    const edit=event.target.closest?.('[data-cm62-edit]');
    if(edit){
      const [tid,mid]=edit.dataset.cm62Edit.split('__');
      window.ChuteDetailEvents?.openDetailedMatch?.(tid,mid);
      return;
    }
    const shareButton=event.target.closest?.('[data-cm62-share]');
    if(shareButton){event.preventDefault();void share(shareButton.dataset.cm62Share);return;}
    const h2h=event.target.closest?.('[data-cm62-h2h]');
    if(h2h){
      const [a,b]=h2h.dataset.cm62H2h.split('__');
      filters.h2hA=a;filters.h2hB=b;
      go('/estadisticas/h2h');
      draw({keepScroll:true});
      return;
    }
    const login=event.target.closest?.('[data-cm62-login]');
    if(login){document.getElementById('authButton')?.click();return;}
    const classicButton=event.target.closest?.('[data-cm62-classic]');
    if(classicButton){
      const page=classicButton.dataset.cm62Classic;
      const focus=classicButton.dataset.cm62Focus;
      location.href=location.pathname+'?classic=1'+(focus?'&focus='+encodeURIComponent(focus):'')+'#/'+encodeURIComponent(page);
      return;
    }
    const oldButton=event.target.closest?.('.nav-button[data-page], [data-cm-v6-page], [data-cm-mobile-page], [data-cm-page]');
    if(oldButton){
      const id=oldButton.dataset.page||oldButton.dataset.cmV6Page||oldButton.dataset.cmMobilePage||oldButton.dataset.cmPage;
      if(id&&pages[id]){
        event.preventDefault();
        event.stopImmediatePropagation();
        go('/'+id);
        return;
      }
    }
    if(!event.target.closest('#cm62MoreSheet'))closeSheet();
    if(!event.target.closest('.cm62-desktop-menu'))closeDesktopMenu();
  },true);
  window.addEventListener('popstate',()=>{depth=Number(history.state?.cm62Depth||0);draw()});
  window.addEventListener('hashchange',()=>{if(route!==routeFromHash())draw()});
  window.addEventListener('keydown',event=>{if(event.key==='Escape'){closeSheet();closeDesktopMenu();}});
  document.addEventListener('chute:state-changed',()=>{
    if(refreshScheduled)return;
    refreshScheduled=true;
    requestAnimationFrame(()=>{
      refreshScheduled=false;
      const nextSig=sourceSignature();
      if(nextSig!==lastSignature)draw({keepScroll:true});
    });
  });
  document.addEventListener('chute:boot-complete',()=>draw({keepScroll:true}));
  draw();
  window.ChuteExperience = Object.freeze({
    enabled:true,version:'6.2.0',navigate:go,back,
    route:()=>route,
    refresh:()=>draw({keepScroll:true}),
    get filters(){return {...filters}}
  });
}
