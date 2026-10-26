import React, { useEffect, useState } from 'react';
import { numberingRequest, NumberingData } from '../services/numberingService';

export default function CourrierNumberingFields({ value, onChange, existing }: {
  value: string; onChange: (id: string) => void;
  existing?: { numero: string; numeroOrganisationnel?: string | null };
}) {
  const [data, setData] = useState<NumberingData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (existing) return;
    const controller = new AbortController();
    numberingRequest<NumberingData>('options', undefined, 'GET', controller.signal).then(setData).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [existing]);
  return <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-2">
    <h3 className="font-semibold text-slate-800">Références du courrier</h3>
    <p className="text-sm text-slate-600">N° système : {existing?.numero || 'attribué automatiquement à l’enregistrement'}</p>
    {existing ? <p className="text-sm text-slate-600">N° organisationnel : {existing.numeroOrganisationnel || 'non attribué (courrier historique)'}</p>
      : data?.settings.enabled ? <label className="block text-sm font-medium">Entité du registre organisationnel
        <select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2" value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Registre central (si une règle le permet)</option>{data.entities.map(e => <option key={e.id} value={e.id}>{e.nom}{e.code ? ` — ${e.code}` : ''}</option>)}
        </select><span className="mt-1 block text-xs text-slate-500">Le numéro suit le paramétrage administrateur et sera attribué lors de l’enregistrement. Pour une saisie en liste, cette entité s’applique aux lignes du lot.</span>
      </label> : data && <p className="text-sm text-slate-500">N° organisationnel : en attente d’activation par l’administrateur.</p>}
    {error && <p role="alert" className="text-sm text-red-700">Impossible de charger les règles : {error}</p>}
  </section>;
}
