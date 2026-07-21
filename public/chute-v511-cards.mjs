const I = window.ChuteV511Internal;
if (!I) throw new Error('El núcleo v5.11 no está disponible.');
const { core, norm, played, matchesOf, suspensionNames } = I;

function setCanvasText(ctx, value, x, y, maxWidth, font, align = 'left') {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillText(String(value), x, y, maxWidth);
}
function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
function drawTeamBadge(ctx, teamId, x, y, size) {
  const team = core.teamById(teamId);
  const initials = team?.initials || String(team?.name || '?').split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase();
  ctx.fillStyle = '#0b7557';
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  setCanvasText(ctx, initials, x, y + size * .11, size * .8, `900 ${Math.round(size * .28)}px system-ui`, 'center');
}

async function deliverCanvas(canvas, filename, shareText) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', .95));
  if (!blob) throw new Error('No se pudo generar la imagen.');
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: 'Chute Mundo', text: shareText, files: [file] });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
  core.showToast('Tarjeta generada y descargada.');
}

async function shareResult(pair) {
  const [tournamentId, matchId] = pair.split('__');
  const tournament = core.tournamentById(tournamentId);
  const match = tournament?.matches.find((item) => item.id === matchId);
  if (!tournament || !match || !played(match)) return core.showToast('El resultado todavía no está disponible.');
  const home = match.home || core.resolveHome(tournament, match);
  const away = match.away || core.resolveAway(tournament, match);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, '#05271d');
  gradient.addColorStop(1, '#0b7557');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = 'rgba(255,255,255,.09)';
  roundedRect(ctx, 70, 160, 940, 710, 44);
  ctx.fill();
  ctx.fillStyle = '#9ce8ce';
  setCanvasText(ctx, 'CHUTE MUNDO', 540, 90, 900, '900 34px system-ui', 'center');
  ctx.fillStyle = '#fff';
  setCanvasText(ctx, tournament.name, 540, 135, 900, '800 28px system-ui', 'center');
  drawTeamBadge(ctx, home, 245, 350, 190);
  drawTeamBadge(ctx, away, 835, 350, 190);
  ctx.fillStyle = '#fff';
  setCanvasText(ctx, core.teamName(home), 245, 500, 330, '800 36px system-ui', 'center');
  setCanvasText(ctx, core.teamName(away), 835, 500, 330, '800 36px system-ui', 'center');
  setCanvasText(ctx, `${match.homeGoals}  —  ${match.awayGoals}`, 540, 400, 360, '950 92px system-ui', 'center');
  if (match.homePens !== null && match.awayPens !== null) {
    ctx.fillStyle = '#d5f4e8';
    setCanvasText(ctx, `Penales ${match.homePens}-${match.awayPens}`, 540, 458, 500, '700 25px system-ui', 'center');
  }
  ctx.fillStyle = '#d5f4e8';
  setCanvasText(ctx, `${match.round || match.label || 'Partido'}${match.date ? ` · ${match.date}` : ''}${match.time ? ` · ${match.time}` : ''}`, 540, 620, 850, '700 27px system-ui', 'center');
  if (match.venue) setCanvasText(ctx, match.venue, 540, 665, 850, '600 25px system-ui', 'center');
  const goals = (match.goals || []).slice(0, 8).map((goal) => `${goal.minute ? `${goal.minute}′ ` : ''}${goal.playerName}`).join(' · ');
  if (goals) {
    ctx.fillStyle = '#fff';
    setCanvasText(ctx, goals, 540, 750, 820, '600 24px system-ui', 'center');
  }
  ctx.fillStyle = '#9ce8ce';
  setCanvasText(ctx, 'Competición oficial', 540, 965, 900, '700 26px system-ui', 'center');
  await deliverCanvas(canvas, `chute-mundo-${norm(core.teamName(home)).replace(/\s+/g, '-')}-${norm(core.teamName(away)).replace(/\s+/g, '-')}.png`, `${core.teamName(home)} ${match.homeGoals}-${match.awayGoals} ${core.teamName(away)}`);
}

async function shareSchedule(tournamentId) {
  const tournament = core.tournamentById(tournamentId);
  if (!tournament) return;
  const rows = matchesOf(tournament).filter((match) => !played(match));
  if (!rows.length) return core.showToast('No quedan partidos pendientes para programar.');
  const height = Math.max(1350, 300 + rows.length * 150);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1080, height);
  gradient.addColorStop(0, '#05271d');
  gradient.addColorStop(1, '#0b7557');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, height);
  ctx.fillStyle = '#9ce8ce';
  setCanvasText(ctx, 'PROGRAMACIÓN · CHUTE MUNDO', 540, 80, 930, '900 32px system-ui', 'center');
  ctx.fillStyle = '#fff';
  setCanvasText(ctx, tournament.name, 540, 135, 930, '900 40px system-ui', 'center');
  let y = 220;
  for (const match of rows) {
    const home = match.home || core.resolveHome(tournament, match);
    const away = match.away || core.resolveAway(tournament, match);
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    roundedRect(ctx, 70, y, 940, 118, 28);
    ctx.fill();
    ctx.fillStyle = '#9ce8ce';
    setCanvasText(ctx, match.round || match.label || 'Partido', 100, y + 34, 360, '800 20px system-ui');
    ctx.fillStyle = '#fff';
    setCanvasText(ctx, `${core.teamName(home)}  vs.  ${core.teamName(away)}`, 100, y + 74, 650, '800 28px system-ui');
    const timing = match.date || match.time ? `${match.date || 'Fecha por confirmar'} · ${match.time || 'Hora por confirmar'}` : 'Fecha y hora por confirmar';
    ctx.fillStyle = '#d5f4e8';
    setCanvasText(ctx, timing, 970, y + 47, 300, '700 20px system-ui', 'right');
    if (match.venue) setCanvasText(ctx, match.venue, 970, y + 78, 300, '600 18px system-ui', 'right');
    const suspended = suspensionNames(tournament, match);
    if (suspended.length) {
      ctx.fillStyle = '#ffd9d9';
      setCanvasText(ctx, `Suspendidos: ${suspended.join(', ')}`, 100, y + 104, 850, '600 16px system-ui');
    }
    y += 145;
  }
  ctx.fillStyle = '#9ce8ce';
  setCanvasText(ctx, 'Los horarios se actualizan al iniciar cada partido.', 540, height - 70, 900, '700 22px system-ui', 'center');
  await deliverCanvas(canvas, `programacion-${norm(tournament.name).replace(/\s+/g, '-')}.png`, `Programación de ${tournament.name}`);
}

Object.assign(I, { shareResult, shareSchedule });
