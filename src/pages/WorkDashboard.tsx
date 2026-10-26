import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faInbox, faPaperPlane, faClock, faCheckCircle, faTriangleExclamation, faArrowRight, faPlus, faFolderOpen, faCalendarDays, faUser } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import { Permission } from '../types';
import { EmptyState, Feedback, PageHeading, Surface } from '../components/ui/Workspace';
import { WorkspaceData, getWorkspace, formatDate, statusLabel } from '../services/workspaceService';

export default function WorkDashboard() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    getWorkspace(new URLSearchParams('per_page=6&view=active'), controller.signal).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [retry]);
  const rate = data?.stats.total ? Math.round(data.stats.done / data.stats.total * 100) : 0;
  const peak = Math.max(1, ...(data?.analytics.monthly.map(m => m.count) || []));
  const metrics = [
    { key: 'total', title: 'Tous les courriers', caption: 'Dans votre périmètre', icon: faEnvelope, href: '/courriers', tone: 'blue' },
    { key: 'incoming', title: 'Courriers entrants', caption: 'Correspondances reçues', icon: faInbox, href: '/courriers?sens=ENTRANT', tone: 'cyan' },
    { key: 'outgoing', title: 'Courriers sortants', caption: 'Correspondances émises', icon: faPaperPlane, href: '/courriers?sens=SORTANT', tone: 'indigo' },
    { key: 'active', title: 'À traiter', caption: 'Courriers encore ouverts', icon: faClock, href: '/courriers/compact?view=active', tone: 'amber' },
    { key: 'done', title: 'Terminés', caption: 'Traités ou archivés', icon: faCheckCircle, href: '/courriers/compact?view=done', tone: 'green' },
    { key: 'overdue', title: 'En retard', caption: 'Échéances dépassées', icon: faTriangleExclamation, href: '/courriers/compact?view=overdue', tone: 'rose' },
  ] as const;
  return <div className="workspace-page sky-dashboard">
    <PageHeading eyebrow="Votre espace de pilotage" title="Tableau de bord" description={new Date().toLocaleDateString('fr-CD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
    <section className="sky-welcome">
      <div className="sky-welcome-copy"><span className="sky-pill"><span aria-hidden="true">●</span> Gestion du courrier · ARMP</span><h2>Bonjour, {user?.nom?.split(' ')[0] || 'vous'} <span>Chaque courrier compte.</span></h2><p>Une vision claire de vos correspondances, de leurs priorités et de leur avancement. Tout votre suivi, au même endroit.</p><div className="workspace-actions">{hasPermission(Permission.CREER_COURRIER) && <Link className="workspace-button" to="/enregistrer"><FontAwesomeIcon icon={faPlus} /> Enregistrer un courrier</Link>}<Link className="workspace-button secondary" to="/courriers">Explorer les courriers <FontAwesomeIcon icon={faArrowRight} /></Link></div></div>
      <div className="sky-welcome-summary"><div className="sky-envelope" aria-hidden="true"><FontAwesomeIcon icon={faEnvelope} /><span><FontAwesomeIcon icon={faCheckCircle} /></span></div><div><p>Avancement global</p><strong>{data ? `${rate}%` : '—'}</strong><span>{data ? `${data.stats.done} sur ${data.stats.total} courriers terminés` : 'Chargement de votre activité…'}</span></div><div className="sky-progress" role="progressbar" aria-label="Courriers terminés" aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${rate}%` }} /></div></div>
    </section>
    {error && <Feedback message={error} retry={() => setRetry(v => v + 1)} />}
    <div className="workspace-metrics sky-metrics">{metrics.map(m => <Link key={m.key} to={m.href} className={`workspace-metric sky-metric ${m.tone}`}><div className="sky-metric-icon"><FontAwesomeIcon icon={m.icon} /></div><span className="workspace-metric-top">{m.title}<span aria-hidden="true">↗</span></span><strong>{data ? data.stats[m.key] : '—'}</strong><span className="workspace-caption">{m.caption}</span></Link>)}</div>
    <div className="sky-analytics-grid">
      <Surface><div className="workspace-section-heading"><div><span className="workspace-eyebrow">Volume des échanges</span><h2>Activité des six derniers mois</h2></div><span className="sky-period">Courriers enregistrés</span></div><div className="sky-bars">{data?.analytics.monthly.map(m => <div className="sky-bar-column" key={m.month}><strong>{m.count}</strong><div className="sky-bar-track"><span style={{ height: `${m.count / peak * 100}%` }} /></div><span>{new Date(`${m.month}-01T12:00:00`).toLocaleDateString('fr-CD', { month: 'short' })}</span></div>)}{!data && <p role="status">Chargement des statistiques…</p>}</div></Surface>
      <Surface><div className="workspace-section-heading"><div><span className="workspace-eyebrow">Suivi du traitement</span><h2>Répartition des courriers</h2></div><FontAwesomeIcon icon={faEnvelope} className="text-sky-600" /></div><div className="sky-distribution"><div className="sky-donut" style={{ background: `conic-gradient(#0284c7 ${rate}%, #dff2fc 0)` }} role="img" aria-label={`${rate} % des courriers sont terminés`}><div><strong>{data ? data.stats.total : '—'}</strong><span>courriers</span></div></div><div className="sky-legend"><p><i className="sky-dot done" />Terminés <strong>{data?.stats.done ?? '—'}</strong></p><p><i className="sky-dot" />À traiter <strong>{data?.stats.active ?? '—'}</strong></p><Link to="/courriers/compact?view=urgent"><i className="sky-dot urgent" />Dont urgents <strong>{data?.stats.urgent ?? '—'}</strong></Link></div></div></Surface>
    </div>
    <div className="workspace-dashboard-grid"><Surface><div className="workspace-section-heading"><div><span className="workspace-eyebrow">À suivre aujourd’hui</span><h2>Votre file de travail</h2><p>Les derniers courriers ouverts dans votre périmètre</p></div><Link to="/courriers">Tout voir ↗</Link></div>{!data && !error ? <div role="status" className="workspace-loading">Chargement de votre activité…</div> : data?.items.length ? <div className="workspace-activity">{data.items.map(c => <Link key={c.id} to={`/courriers/${c.id}`}><span className="workspace-letter-icon" aria-hidden="true"><FontAwesomeIcon icon={c.sens === 'SORTANT' ? faPaperPlane : faInbox} /></span><div><p>{c.objet}</p><span>{c.numero} · {formatDate(c.dateEnregistrement)}</span></div><span className={`workspace-badge ${c.priorite === 'URGENTE' ? 'danger' : ''}`}>{c.priorite === 'URGENTE' ? 'Urgent' : statusLabel[c.statut]}</span></Link>)}</div> : !error ? <EmptyState title="Votre file est à jour" description="Les nouveaux courriers à traiter apparaîtront ici." action={<Link className="workspace-button secondary" to="/courriers">Consulter les courriers</Link>} /> : null}</Surface>
      <aside className="space-y-5"><Surface className="workspace-quicklinks"><span className="workspace-eyebrow">Gagnez du temps</span><h2>Accès rapides</h2>{[{ path: '/enregistrer', title: 'Nouveau courrier', description: 'Enregistrer une correspondance', icon: faPlus }, { path: '/cahier-registre', title: 'Cahier de registre', description: 'Retrouver vos références', icon: faFolderOpen }, { path: '/rappels', title: 'Échéances et rappels', description: 'Organiser vos suivis', icon: faCalendarDays }, { path: '/profil', title: 'Mon espace personnel', description: 'Profil et notifications', icon: faUser }].filter(m => m.path !== '/enregistrer' || hasPermission(Permission.CREER_COURRIER)).map(m => <Link key={m.path} to={m.path}><span className="sky-quick-icon"><FontAwesomeIcon icon={m.icon} /></span><div><strong>{m.title}</strong><span>{m.description}</span></div><span aria-hidden="true">↗</span></Link>)}</Surface><div className="workspace-note"><p className="workspace-eyebrow">Un suivi partagé</p><h3>Du premier enregistrement à la dernière action.</h3><p>Retrouvez les documents, les affectations et l’historique de chaque courrier depuis sa fiche.</p><Link to="/courriers">Ouvrir le registre <FontAwesomeIcon icon={faArrowRight} /></Link></div></aside>
    </div>
  </div>;
}
