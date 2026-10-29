import { courrierReferences } from '../utils/courrierReferences';
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Permission } from '../types';
import { EmptyState, Feedback, PageHeading, Surface } from '../components/ui/Workspace';
import { WorkspaceData, getWorkspace, statusLabel, formatDate } from '../services/workspaceService';

export default function CourrierWorkspace() {
  const { hasPermission } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState(params.get('q') || '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = params.toString();
  useEffect(() => { setSearch(new URLSearchParams(query).get('q') || ''); }, [query]);
  useEffect(() => {
    const controller=new AbortController(); setLoading(true); setError('');
    getWorkspace(new URLSearchParams(query), controller.signal).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query,retry]);
  const filter = (key: string, value: string) => { const next=new URLSearchParams(params); value ? next.set(key,value) : next.delete(key); next.delete('page'); setParams(next); };
  const activeView=params.get('view') || 'all';
  return <div className="workspace-page">
    <PageHeading eyebrow="Gestion documentaire" title="Courriers" description="Retrouvez, consultez et suivez vos correspondances." actions={<><Link className="workspace-button secondary" to="/courriers/avance">Classement et imports</Link>{hasPermission(Permission.CREER_COURRIER) && <Link className="workspace-button" to="/enregistrer">+ Nouveau courrier</Link>}</>} />
    <Surface><div className="workspace-tabs" role="group" aria-label="Vues des courriers">{[['all','Tous les courriers'],['active','À traiter'],['overdue','En retard'],['urgent','Urgents'],['mine','Enregistrés par moi'],['done','Terminés']].map(([value,label]) => <button key={value} className={activeView===value?'is-active':''} aria-pressed={activeView===value} onClick={()=>filter('view',value)}>{label}{value==='all' && data && <span>{data.stats.total}</span>}</button>)}</div>
      <div className="workspace-filterbar"><form onSubmit={e=>{e.preventDefault();filter('q',search.trim());}} className="workspace-search"><label className="sr-only" htmlFor="courrier-search">Rechercher par numéro, objet ou correspondant</label><input id="courrier-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Numéro, objet ou correspondant…" type="search" maxLength={200}/><button type="submit" aria-label="Lancer la recherche">Rechercher</button></form>
        <button type="button" className="workspace-filter-toggle" aria-expanded={filtersOpen} aria-controls="workspace-additional-filters" onClick={()=>setFiltersOpen(!filtersOpen)}>{filtersOpen?'Masquer les filtres':'Affiner la recherche'}</button>
        <div id="workspace-additional-filters" className={`workspace-filters ${filtersOpen?'is-open':''}`}>
        <label className="workspace-filter"><span>Sens</span><select value={params.get('sens')||''} onChange={e=>filter('sens',e.target.value)}><option value="">Tous</option><option value="ENTRANT">Entrant</option><option value="SORTANT">Sortant</option></select></label>
        <label className="workspace-filter"><span>Type</span><select value={params.get('type')||''} onChange={e=>filter('type',e.target.value)}><option value="">Tous</option><option value="INTERNE">Interne</option><option value="EXTERNE">Externe</option></select></label>
        <label className="workspace-filter"><span>Statut</span><select value={params.get('statut')||''} onChange={e=>filter('statut',e.target.value)}><option value="">Tous</option>{Object.entries(statusLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="workspace-filter"><span>Ordre</span><select value={params.get('sort')||'newest'} onChange={e=>filter('sort',e.target.value)}><option value="newest">Plus récents</option><option value="oldest">Plus anciens</option></select></label>
        </div>
      </div>
      <div className="workspace-results-heading"><p aria-live="polite">{loading ? 'Chargement des courriers…' : `${data?.pagination.total || 0} courrier${data?.pagination.total===1?'':'s'}`}</p>{query && <button onClick={()=>setParams({})}>Effacer les filtres</button>}</div>
      {error ? <Feedback message={error} retry={()=>setRetry(v=>v+1)}/> : loading ? <div role="status" className="workspace-loading">Chargement de votre espace…</div> : data?.items.length ? <>
        <div className="workspace-table-wrap"><table className="workspace-table"><caption className="sr-only">Courriers correspondant à vos filtres</caption><thead><tr><th scope="col">Courrier</th><th scope="col">Correspondants</th><th scope="col">Statut</th><th scope="col">Enregistrement</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead><tbody>{data.items.map(c=><tr key={c.id}><td data-label="Courrier"><Link className="workspace-subject" to={`/courriers/${c.id}`}>{c.objet}</Link><p className="workspace-reference">{courrierReferences(c)}</p><span className="workspace-caption">{c.sens==='SORTANT'?'Sortant':'Entrant'} · {c.type==='EXTERNE'?'Externe':'Interne'}</span></td><td data-label="Correspondants"><p className="workspace-correspondent">{c.expediteur}</p><p className="workspace-caption">À : {c.destinataire}</p></td><td data-label="Statut"><span className={`workspace-badge ${['TRAITE','ARCHIVE'].includes(c.statut)?'success':''}`}>{statusLabel[c.statut] || c.statut}</span>{c.priorite==='URGENTE' && <span className="workspace-badge danger">Urgent</span>}</td><td data-label="Enregistrement" className="workspace-date">{formatDate(c.dateEnregistrement)}</td><td><Link className="workspace-open" to={`/courriers/${c.id}`} aria-label={`Consulter ${courrierReferences(c)}`}>Consulter <span aria-hidden="true">↗</span></Link></td></tr>)}</tbody></table></div>
        <div className="workspace-pagination"><p>Page {data.pagination.page} sur {data.pagination.pages} · {data.pagination.perPage} par page</p><div><button disabled={data.pagination.page<=1} onClick={()=>{const n=new URLSearchParams(params);n.set('page',String(data.pagination.page-1));setParams(n);}}>Précédent</button><button disabled={data.pagination.page>=data.pagination.pages} onClick={()=>{const n=new URLSearchParams(params);n.set('page',String(data.pagination.page+1));setParams(n);}}>Suivant</button></div></div>
      </> : <EmptyState title={query?'Aucun courrier ne correspond':'Votre espace courrier est prêt'} description={query?'Essayez un autre numéro ou ajustez les filtres.':'Les courriers accessibles à votre compte apparaîtront ici après leur enregistrement.'} action={query?<button className="workspace-button secondary" onClick={()=>setParams({})}>Réinitialiser la recherche</button>:hasPermission(Permission.CREER_COURRIER)?<Link className="workspace-button" to="/enregistrer">Enregistrer un premier courrier</Link>:undefined}/>}
    </Surface><p className="workspace-footnote">Les résultats respectent votre périmètre d’accès. Les deux numéros sont recherchables.</p>
  </div>;
}
