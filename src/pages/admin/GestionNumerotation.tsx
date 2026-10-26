import React, { useEffect, useState } from 'react';
import { numberingRequest, NumberingData, NumberingRule } from '../../services/numberingService';

const inputClass = 'w-full rounded-lg border border-slate-300 p-2 text-sm bg-white disabled:bg-slate-100';
const defaults: NumberingRule = { id: '', name: 'Registre général', scopeType: 'global', entityId: null, type: '*', sens: '*',
  format: '{organisation}/{annee}/{compteur}', period: 'year', width: 4, start: 1, splitType: false, splitSens: false };

export default function GestionNumerotation() {
  const [data, setData] = useState<NumberingData | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewEntity, setPreviewEntity] = useState('');
  const [previewType, setPreviewType] = useState('INTERNE');
  const [previewSens, setPreviewSens] = useState('ENTRANT');
  const [preview, setPreview] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    numberingRequest<NumberingData>('settings', undefined, 'GET', controller.signal).then(setData).catch(e => { if (e.name !== 'AbortError') setMessage(e.message); });
    return () => controller.abort();
  }, []);
  const update = (patch: Partial<NumberingData['settings']>) => {
    setData(d => d ? { ...d, settings: { ...d.settings, ...patch } } : d); setSaved(false); setPreview('');
  };
  const ruleUpdate = (id: string, patch: Partial<NumberingRule>) => {
    if (data) update({ rules: data.settings.rules.map(r => r.id === id ? { ...r, ...patch } : r) });
  };
  const save = async () => {
    if (!data) return;
    setBusy(true); setMessage(''); setSaved(false);
    try {
      const result = await numberingRequest<NumberingData>('settings', { version: data.version, settings: data.settings,
        codes: data.entities.map(e => ({ id: e.id, code: e.code?.trim() || null })) }, 'PUT');
      setData(result); setSaved(true); setMessage('Configuration enregistrée. Elle s’applique uniquement aux nouveaux courriers.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  };
  const simulate = async () => {
    setBusy(true); setMessage('');
    try {
      const result = await numberingRequest<{ example?: string; rule?: string; enabled: boolean }>('preview', { entityId: previewEntity || null, type: previewType, sens: previewSens });
      setPreview(result.enabled ? `${result.example} — ${result.rule}. Exemple uniquement, aucun numéro réservé.` : 'Numérotation organisationnelle désactivée.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Simulation impossible.'); }
    finally { setBusy(false); }
  };
  if (!data) return <div className="rounded-xl bg-white p-6" role="status">{message || 'Chargement du paramétrage…'}</div>;
  return <section className="rounded-2xl bg-white p-6 shadow-sm space-y-6" aria-labelledby="numbering-title">
    <header><h2 id="numbering-title" className="text-xl font-semibold">Numérotation des courriers</h2>
      <p className="mt-2 text-sm text-slate-600">Le numéro système est attribué automatiquement et ne change jamais. Le numéro organisationnel suit vos règles. Les anciennes références restent inchangées.</p></header>
    <fieldset disabled={busy} className="space-y-6 disabled:opacity-70">
      <label className="flex gap-2 items-center"><input type="checkbox" checked={data.settings.enabled} onChange={e => update({ enabled: e.target.checked })} />Activer le numéro organisationnel pour les nouveaux courriers</label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>Code de l’organisation<input className={inputClass} value={data.settings.organisation} onChange={e => update({ organisation: e.target.value.toUpperCase() })} maxLength={40} /></label>
        <label>Fuseau horaire<input className={inputClass} value={data.settings.timezone} onChange={e => update({ timezone: e.target.value })} placeholder="Africa/Kinshasa" /></label>
      </div>
      <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">Codes administratifs de l’organigramme ({data.entities.length})</summary>
        <p className="my-3 text-sm text-slate-600">Codes uniques, en majuscules. Renseignez aussi les parents pour utiliser la variable chemin. Les codes ne sont pas déduits des noms.</p>
        {!data.entities.length && <p className="text-sm">Créez vos entités dans Directions et services avant d’utiliser des compteurs par entité. Un registre central reste possible.</p>}
        <div className="max-h-96 overflow-y-auto space-y-2">{data.entities.map(e => <label key={e.id} className="grid sm:grid-cols-2 gap-2 items-center text-sm">
          <span>{e.nom} <span className="text-slate-500">({e.type}){!e.actif && ' — inactive'}</span></span>
          <input className={inputClass} aria-label={`Code ${e.nom}`} value={e.code || ''} maxLength={40} onChange={event => {
            const code = event.target.value.toUpperCase(); setData(d => d ? { ...d, entities: d.entities.map(x => x.id === e.id ? { ...x, code } : x) } : d); setSaved(false);
          }} />
        </label>)}</div>
      </details>
      <div className="flex flex-wrap justify-between gap-3 items-center"><h3 className="font-semibold">Règles et registres</h3>
        <button className="rounded-lg border px-4 py-2 text-sm" type="button" onClick={() => update({ rules: [...data.settings.rules, { ...defaults, id: crypto.randomUUID() }] })}>Ajouter une règle</button></div>
      <p className="text-sm text-slate-600">L’entité choisie à la saisie détermine le registre. La règle de cette entité ou de son parent le plus proche est prioritaire, puis la règle centrale. À niveau égal, la première règle correspondante ci-dessous est utilisée. Un compteur est conservé même si sa règle est retirée.</p>
      {data.settings.rules.map((rule, index) => <fieldset key={rule.id} className="rounded-xl border border-slate-200 p-4 space-y-4">
        <legend className="px-2 font-medium">Règle {index + 1} — {rule.name}</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <label>Nom<input className={inputClass} value={rule.name} onChange={e => ruleUpdate(rule.id, { name: e.target.value })} /></label>
          <label>Niveau du compteur<select className={inputClass} value={rule.scopeType} onChange={e => ruleUpdate(rule.id, { scopeType: e.target.value, entityId: null })}>
            <option value="global">Organisation entière (central)</option>{Object.entries(data.types || {}).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select></label>
          {rule.scopeType !== 'global' && <label>Entité concernée<select className={inputClass} value={rule.entityId || ''} onChange={e => ruleUpdate(rule.id, { entityId: e.target.value || null })}>
            <option value="">Toutes les entités de ce niveau (compteurs distincts)</option>{data.entities.filter(e => e.type === rule.scopeType && e.actif).map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select></label>}
          <label>Type<select className={inputClass} value={rule.type} onChange={e => ruleUpdate(rule.id, { type: e.target.value as NumberingRule['type'] })}><option value="*">Tous</option><option value="INTERNE">Interne</option><option value="EXTERNE">Externe</option></select></label>
          <label>Sens<select className={inputClass} value={rule.sens} onChange={e => ruleUpdate(rule.id, { sens: e.target.value as NumberingRule['sens'] })}><option value="*">Tous</option><option value="ENTRANT">Entrant</option><option value="SORTANT">Sortant</option></select></label>
          <label>Remise à zéro<select className={inputClass} value={rule.period} onChange={e => ruleUpdate(rule.id, { period: e.target.value as NumberingRule['period'] })}><option value="year">Chaque année</option><option value="month">Chaque mois</option><option value="continuous">Jamais</option></select></label>
          <label>Chiffres minimum<input className={inputClass} type="number" min={1} max={12} value={rule.width} onChange={e => ruleUpdate(rule.id, { width: Number(e.target.value) })} /></label>
          <label>Valeur de départ minimale<input className={inputClass} type="number" min={1} max={1000000000} value={rule.start} onChange={e => ruleUpdate(rule.id, { start: Number(e.target.value) })} /><span className="text-xs text-slate-500">Ne remet jamais un compteur existant en arrière.</span></label>
        </div>
        <label className="block">Format<input className={inputClass} value={rule.format} onChange={e => ruleUpdate(rule.id, { format: e.target.value })} /></label>
        <p className="text-xs text-slate-500">Variables : {'{organisation} {code} {chemin} {annee} {mois} {type} {sens} {compteur}'}. Exemple direction : {'{organisation}/{code}/{annee}/{compteur}'}. Les numéros organisationnels doivent être uniques dans l’application.</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label><input type="checkbox" checked={rule.splitType} onChange={e => ruleUpdate(rule.id, { splitType: e.target.checked })} /> Compteurs distincts interne/externe</label>
          <label><input type="checkbox" checked={rule.splitSens} onChange={e => ruleUpdate(rule.id, { splitSens: e.target.checked })} /> Compteurs distincts entrant/sortant</label>
        </div>
        <div className="flex gap-4"><button type="button" disabled={index === 0} className="text-sm underline disabled:opacity-40" onClick={() => {
          const rules = [...data.settings.rules]; [rules[index - 1], rules[index]] = [rules[index], rules[index - 1]]; update({ rules });
        }}>Monter la priorité</button><button type="button" className="text-sm text-red-700 underline" onClick={() => update({ rules: data.settings.rules.filter(r => r.id !== rule.id) })}>Retirer la règle pour les futurs courriers</button></div>
      </fieldset>)}
      <button type="button" className="rounded-lg bg-indigo-600 px-5 py-2 text-white" onClick={save}>{busy ? 'Enregistrement…' : 'Enregistrer la configuration'}</button>
    </fieldset>
    {message && <p role={saved ? 'status' : 'alert'} className={`whitespace-pre-line rounded-lg p-3 ${saved ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{message}</p>}
    <div className="border-t pt-4 space-y-3"><h3 className="font-semibold">Simuler la configuration enregistrée</h3>
      <p className="text-sm text-slate-600">L’exemple utilise la valeur de départ, sans réserver ni prédire le prochain numéro.</p>
      <div className="grid sm:grid-cols-3 gap-3"><label>Entité<select className={inputClass} value={previewEntity} onChange={e => setPreviewEntity(e.target.value)}><option value="">Registre central</option>{data.entities.filter(e => e.actif).map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}</select></label>
        <label>Type<select className={inputClass} value={previewType} onChange={e => setPreviewType(e.target.value)}><option value="INTERNE">Interne</option><option value="EXTERNE">Externe</option></select></label>
        <label>Sens<select className={inputClass} value={previewSens} onChange={e => setPreviewSens(e.target.value)}><option value="ENTRANT">Entrant</option><option value="SORTANT">Sortant</option></select></label></div>
      <button type="button" disabled={busy} className="rounded-lg border px-4 py-2 disabled:opacity-50" onClick={simulate}>Simuler sans attribuer de numéro</button>
      {preview && <p role="status" className="rounded-lg bg-indigo-50 p-3 text-indigo-900">{preview}</p>}
    </div>
  </section>;
}
