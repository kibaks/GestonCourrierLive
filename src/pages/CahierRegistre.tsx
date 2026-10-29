import {internalEntityPath,matchesInternalEntity} from '../utils/internalEntities';
import {entiteTypeService} from '../services/entiteTypeService';
import {buildCahierRegisterPdf} from '../utils/cahierRegisterPdf';
import {filterRegisterCourriers} from '../utils/registerFilters';
import { profileRequest } from '../services/profileService';
import RegisterPreviewDialog from '../components/courriers/RegisterPreviewDialog';
import { courrierReferences, courrierSearchReferences } from '../utils/courrierReferences';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { courrierService } from '../services/courrierService';
import { formulaireCourrierService } from '../services/formulaireCourrierService';
import { entiteOrganisationnelleService } from '../services/entiteOrganisationnelleService';
import { adminService } from '../services/adminService';
import { exportSettingsService } from '../services/exportSettingsService';
import { Courrier, SensCourrier, TypeCourrier, StatutCourrier, Priorite, Role } from '../types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faTimes, faEye, faPrint, faFilter, faArrowLeft, faBuilding, faQrcode, faTable, faPalette, faColumns, faFileAlt } from '@fortawesome/free-solid-svg-icons';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface RegistreConfig {
  // En-tête
  title: string;
  subtitle: string;
  organisationName: string;
  organisationAddress: string;
  showHeader: boolean;
  // QR Code
  includeQrCode: boolean;
  qrBaseUrl: string;
  // Tableau
  includeStats: boolean;
  showBorders: boolean;
  showRowNumbers: boolean;
  paperSize: 'a4' | 'a3' | 'letter';
  orientation: 'portrait' | 'landscape';
  fontSize: 8 | 9 | 10 | 11 | 12;
  tableAlign: 'left' | 'center' | 'right';
  tableMargin: number;
  columnPadding: number;
  columns: Array<{ key: string; label: string; width: number; visible: boolean }>;
  // Filtres
  filterSens: 'ALL' | 'ENTRANT' | 'SORTANT';
  filterType: 'ALL' | 'INTERNE' | 'EXTERNE';
  filterStatut: 'ALL' | 'ENREGISTRE' | 'EN_ATTENTE_DG' | 'ORIENTE_DG' | 'ORIENTE_DIRECTEUR' | 'EN_TRAITEMENT' | 'ASSIGNE' | 'TRAITE' | 'ARCHIVE';
  filterPriorite: 'ALL' | 'HAUTE' | 'MOYENNE' | 'BASSE';
  filterSearch: string;
  filterDateDebut: string;
  filterDateFin: string;
  filterMesAssignations: boolean;
  filterNonClassifies: boolean;
  filterAnnotationDG: 'ALL' | 'AVEC_ANNOTATION_DG' | 'SANS_ANNOTATION_DG';
  filterEntityId: string;
}

const CahierRegistre: React.FC<{adminMode?: boolean}> = ({adminMode=false}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [courriers, setCourriers] = useState<Courrier[]>([]);
  const [registryEntities,setRegistryEntities]=useState(()=>entiteOrganisationnelleService.getAllEntities().filter(e=>e.actif!==false));
  const [entityLevels,setEntityLevels]=useState(()=>entiteTypeService.getActiveTypesForFilters());
  const [entitySelection,setEntitySelection]=useState<Record<string,string>>({});
  const matchEntity=(row:Courrier,id:string)=>matchesInternalEntity(row,id,registryEntities);
  const [loading, setLoading] = useState(true);
  const [settingsVersion, setSettingsVersion] = useState<string|null>(null);
  const [settingsReady,setSettingsReady]=useState(false);
  const [settingsMessage,setSettingsMessage]=useState('');
  const [savingSettings,setSavingSettings]=useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hierarchicalPath, setHierarchicalPath] = useState<Array<{ id: string; nom: string; type: string }>>([]);
  const [selectedParentEntity, setSelectedParentEntity] = useState<string | null>(null);
  const [hierarchicalLevel, setHierarchicalLevel] = useState<number>(0);
  const [mesAssignations, setMesAssignations] = useState<Set<string>>(new Set());

  // Déterminer si "Mes assignations" doit être activé par défaut (DG et Directeurs)
  const shouldEnableMesAssignationsByDefault = user?.role === Role.DIRECTEUR_GENERAL || user?.role === Role.DIRECTEUR;

  const [registreConfig, setRegistreConfig] = useState<RegistreConfig>({
    title: 'Cahier Registre des Courriers',
    subtitle: '',
    organisationName: 'Autorité de Régulation des Marchés Publics',
    organisationAddress: '',
    showHeader: true,
    includeQrCode: false,
    qrBaseUrl: window.location.origin + '/courriers/',
    includeStats: true,
    showBorders: true,
    showRowNumbers: true,
    paperSize: 'a4',
    orientation: 'landscape',
    fontSize: 9,
    tableAlign: 'center',
    tableMargin: 10,
    columnPadding: 2,
    columns: [
      { key: 'numero', label: 'Numéro administratif', width: 28, visible: true },
      { key: 'dateReception', label: 'Date', width: 22, visible: true },
      { key: 'expediteur', label: 'Expéditeur', width: 38, visible: true },
      { key: 'destinataire', label: 'Destinataire', width: 38, visible: true },
      { key: 'objet', label: 'Objet', width: 60, visible: true },
      { key: 'statut', label: 'Statut', width: 28, visible: true },
      { key: 'priorite', label: 'Priorité', width: 22, visible: true },
    ],
    filterSens: 'ALL',
    filterType: 'ALL',
    filterStatut: 'ALL',
    filterPriorite: 'ALL',
    filterSearch: '',
    filterDateDebut: '',
    filterDateFin: '',
    filterMesAssignations: false,
    filterNonClassifies: false,
    filterAnnotationDG: 'ALL',
    filterEntityId: 'ALL',
  });

  // Charger les courriers
  useEffect(() => {
    loadCourriers();
  }, []);

  const loadCourriers = async () => {
    try {
      setLoading(true);
      await Promise.all([entiteOrganisationnelleService.refreshFromApi(),entiteTypeService.syncFromApi()]);
      setRegistryEntities(entiteOrganisationnelleService.getAllEntities().filter(e=>e.actif!==false));
      setEntityLevels(entiteTypeService.getActiveTypesForFilters());
      // Utiliser getAccessibleCourriers pour respecter les permissions par rôle (comme dans ListeCourriers)
      const data = user ? await courrierService.getAccessibleCourriers(user.id, user) : [];
      setCourriers(data);

      // Charger les assignations de l'utilisateur
      if (user) {
        const assignations = await courrierService.getAssignationsByUser(user.id);
        setMesAssignations(new Set(assignations.map(a => a.courrierId)));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des courriers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{
    const controller=new AbortController();
    profileRequest<{version:string|null;config:Partial<RegistreConfig>}>('register/settings',undefined,'GET',controller.signal).then(state=>{
      setSettingsVersion(state.version);setRegistreConfig(previous=>({...previous,...state.config}));setSettingsReady(true);
    }).catch(error=>{if(!controller.signal.aborted)setSettingsMessage(error instanceof Error?error.message:'Configuration indisponible.');});
    return()=>controller.abort();
  },[]);
  const saveSettings=async()=>{
    if(savingSettings||!settingsReady)return;setSavingSettings(true);setSettingsMessage('');
    try{
      const config=Object.fromEntries(Object.entries(registreConfig).filter(([key])=>!key.startsWith('filter')));
      const result=await profileRequest<{version:string}>('register/settings',{version:settingsVersion,config},'PUT');
      setSettingsVersion(result.version);setSettingsMessage('Configuration du cahier enregistrée pour tous les utilisateurs.');
    }catch(error){setSettingsMessage(error instanceof Error?error.message:'Enregistrement impossible.');}finally{setSavingSettings(false);}
  };

  // Handlers pour les filtres
  const handleFilterSens = (sens: 'ALL' | 'ENTRANT' | 'SORTANT') => {
    setRegistreConfig(prev => ({ ...prev, filterSens: sens }));
  };

  const handleFilterType = (type: 'ALL' | 'INTERNE' | 'EXTERNE') => {
    setRegistreConfig(prev => ({ ...prev, filterType: type }));
  };

  const handleFilterStatut = (statut: string) => {
    setRegistreConfig(prev => ({ ...prev, filterStatut: statut as any }));
  };

  const handleFilterPriorite = (priorite: string) => {
    setRegistreConfig(prev => ({ ...prev, filterPriorite: priorite as any }));
  };

  const handleFilterAnnotationDG = (annotationDG: string) => {
    setRegistreConfig(prev => ({ ...prev, filterAnnotationDG: annotationDG as any }));
  };

  const handleFilterSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegistreConfig(prev => ({ ...prev, filterSearch: e.target.value }));
  };

  const handleFilterDateDebutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegistreConfig(prev => ({ ...prev, filterDateDebut: e.target.value }));
  };

  const handleFilterDateFinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegistreConfig(prev => ({ ...prev, filterDateFin: e.target.value }));
  };

  const handleFilterMesAssignationsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegistreConfig(prev => ({ ...prev, filterMesAssignations: e.target.checked }));
  };

  const handleFilterNonClassifiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegistreConfig(prev => ({ ...prev, filterNonClassifies: e.target.checked }));
  };

  // Utilitaire : valeur d'une cellule
  const getCellValue = (c: Courrier, key: string, dgAnnotationMap: Map<string, string>): string => {
    const internalPath=internalEntityPath(c,key,entityLevels,registryEntities);
    if(internalPath)return internalPath;
    if (key === 'numero') return courrierReferences(c) || '-';
    if (key === 'dateReception') return exportSettingsService.formatDate(c.dateReception);
    if (key === 'statut') return c.statut || '-';
    if (key === 'priorite') return c.priorite || '-';
    if (key === 'annotationDG') {
      const v = dgAnnotationMap.get(c.id);
      return v || '-';
    }
    if (c.extraFields && key in c.extraFields) return String(c.extraFields[key] || '-');
    return String((c as any)[key] || '-');
  };

  // Fonction pour générer le registre PDF — style tableau Word
  const handleGenerateRegistre = async (preview = false) => {
    if(invalidPeriod)return;
    try {
      // ── Filtrage ──
      let filteredCourriers = filterRegisterCourriers(courriers,registreConfig,mesAssignations,matchEntity);

      // ── Annotations DG ──
      const dgAnnotationMap = new Map<string, string>();
      if (registreConfig.filterAnnotationDG !== 'ALL' || registreConfig.columns.some(col => col.key === 'annotationDG' && col.visible)) {
        const dgUser = adminService.getDirecteurGeneral();
        if (dgUser) {
          const dgIds = new Set<string>();
          for (const c of filteredCourriers) {
            try {
              const anns = await courrierService.getAnnotationsByCourrier(c.id);
              const a = anns.find(x => x.auteur === dgUser.id);
              if (a) { dgIds.add(c.id); dgAnnotationMap.set(c.id, a.contenu); }
            } catch { /* silencieux */ }
          }
          if (registreConfig.filterAnnotationDG === 'AVEC_ANNOTATION_DG') filteredCourriers = filteredCourriers.filter(c => dgIds.has(c.id));
          else if (registreConfig.filterAnnotationDG === 'SANS_ANNOTATION_DG') filteredCourriers = filteredCourriers.filter(c => !dgIds.has(c.id));
        }
      }

      // ── QR codes pré-générés ──
      const qrDataUrls = new Map<string, string>();
      if (registreConfig.includeQrCode) {
        for (const c of filteredCourriers) {
          try {
            const url = `${registreConfig.qrBaseUrl}${c.id}`;
            const dataUrl = await QRCode.toDataURL(url, { width: 48, margin: 1, errorCorrectionLevel: 'M' });
            qrDataUrls.set(c.id, dataUrl);
          } catch { /* silencieux */ }
        }
      }

      const visibleColumns=registreConfig.columns.filter(column=>column.visible);
      const doc=buildCahierRegisterPdf(filteredCourriers.map(c=>({id:c.id,sens:c.sens,values:visibleColumns.map(column=>getCellValue(c,column.key,dgAnnotationMap)),qrDataUrl:qrDataUrls.get(c.id)})),registreConfig);

      // ── Export ──
      if (preview) {
        const blobUrl = URL.createObjectURL(doc.output('blob'));
        setPreviewUrl(blobUrl);
        setShowPreviewModal(true);
      } else {
        doc.save(`registre-courriers-${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (e) {
      console.error('[Registre PDF] Erreur:', e);
      alert(`Erreur lors de la génération du registre : ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const [activeTab, setActiveTab] = useState<'cahier' | 'entete' | 'mise-en-page' | 'filtres' | 'colonnes'>(adminMode?'entete':'cahier');

  // ── Computed: filtered count preview ──
  const selectedCourriers=filterRegisterCourriers(courriers,registreConfig,mesAssignations,matchEntity);
  const previewCount=selectedCourriers.length;
  const invalidPeriod=!!(registreConfig.filterDateDebut&&registreConfig.filterDateFin&&registreConfig.filterDateFin<registreConfig.filterDateDebut);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
          <span className="text-sm text-slate-500">Chargement…</span>
        </div>
      </div>
    );
  }

  // ─── Shared styles ───
  const fieldCls = 'w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors';
  const selectCls = fieldCls;

  const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">{children}</p>
  );

  const Divider = () => <hr className="border-slate-100 my-5" />;

  const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 px-3 rounded text-xs font-medium transition-colors border ${
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800'
      }`}
    >{children}</button>
  );

  const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }> = ({ checked, onChange, label, description }) => (
    <label className="flex items-start gap-3 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 w-9 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-slate-900' : 'bg-slate-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
      <div>
        <p className="text-sm font-medium text-slate-800 leading-tight">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
    </label>
  );

  const allNavItems: Array<{ id: typeof activeTab; icon: any; label: string }> = [
    { id: 'cahier', icon: faBook, label: 'Le cahier' },
    { id: 'entete',      icon: faBuilding, label: 'En-tête' },
    { id: 'mise-en-page', icon: faTable,   label: 'Mise en page' },
    { id: 'filtres',     icon: faFilter,   label: 'Filtres' },
    { id: 'colonnes',    icon: faColumns,  label: 'Colonnes' },
  ];

  const navItems=allNavItems.filter(item=>adminMode?['entete','mise-en-page','colonnes'].includes(item.id):['cahier','filtres'].includes(item.id));
  const visibleColumns=registreConfig.columns.filter(column=>column.visible);
  const paperPreview = (<section className="registry-book" aria-label="Cahier administratif des courriers">
            <div className="registry-binding" aria-hidden="true" />
            <header className="registry-paper-header">
              <p>République démocratique du Congo</p>
              <strong>{registreConfig.organisationName || 'Autorité de Régulation des Marchés Publics'}</strong>
              <span>{registreConfig.organisationAddress || 'Kinshasa · ARMP'}</span>
              <h2>{registreConfig.title || 'Cahier registre des courriers'}</h2>
              {registreConfig.subtitle && <p>{registreConfig.subtitle}</p>}
              <div className="registry-book-meta"><span>Exercice : {new Date().getFullYear()}</span><span>Registre : {registreConfig.filterSens === 'ENTRANT' ? 'Arrivée' : registreConfig.filterSens === 'SORTANT' ? 'Départ' : 'Correspondance générale'}</span><span>Canevas interne ARMP</span></div>
            </header>
            <div className="registry-paper-scroll" role="region" tabIndex={0} aria-label="Feuillet du registre">
              <table className="registry-paper-table"><thead><tr>{registreConfig.showRowNumbers&&<th scope="col">N° d’ordre</th>}{visibleColumns.map(column=><th scope="col" key={column.key} style={{width:column.width+'%'}}>{column.label}</th>)}</tr></thead><tbody>
                {selectedCourriers.slice(0,12).map((c,index)=><tr key={c.id}>{registreConfig.showRowNumbers&&<td>{String(index+1).padStart(3,'0')}</td>}{visibleColumns.map(column=><td key={column.key}>{getCellValue(c,column.key,new Map())}</td>)}</tr>)}
                {previewCount === 0 && <tr><td colSpan={visibleColumns.length+1}>Aucun courrier pour cette sélection.</td></tr>}
              </tbody></table>
            </div>
            <footer className="registry-paper-footer"><span>Feuillet de présentation · 12 premières inscriptions au maximum<br/>L’édition PDF contient la sélection complète.</span><div>Visa du responsable<span className="registry-visa-line" /></div><span>Cachet du service<span className="registry-stamp" /></span></footer>
          </section>);

  if(adminMode&&user?.role!==Role.SUPER_ADMIN)return <p>Paramétrage réservé à l’administrateur.</p>;
  return (
    <div className="registry-workbench flex flex-col h-screen overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/courriers')}
            className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-sm" />
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <FontAwesomeIcon icon={faBook} className="text-slate-400 text-sm" />
          <h1 className="text-sm font-semibold text-slate-800">Cahier Registre</h1>
          <span className="ml-1 text-xs text-slate-400 font-normal">{courriers.length} courriers</span>
        </div>

        <div className="flex items-center gap-2">
          {adminMode&&<button disabled={!settingsReady||savingSettings} onClick={()=>void saveSettings()} className="workspace-button primary">{savingSettings?'Enregistrement…':'Enregistrer la configuration'}</button>}
          <button disabled={!settingsReady||invalidPeriod}
            onClick={() => handleGenerateRegistre(true)}
            className="h-8 px-4 flex items-center gap-2 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <FontAwesomeIcon icon={faEye} className="text-slate-400" />
            Aperçu
          </button>
          <button
            disabled={!settingsReady||invalidPeriod}
            onClick={() => handleGenerateRegistre(false)}
            className="h-8 px-4 flex items-center gap-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-700 transition-colors"
          >
            <FontAwesomeIcon icon={faPrint} />
            Générer le PDF
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left nav ── */}
        {adminMode&&<nav className="w-52 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col py-4 gap-0.5 px-2">
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 h-9 px-3 rounded-md text-sm font-medium transition-colors w-full text-left ${
                activeTab === item.id
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <FontAwesomeIcon icon={item.icon} className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === item.id ? 'text-slate-700' : 'text-slate-400'}`} />
              {item.label}
            </button>
          ))}

          <div className="mt-auto pt-4 px-1 border-t border-slate-100 mx-1">
            <div className="rounded-md bg-slate-50 border border-slate-100 p-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Courriers sélectionnés</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{previewCount}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">sur {courriers.length} total</p>
            </div>
          </div>
        </nav>}

        {/* ── Content panel ── */}
        <main className="flex-1 overflow-y-auto px-8 py-7">
          {settingsMessage&&<p role="status" className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">{settingsMessage}</p>}
          {!settingsReady&&!settingsMessage&&<p role="status">Chargement de la configuration administrateur…</p>}


          {!adminMode&&<section className="registry-selection" aria-labelledby="registry-filters-title">
            <header><h2 id="registry-filters-title">Filtres du cahier registre</h2><span>{previewCount} courrier{previewCount>1?'s':''} sur {courriers.length}</span><button type="button" onClick={()=>{setEntitySelection({});setRegistreConfig(previous=>({...previous,filterSens:'ALL',filterType:'ALL',filterStatut:'ALL',filterPriorite:'ALL',filterSearch:'',filterDateDebut:'',filterDateFin:'',filterMesAssignations:false,filterNonClassifies:false,filterEntityId:'ALL',filterAnnotationDG:'ALL'}));}}>Réinitialiser</button></header>
            <div className="registry-selection-fields">
              <label className="registry-selection-search">Rechercher<input type="search" value={registreConfig.filterSearch} onChange={handleFilterSearchChange} placeholder="N° administratif, objet, correspondant…"/></label>
              <label>Sens<select value={registreConfig.filterSens} onChange={e=>handleFilterSens(e.target.value as RegistreConfig['filterSens'])}><option value="ALL">Tous</option><option value="ENTRANT">Arrivée</option><option value="SORTANT">Départ</option></select></label>
              <label>Type<select value={registreConfig.filterType} onChange={e=>handleFilterType(e.target.value as RegistreConfig['filterType'])}><option value="ALL">Tous</option><option value="INTERNE">Interne</option><option value="EXTERNE">Externe</option></select></label>
              {entityLevels.map((level,index)=>{
                const parent=index?entitySelection[entityLevels[index-1].code]:undefined;
                if(index&&!parent)return null;
                const options=registryEntities.filter(entity=>entity.type===level.code&&(!parent||entity.parentId===parent));
                return <label key={level.code}>{level.libelleSingulier}<select value={entitySelection[level.code]||''} onChange={event=>{
                  const next=Object.fromEntries(entityLevels.slice(0,index).filter(type=>entitySelection[type.code]).map(type=>[type.code,entitySelection[type.code]]));
                  if(event.target.value)next[level.code]=event.target.value;
                  setEntitySelection(next);
                  const selected=Object.values(next);setRegistreConfig(previous=>({...previous,filterEntityId:selected[selected.length-1]||'ALL'}));
                }}><option value="">Toutes les entités de ce niveau</option>{options.map(entity=><option key={entity.id} value={entity.id}>{entity.nom}</option>)}</select></label>;
              })}

              <label>Statut<select value={registreConfig.filterStatut} onChange={e=>handleFilterStatut(e.target.value)}><option value="ALL">Tous</option>{[['ENREGISTRE','Enregistré'],['EN_ATTENTE_DG','En attente DG'],['ORIENTE_DG','Orienté DG'],['ORIENTE_DIRECTEUR','Orienté direction'],['EN_TRAITEMENT','En traitement'],['ASSIGNE','Assigné'],['TRAITE','Traité'],['ARCHIVE','Archivé']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
              <label>Réception du<input type="date" value={registreConfig.filterDateDebut} onChange={handleFilterDateDebutChange}/></label>
              <label>Au<input type="date" value={registreConfig.filterDateFin} onChange={handleFilterDateFinChange}/></label>
              <label>Priorité<select value={registreConfig.filterPriorite} onChange={e=>handleFilterPriorite(e.target.value)}><option value="ALL">Toutes</option>{Array.from(new Set(courriers.map(c=>c.priorite))).sort().map(priority=><option key={priority} value={priority}>{priority}</option>)}</select></label>
            </div>
            <div className="registry-selection-checks"><label><input type="checkbox" checked={registreConfig.filterMesAssignations} onChange={handleFilterMesAssignationsChange}/>Mes assignations</label><label><input type="checkbox" checked={registreConfig.filterNonClassifies} onChange={handleFilterNonClassifiesChange}/>Non classés uniquement</label><span>La période porte sur la date de réception.</span></div>
            {invalidPeriod&&<p role="alert">La date de fin doit être postérieure ou égale à la date de début.</p>}
          </section>}
          {activeTab === 'cahier' && paperPreview}

          {/* ─── EN-TÊTE ─── */}
          {activeTab === 'entete' && (
            <div className="max-w-xl space-y-0">
              <h2 className="text-base font-semibold text-slate-900 mb-5">En-tête du document</h2>

              <Toggle
                checked={registreConfig.showHeader}
                onChange={v => setRegistreConfig(p => ({ ...p, showHeader: v }))}
                label="Afficher un en-tête"
                description="Ajoute une section d'en-tête avec le nom, titre et sous-titre"
              />

              {registreConfig.showHeader && (
                <>
                  <Divider />
                  <div className="space-y-4">
                    <div>
                      <SectionLabel>Organisation</SectionLabel>
                      <input
                        className={fieldCls}
                        value={registreConfig.organisationName}
                        onChange={e => setRegistreConfig(p => ({ ...p, organisationName: e.target.value }))}
                        placeholder="Ex : Ministère de l'Intérieur"
                      />
                    </div>
                    <div>
                      <SectionLabel>Adresse ou localité</SectionLabel>
                      <input
                        className={fieldCls}
                        value={registreConfig.organisationAddress}
                        onChange={e => setRegistreConfig(p => ({ ...p, organisationAddress: e.target.value }))}
                        placeholder="Ex : Kinshasa, République démocratique du Congo"
                      />
                    </div>
                    <div>
                      <SectionLabel>Titre du registre</SectionLabel>
                      <input
                        className={fieldCls}
                        value={registreConfig.title}
                        onChange={e => setRegistreConfig(p => ({ ...p, title: e.target.value }))}
                        placeholder="Cahier Registre des Courriers"
                      />
                    </div>
                    <div>
                      <SectionLabel>Sous-titre <span className="normal-case font-normal">(optionnel)</span></SectionLabel>
                      <input
                        className={fieldCls}
                        value={registreConfig.subtitle}
                        onChange={e => setRegistreConfig(p => ({ ...p, subtitle: e.target.value }))}
                        placeholder="Ex : Exercice 2025 — Direction Générale"
                      />
                    </div>
                  </div>
                </>
              )}

              <Divider />

              <div className="space-y-4">
                <Toggle
                  checked={registreConfig.includeQrCode}
                  onChange={v => setRegistreConfig(p => ({ ...p, includeQrCode: v }))}
                  label="QR code par ligne"
                  description="Génère un code QR pointant vers chaque courrier"
                />
                {registreConfig.includeQrCode && (
                  <div>
                    <SectionLabel>URL de base</SectionLabel>
                    <input
                      className={fieldCls}
                      value={registreConfig.qrBaseUrl}
                      onChange={e => setRegistreConfig(p => ({ ...p, qrBaseUrl: e.target.value }))}
                      placeholder="https://monapp.com/courriers/"
                    />
                    <p className="text-xs text-slate-400 mt-1.5">L'identifiant du courrier est automatiquement ajouté en fin d'URL.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── MISE EN PAGE ─── */}
          {activeTab === 'mise-en-page' && (
            <div className="max-w-xl space-y-0">
              <h2 className="text-base font-semibold text-slate-900 mb-5">Mise en page du PDF</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <SectionLabel>Format</SectionLabel>
                  <select className={selectCls} value={registreConfig.paperSize}
                    onChange={e => setRegistreConfig(p => ({ ...p, paperSize: e.target.value as any }))}>
                    <option value="a4">A4 — 210 × 297 mm</option>
                    <option value="a3">A3 — 297 × 420 mm</option>
                    <option value="letter">Letter — 216 × 279 mm</option>
                  </select>
                </div>
                <div>
                  <SectionLabel>Orientation</SectionLabel>
                  <select className={selectCls} value={registreConfig.orientation}
                    onChange={e => setRegistreConfig(p => ({ ...p, orientation: e.target.value as any }))}>
                    <option value="landscape">Paysage</option>
                    <option value="portrait">Portrait</option>
                  </select>
                </div>
              </div>

              <Divider />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <SectionLabel>Taille de police</SectionLabel>
                  <select className={selectCls} value={registreConfig.fontSize}
                    onChange={e => setRegistreConfig(p => ({ ...p, fontSize: parseInt(e.target.value) as any }))}>
                    <option value="8">8 pt — très compact</option>
                    <option value="9">9 pt — compact</option>
                    <option value="10">10 pt — normal</option>
                    <option value="11">11 pt — lisible</option>
                    <option value="12">12 pt — aéré</option>
                  </select>
                </div>
                <div>
                  <SectionLabel>Alignement du tableau</SectionLabel>
                  <select className={selectCls} value={registreConfig.tableAlign}
                    onChange={e => setRegistreConfig(p => ({ ...p, tableAlign: e.target.value as any }))}>
                    <option value="left">Aligné à gauche</option>
                    <option value="center">Centré</option>
                    <option value="right">Aligné à droite</option>
                  </select>
                </div>
              </div>

              <Divider />

              <div className="space-y-3.5">
                <SectionLabel>Options du tableau</SectionLabel>
                <Toggle checked={registreConfig.showRowNumbers} onChange={v => setRegistreConfig(p => ({ ...p, showRowNumbers: v }))}
                  label="Numéros de ligne" description="Ajoute une colonne # au début du tableau" />
                <Toggle checked={registreConfig.showBorders} onChange={v => setRegistreConfig(p => ({ ...p, showBorders: v }))}
                  label="Bordures visibles" description="Affiche les bordures de cellules du tableau" />
                <Toggle checked={registreConfig.includeStats} onChange={v => setRegistreConfig(p => ({ ...p, includeStats: v }))}
                  label="Résumé statistique" description="Ajoute une ligne entrants / sortants avant le tableau" />
              </div>

              <Divider />

              {/* Preview miniature */}
              <div>
                <SectionLabel>Aperçu du style</SectionLabel>
                <div className="mt-1 rounded-md border border-slate-200 overflow-hidden text-[10px] bg-white shadow-sm">
                  <div className="flex bg-[#1f4e79] text-white font-semibold">
                    {registreConfig.showRowNumbers && <div className="w-7 px-2 py-1.5 border-r border-[#b4c6e7] text-center shrink-0">#</div>}
                    <div className="flex-1 px-2 py-1.5 border-r border-[#b4c6e7]">N° Courrier</div>
                    <div className="flex-1 px-2 py-1.5 border-r border-[#b4c6e7]">Expéditeur</div>
                    <div className="flex-2 px-2 py-1.5">Objet</div>
                  </div>
                  {(['C-2025-001|Dir. RH|Demande de congé annuel', 'C-2025-002|Ministère|Note de service N°12']).map((row, i) => {
                    const [ref, exp, obj] = row.split('|');
                    return (
                      <div key={i} className={`flex border-t border-[#b4c6e7] ${i % 2 === 1 ? 'bg-[#deeaf7]' : 'bg-white'}`}>
                        {registreConfig.showRowNumbers && <div className="w-7 px-2 py-1.5 border-r border-[#b4c6e7] text-center text-slate-400 shrink-0">{i + 1}</div>}
                        <div className="flex-1 px-2 py-1.5 border-r border-[#b4c6e7] font-mono text-slate-700">{ref}</div>
                        <div className="flex-1 px-2 py-1.5 border-r border-[#b4c6e7] text-slate-700">{exp}</div>
                        <div className="flex-2 px-2 py-1.5 text-slate-700">{obj}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── COLONNES ─── */}
          {activeTab === 'colonnes' && (
            <div className="max-w-lg">
              <h2 className="text-base font-semibold text-slate-900 mb-1">Colonnes du tableau</h2>
              <p className="text-sm text-slate-400 mb-5">Sélectionnez les colonnes à inclure et ajustez leur largeur relative.</p>

              <div className="border border-slate-200 rounded-md overflow-hidden bg-white divide-y divide-slate-100">
                {/* Header row */}
                <div className="flex items-center px-4 py-2 bg-slate-50">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex-1">Colonne</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-24 text-right">Largeur</span>
                </div>
                {registreConfig.columns.map((col, index) => (
                  <div key={col.key} className={`flex items-center gap-3 px-4 py-3 transition-colors ${col.visible ? 'bg-white' : 'bg-slate-50'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        const cols = [...registreConfig.columns];
                        cols[index] = { ...cols[index], visible: !col.visible };
                        setRegistreConfig(p => ({ ...p, columns: cols }));
                      }}
                      className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                        col.visible ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-300'
                      }`}
                    >
                      {col.visible && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${col.visible ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>{col.label}</span>
                    <div className="flex items-center gap-2 w-24 justify-end">
                      <input
                        type="number"
                        min={10}
                        max={120}
                        value={col.width}
                        disabled={!col.visible}
                        onChange={e => {
                          const cols = [...registreConfig.columns];
                          cols[index] = { ...cols[index], width: Number(e.target.value) };
                          setRegistreConfig(p => ({ ...p, columns: cols }));
                        }}
                        className="w-14 h-7 px-2 rounded border border-slate-200 text-xs text-right text-slate-700 disabled:opacity-30 focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                      <span className="text-[10px] text-slate-400">px</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── Modal Aperçu PDF ── */}
      {showPreviewModal && previewUrl && (
        <RegisterPreviewDialog onClose={() => { URL.revokeObjectURL(previewUrl); setShowPreviewModal(false); setPreviewUrl(null); }}>
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <FontAwesomeIcon icon={faFileAlt} className="text-slate-400 text-sm" />
                <span className="text-sm font-semibold text-slate-800">Aperçu papier — Cahier Registre</span>
                <span className="text-xs text-slate-400 font-normal">· {previewCount} courrier{previewCount > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={!settingsReady||invalidPeriod}
            onClick={() => handleGenerateRegistre(false)}
                  className="h-8 px-4 flex items-center gap-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-700 transition-colors"
                >
                  <FontAwesomeIcon icon={faPrint} />
                  Télécharger le PDF
                </button>
                <button
                  aria-label="Fermer l’aperçu"
                  onClick={() => { URL.revokeObjectURL(previewUrl); setShowPreviewModal(false); setPreviewUrl(null); }}
                  className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <FontAwesomeIcon icon={faTimes} className="text-sm" />
                </button>
              </div>
            </div>
            {/* PDF viewer */}
            <div className="registry-modal-paper flex-1 min-h-0 bg-slate-100 p-3">
              {paperPreview}
            </div>
        </RegisterPreviewDialog>
      )}
    </div>
  );
};

export default CahierRegistre;
