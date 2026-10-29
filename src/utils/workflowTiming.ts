export type TimedTask = {
  dateDebut?: string | null; dateFin?: string | null; createdAt?: string | null;
  statut: string; responses?: {message: string; createdAt: string}[];
};
export function timestamp(value?: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}
/** Sum recorded execution intervals, including attempts ended by rejection. */
export function executionMilliseconds(task: TimedTask, now = Date.now()): number | null {
  const events = (task.responses || []).map(event => ({...event, time: timestamp(event.createdAt)}))
    .filter(event => event.time !== null).sort((a,b) => a.time! - b.time!);
  let start: number | null = null, total = 0, recorded = false;
  for (const event of events) {
    const transition = event.message.match(/^(EN_ATTENTE|EN_COURS|REJETE|TERMINE) → (EN_ATTENTE|EN_COURS|REJETE|TERMINE)(?: :|$)/);
    if (!transition) continue;
    const [,from,to] = transition;
    if (to === 'EN_COURS' && start === null) {start = event.time; recorded = true;}
    if (to === 'TERMINE' || to === 'REJETE') {
      if (start !== null) {total += Math.max(0,event.time! - start); start = null; recorded = true;}
      else if (from === 'EN_ATTENTE') {recorded = true;}
    }
    if (to === 'EN_ATTENTE') start = null;
  }
  if (start !== null && task.statut === 'EN_COURS') total += Math.max(0,now - start);
  if (recorded) return total;
  const begin = timestamp(task.dateDebut), end = timestamp(task.dateFin);
  return begin === null ? null : Math.max(0,(end ?? (task.statut === 'EN_COURS' ? now : begin)) - begin);
}
export function durationLabel(value: number | null): string {
  if (value === null) return 'Non démarrée';
  const seconds = Math.floor(Math.max(0,value)/1000);
  if (seconds < 60) return seconds + ' s';
  const minutes = Math.floor(seconds/60), hours = Math.floor(minutes/60), days = Math.floor(hours/24);
  return days ? days+' j '+hours%24+' h' : hours ? hours+' h '+minutes%60+' min' : minutes+' min '+seconds%60+' s';
}
export function taskDate(value?: string | null): string {
  const time = timestamp(value);
  return time === null ? '—' : new Date(time).toLocaleString('fr-FR',{timeZone:'Africa/Kinshasa',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
