import React, { useEffect, useState } from 'react';
import { Communications, profileRequest } from '../services/profileService';

export default function CommunicationSettingsPanel() {
  const [settings, setSettings] = useState<Communications | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [deliveries, setDeliveries] = useState<Array<{id:string;channel:string;status:string;title?:string;error?:string;created_at:string}>>([]);
  const [deliveryError, setDeliveryError] = useState('');
  const loadDeliveries = () => profileRequest<typeof deliveries>('communications/deliveries').then(value => {setDeliveries(value);setDeliveryError('');}).catch(() => setDeliveryError('Le journal ne peut pas être chargé.'));
  useEffect(() => { void loadDeliveries(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    profileRequest<Communications>('communications', undefined, 'GET', controller.signal).then(setSettings).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);
  const input = 'mt-1 w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500';
  const change = (section: keyof Communications, key: string, value: string | number | boolean) => {
    if (settings) setSettings({ ...settings, [section]: { ...settings[section], [key]: value } });
    setSuccess('');
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!settings || busy) return;
    setBusy(true); setError(''); setSuccess('');
    try { setSettings(await profileRequest<Communications>('communications', settings, 'PUT')); setSuccess('Paramètres enregistrés. Les secrets sont chiffrés et ne sont jamais renvoyés au navigateur.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-surface-200 bg-white p-5 sm:p-8 shadow-card">
    <h2 className="text-xl font-bold text-surface-900">Messagerie de l’organisation</h2>
    <p className="mt-2 text-sm text-surface-500">Administration · Compte ARMP et connexion Twilio pour les notifications.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-700 whitespace-pre-line">{error}</p>}
    {success && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-green-800">{success}</p>}
    {!settings ? <p className="mt-5">{error ? 'Impossible de charger les réglages.' : 'Chargement des réglages…'}</p> : <form onSubmit={save} className="mt-6 space-y-6">
      <fieldset disabled={busy} className="space-y-4">
        <legend className="font-bold text-surface-900">E-mail professionnel</legend>
        <label className="flex gap-2 items-center"><input type="checkbox" checked={settings.mail.enabled} onChange={e => change('mail', 'enabled', e.target.checked)} />Activer l’envoi d’e-mails</label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Serveur SMTP<input required className={input} value={settings.mail.host} onChange={e => change('mail', 'host', e.target.value)} /></label>
          <label className="text-sm">Connexion chiffrée<select className={input} value={settings.mail.port} onChange={e => { const port = Number(e.target.value); setSettings({ ...settings, mail: { ...settings.mail, port, encryption: port === 465 ? 'ssl' : 'tls' } }); }}><option value={465}>Port 465 · SSL/TLS</option><option value={587}>Port 587 · STARTTLS</option></select></label>
          <label className="text-sm">Identifiant<input required autoComplete="off" className={input} value={settings.mail.username} onChange={e => change('mail', 'username', e.target.value)} /></label>
          <label className="text-sm">Mot de passe du compte mail<input type="password" autoComplete="new-password" className={input} value={settings.mail.password} placeholder={settings.mail.hasSecret ? 'Déjà enregistré · laisser vide pour conserver' : 'À renseigner pour activer'} onChange={e => change('mail', 'password', e.target.value)} /></label>
          <label className="text-sm">Adresse d’expédition<input required type="email" className={input} value={settings.mail.fromAddress} onChange={e => change('mail', 'fromAddress', e.target.value)} /></label>
          <label className="text-sm">Nom de l’expéditeur<input className={input} value={settings.mail.fromName} onChange={e => change('mail', 'fromName', e.target.value)} /></label>
        </div>
        <p className="text-xs text-surface-500">Réception du compte : mail.armp-rdc.cd · IMAP 993 / POP3 995. Ces ports sont destinés à votre logiciel de messagerie. L’application utilise SMTP pour envoyer les notifications.</p>
      </fieldset>
      <fieldset disabled={busy} className="border-t border-surface-100 pt-5 space-y-4">
        <legend className="font-bold text-surface-900">SMS · Twilio</legend>
        <label className="block text-sm">Type d’identifiants<select className={input} value={settings.sms.mode} onChange={e => change('sms', 'mode', e.target.value)}><option value="test">Test · aucun envoi réel</option><option value="live">Live · envois réels</option></select></label>
        {settings.sms.mode === 'test' && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Identifiants de test enregistrés. Les SMS et WhatsApp ne peuvent pas être activés avec ces identifiants. Pour passer en Live, remplacez le SID et le jeton par ceux du compte Live.</p>}
        <label className="flex gap-2 items-center"><input type="checkbox" checked={settings.sms.enabled} onChange={e => change('sms', 'enabled', e.target.checked)} />Activer les SMS et la vérification des numéros</label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Account SID<input className={input} autoComplete="off" placeholder="AC…" value={settings.sms.sid || ''} onChange={e => change('sms', 'sid', e.target.value)} /></label>
          <label className="text-sm">Auth Token<input type="password" autoComplete="new-password" className={input} value={settings.sms.token} placeholder={settings.sms.hasSecret ? 'Déjà enregistré · laisser vide pour conserver' : 'Jeton privé Twilio'} onChange={e => change('sms', 'token', e.target.value)} /></label>
          <label className="text-sm">Numéro expéditeur SMS<input type="tel" className={input} placeholder="+243…" value={settings.sms.from || ''} onChange={e => change('sms', 'from', e.target.value)} /></label>
        </div>
      </fieldset>
      <fieldset disabled={busy} className="border-t border-surface-100 pt-5 space-y-4">
        <legend className="font-bold text-surface-900">WhatsApp · Twilio</legend>
        <label className="flex gap-2 items-center"><input type="checkbox" checked={settings.whatsapp.enabled} onChange={e => change('whatsapp', 'enabled', e.target.checked)} />Activer les notifications WhatsApp</label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Expéditeur WhatsApp autorisé<input type="tel" className={input} placeholder="+243…" value={settings.whatsapp.from || ''} onChange={e => change('whatsapp', 'from', e.target.value)} /></label>
          <label className="text-sm">Content SID du modèle approuvé<input className={input} placeholder="HX…" value={settings.whatsapp.contentSid || ''} onChange={e => change('whatsapp', 'contentSid', e.target.value)} /></label>
        </div>
        <p className="text-xs text-surface-500">Utilise le même compte Twilio. Créez un modèle approuvé avec les variables 1 = titre et 2 = message. Chaque utilisateur choisit de recevoir ces notifications sur son numéro vérifié.</p>
      </fieldset>
      <button disabled={busy} className="rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{busy ? 'Enregistrement…' : 'Enregistrer la messagerie'}</button>
    </form>}
    <div className="mt-8 border-t border-slate-100 pt-6"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900">Journal des communications</h3><button type="button" className="text-sm font-semibold text-blue-700 min-h-11" onClick={() => void loadDeliveries()}>Actualiser</button></div><p className="mt-2 text-xs text-slate-500">50 derniers envois. « Transmis » indique une acceptation par le service d’envoi, pas une preuve de réception.</p>{deliveryError && <p role="alert" className="mt-3 text-sm text-red-700">{deliveryError}</p>}{deliveries.length ? <div className="mt-4 overflow-x-auto"><table className="workspace-table"><caption className="sr-only">Journal des communications</caption><thead><tr><th>Date</th><th>Notification</th><th>Canal</th><th>État</th></tr></thead><tbody>{deliveries.map(row => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString('fr-CD')}</td><td>{row.title || 'Notification supprimée'}{row.error && <p className="mt-1 text-xs text-red-700">{row.error}</p>}</td><td>{row.channel}</td><td>{({queued:'En attente',sending:'En cours · à vérifier si prolongé',sent:'Transmis',skipped:'Non envoyé · préférences ou configuration',failed:'Échec · vérifier avant reprise'} as Record<string,string>)[row.status] || row.status}</td></tr>)}</tbody></table></div> : <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Aucun envoi enregistré pour le moment.</p>}</div>
  </section>;
}
