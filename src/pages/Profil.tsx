import PhoneField from '../components/PhoneField';
import ProfileSecurity from '../components/ProfileSecurity';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';
import { Channels, Profile, profileRequest } from '../services/profileService';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEnvelope, faShieldAlt, faCommentDots, faSave, faCamera, faPen, faBriefcase, faLocationDot, faPhone, faBuilding, faCircleCheck, faArrowRight } from '@fortawesome/free-solid-svg-icons';

const emptyChannels: Channels = { app: true, email: false, sms: false, whatsapp: false };
const fields = [
  ['nom', 'Nom complet', 'text'], ['jobTitle', 'Fonction', 'text'],
  ['professionalPhone', 'Téléphone professionnel', 'tel'], ['personalPhone', 'Téléphone personnel', 'tel'],
  ['city', 'Ville', 'text'], ['country', 'Pays', 'text'],
] as const;

export default function Profil() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState('apercu');
  const photoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    profileRequest<Profile>('profile', undefined, 'GET', controller.signal).then(p => { setProfile(p); setPhone(p.smsPhone || ''); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);
  const perform = async (operation: () => Promise<void>) => {
    if (busy) return; setBusy(true); setError(''); setSuccess('');
    try { await operation(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault(); if (!profile) return;
    void perform(async () => {
      const updated = await profileRequest<Profile>('profile', { ...profile, name: profile.nom }, 'PUT');
      setProfile(updated); refreshProfile(updated); setSuccess('Votre profil a été enregistré.');
    });
  };
  const upload = (file?: File, kind: 'photo' | 'cover' = 'photo') => {
    if (!file) return;
    const maxMo = kind === 'cover' ? 4 : 2;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > maxMo * 1024 * 1024) { setError(`Choisissez une image JPG, PNG ou WebP de ${maxMo} Mo maximum.`); return; }
    void perform(async () => { const data = new FormData(); data.append(kind, file); const updated = await profileRequest<Profile>(`profile/${kind}`, data); setProfile(updated); refreshProfile(updated); setSuccess(kind === 'cover' ? 'Couverture mise à jour.' : 'Photo mise à jour.'); });
  };
  const input = 'mt-2 w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500';
  const channels = profile?.notificationPreferences?.default || emptyChannels;
  const setChannel = (key: keyof Channels, value: boolean) => {
    if (!profile) return;
    const next = { ...channels, [key]: value };
    // Apply the displayed global choice to existing per-event preferences as well.
    const preferences = Object.fromEntries(Object.entries(profile.notificationPreferences || {}).map(([type, prefs]) => [type, { ...prefs, [key]: value }]));
    setProfile({ ...profile, notificationPreferences: { ...preferences, default: next } });
  };
  return <div className="mx-auto max-w-6xl space-y-5 pb-8">
    <input ref={photoInput} aria-label="Importer une photo de profil" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy} onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
    <input ref={coverInput} aria-label="Importer une couverture" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy} onChange={e => { upload(e.target.files?.[0], 'cover'); e.target.value = ''; }} />
    <header className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
      <div className="relative isolate h-36 overflow-hidden bg-slate-800 sm:h-52 lg:h-60">
        {profile?.coverUrl ? <img src={profile.coverUrl} alt="Couverture du profil" className="absolute inset-0 h-full w-full object-cover" /> : <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-gradient-to-br from-sky-800 via-sky-600 to-sky-300"><div className="absolute -right-20 -top-40 h-[32rem] w-[32rem] rounded-full border-[60px] border-white/5" /><div className="absolute -bottom-52 left-16 h-96 w-96 rotate-12 rounded-[5rem] border-[48px] border-sky-300/10" /><div className="absolute top-8 left-8 text-xs font-semibold uppercase tracking-[0.3em] text-blue-100/70">Votre espace professionnel</div></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        <button type="button" disabled={busy || !profile} onClick={() => coverInput.current?.click()} className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"><FontAwesomeIcon icon={faCamera} /><span className="hidden sm:inline">Modifier la couverture</span><span className="sm:hidden">Couverture</span></button>
      </div>
      <div className="px-5 sm:px-8">
        <div className="relative flex flex-col items-center gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:items-end sm:gap-5">
            <div className="relative -mt-12 shrink-0 sm:-mt-10">
              {profile?.photoUrl ? <img src={profile.photoUrl} alt="Photo de profil" className="h-36 w-36 rounded-full border-[5px] border-white bg-white object-cover sm:h-40 sm:w-40" /> : <div className="flex h-36 w-36 items-center justify-center rounded-full border-[5px] border-white bg-blue-100 text-6xl font-bold text-blue-700 sm:h-40 sm:w-40">{(profile?.nom || user?.nom || '?').slice(0, 1).toUpperCase()}</div>}
              <button type="button" aria-label="Modifier ma photo de profil" disabled={busy || !profile} onClick={() => photoInput.current?.click()} className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"><FontAwesomeIcon icon={faCamera} /></button>
            </div>
            <div className="min-w-0 pb-2 text-center sm:text-left"><h1 className="break-words text-3xl font-bold tracking-tight text-slate-900">{profile?.nom || user?.nom}</h1><p className="mt-1 text-sm text-slate-500">{profile?.jobTitle || 'Mon espace professionnel'}</p><span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700"><FontAwesomeIcon icon={faShieldAlt} />{user?.role?.replace(/_/g, ' ')}</span></div>
          </div>
          <button type="button" onClick={() => setTab('informations')} className="mb-2 inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><FontAwesomeIcon icon={faPen} />Modifier le profil</button>
        </div>
    <nav aria-label="Rubriques du profil" className="flex gap-1 overflow-x-auto border-t border-slate-200">
      {[
        ['apercu', 'Mon profil', faUser],
        ['informations', 'Informations', faUser], ['notifications', 'Notifications', faCommentDots], ['securite', 'Sécurité', faShieldAlt],
        ...(user?.role === Role.SUPER_ADMIN ? [['messagerie', 'Messagerie', faEnvelope] as const] : []),
      ].map(([key, title, icon]) => <button key={key as string} onClick={() => { if (key === 'messagerie') navigate('/parametres?onglet=communications'); else setTab(key as string); setSuccess(''); setError(''); }} aria-current={tab === key ? 'page' : undefined} className={`shrink-0 border-b-[3px] px-4 py-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}><FontAwesomeIcon icon={icon as typeof faUser} className="mr-2" />{title as string}</button>)}
    </nav>
      </div>
    </header>
    {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-700 whitespace-pre-line">{error}</div>}
    {success && <div role="status" className="rounded-xl border border-green-100 bg-green-50 p-4 text-green-800">{success}</div>}
    {!profile ? <p>{error ? 'Le profil n’a pas pu être chargé. Actualisez la page pour réessayer.' : 'Chargement du profil…'}</p> : <>
      {tab === 'apercu' && <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-900">Intro</h2><p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-slate-600">{profile.bio || 'Présentez votre rôle et votre parcours à votre organisation.'}</p><button onClick={() => setTab('informations')} className="mt-4 w-full rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">{profile.bio ? 'Modifier ma présentation' : 'Ajouter une présentation'}</button><ul className="mt-5 space-y-4 text-sm text-slate-600">{[
            [faBriefcase, profile.jobTitle || 'Fonction à renseigner'], [faBuilding, [profile.direction, profile.service].filter(Boolean).join(' · ') || 'Organisation à renseigner'], [faLocationDot, [profile.city, profile.country].filter(Boolean).join(', ') || 'Localisation à renseigner'],
          ].map(([icon, text], index) => <li key={index} className="flex items-start gap-3"><FontAwesomeIcon icon={icon as typeof faUser} className="mt-1 w-4 shrink-0 text-slate-400" /><span className="break-words">{text as string}</span></li>)}</ul></section>
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-slate-900">Coordonnées</h2><p className="mt-1 text-xs text-slate-500">Vos informations de contact personnelles</p><div className="mt-5 space-y-4 text-sm"><p className="flex items-start gap-3"><FontAwesomeIcon icon={faEnvelope} className="mt-1 text-slate-400" /><span className="break-all text-slate-600">{profile.email}</span></p><p className="flex items-start gap-3"><FontAwesomeIcon icon={faPhone} className="mt-1 text-slate-400" /><span className="text-slate-600">{profile.professionalPhone || 'Téléphone à renseigner'}</span></p></div></section>
        </aside>
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">À propos de moi</h2><p className="mt-1 text-sm text-slate-500">Votre identité au sein de l’organisation</p></div><button aria-label="Modifier mes informations" onClick={() => setTab('informations')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><FontAwesomeIcon icon={faPen} /></button></div><dl className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">{[['Nom complet', profile.nom], ['Fonction', profile.jobTitle], ['Direction', profile.direction], ['Service', profile.service], ['Ville', profile.city], ['Pays', profile.country]].map(([label, value]) => <div key={label}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className={`mt-1 break-words text-sm ${value ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>{value || 'Non renseigné'}</dd></div>)}</dl></section>
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-900">Restons en contact</h2><p className="mt-2 text-sm leading-6 text-slate-500">Retrouvez vos alertes de courrier sur les canaux qui vous conviennent.</p><div className="mt-5 grid grid-cols-3 gap-2">{([['email', 'E-mail', faEnvelope], ['sms', 'SMS', faCommentDots], ['whatsapp', 'WhatsApp', faPhone]] as const).map(([key, title, icon]) => <div key={key} className={`rounded-xl border p-3 text-center ${channels[key] ? 'border-blue-100 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}><FontAwesomeIcon icon={icon} className={channels[key] ? 'text-blue-600' : 'text-slate-400'} /><p className="mt-2 text-xs font-semibold text-slate-700">{title}</p><p className="mt-1 text-[11px] text-slate-500">{channels[key] ? 'Choisi' : 'Non choisi'}</p></div>)}</div><button onClick={() => setTab('notifications')} className="mt-5 flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800">Gérer mes notifications<FontAwesomeIcon icon={faArrowRight} /></button></section>
          <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4"><FontAwesomeIcon icon={faCircleCheck} className="text-blue-600" /><p className="text-xs leading-5 text-blue-900">Cet espace est personnel. Votre rôle et votre affectation sont gérés par l’administrateur.</p></div>
        </div>
      </div>}
      {tab === 'informations' && <form onSubmit={save} className="rounded-2xl border border-surface-200 bg-white p-5 sm:p-8 shadow-card">
        <h2 className="text-xl font-bold text-surface-900">Informations personnelles</h2><p className="mt-2 text-sm text-surface-500">Vos coordonnées et votre fonction dans l’organisation.</p>
        <fieldset disabled={busy} className="mt-6 space-y-5">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-surface-200 px-4 py-3 text-sm font-semibold hover:bg-surface-50"><FontAwesomeIcon icon={faCamera} />Changer ma photo<input aria-label="Choisir une photo de profil" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="max-w-48 text-xs" onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} /></label>
          <div className="grid gap-5 sm:grid-cols-2">{fields.map(([key, label, type]) => <label key={key} className="text-sm font-medium text-surface-700">{label}{type === 'tel' ? <PhoneField className={input} value={profile[key] || ''} onValueChange={value => setProfile({ ...profile, [key]: value })} /> : <input required={key === 'nom'} maxLength={key === 'nom' ? 255 : key.includes('Phone') ? 32 : key === 'jobTitle' ? 150 : 100} type={type} className={input} value={profile[key] || ''} onChange={e => setProfile({ ...profile, [key]: e.target.value })} />}</label>)}</div>
          <label className="block text-sm font-medium text-surface-700">Adresse<input maxLength={255} className={input} value={profile.address || ''} onChange={e => setProfile({ ...profile, address: e.target.value })} /></label>
          <label className="block text-sm font-medium text-surface-700">Présentation<textarea rows={3} maxLength={1000} className={input} value={profile.bio || ''} onChange={e => setProfile({ ...profile, bio: e.target.value })} /></label>
          <button className="rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-50"><FontAwesomeIcon icon={faSave} className="mr-2" />{busy ? 'Enregistrement…' : 'Enregistrer mon profil'}</button>
        </fieldset>
      </form>}
      {tab === 'notifications' && <section className="rounded-2xl border border-surface-200 bg-white p-5 sm:p-8 shadow-card">
        <h2 className="text-xl font-bold text-surface-900">Comment souhaitez-vous être informé ?</h2><p className="mt-2 text-sm text-surface-500">Choisissez vos canaux pour les nouvelles notifications de courrier, de tâches et de workflow.</p>
        <form onSubmit={save} className="mt-6 space-y-5"><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          {([['email', 'E-mail', 'À votre adresse de connexion'], ['sms', 'SMS', 'Sur votre numéro vérifié'], ['whatsapp', 'WhatsApp', 'Sur le même numéro vérifié']] as const).map(([key, title, description]) => <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-surface-200 p-4"><input type="checkbox" checked={!!channels[key]} onChange={e => setChannel(key, e.target.checked)} className="h-4 w-4" /><span><span className="block font-semibold text-surface-900">{title}</span><span className="text-xs text-surface-500">{description}</span></span></label>)}
          <div className="rounded-xl bg-surface-50 p-4 text-sm text-surface-600">Les notifications restent disponibles dans l’application.</div>
        </fieldset><p className="text-sm text-surface-500">En cochant SMS ou WhatsApp, vous acceptez de recevoir les notifications sur votre numéro. L’administrateur doit activer les services correspondants.</p>
          <button disabled={busy} className="rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Enregistrement…' : 'Enregistrer mes préférences'}</button>
        </form>
        <div className="mt-8 border-t border-surface-100 pt-6"><h3 className="font-bold text-surface-900">Numéro SMS et WhatsApp</h3><p className="mt-2 text-sm text-surface-500">{profile.smsVerified ? `Numéro vérifié : ${profile.smsPhone}` : 'Vérifiez votre numéro par SMS avant de recevoir des notifications SMS ou WhatsApp.'}</p>
          <form onSubmit={e => { e.preventDefault(); void perform(async () => { await profileRequest('profile/sms-verification', { phone }); setCodeSent(true); setCode(''); setSuccess('Code envoyé. Il expire dans 10 minutes.'); }); }} className="mt-4 flex flex-wrap items-end gap-3"><label className="flex-1 text-sm min-w-48">Numéro au format international<PhoneField required pattern="\+[1-9][0-9 ]{7,20}" className={input} value={phone} onValueChange={value => { setPhone(value); setCodeSent(false); }} /></label><button disabled={busy} className="rounded-xl border border-primary-200 px-4 py-3 font-semibold text-primary-700 disabled:opacity-50">Envoyer un code SMS</button></form>
          {codeSent && <form onSubmit={e => { e.preventDefault(); void perform(async () => { const updated = await profileRequest<Profile>('profile/sms-verification/confirm', { code }); setProfile(updated); setCodeSent(false); setCode(''); setSuccess('Numéro vérifié.'); }); }} className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm">Code reçu<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} className={input} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label><button disabled={busy} className="rounded-xl bg-primary-600 px-4 py-3 text-white">Vérifier le numéro</button></form>}
        </div>
      </section>}
      {tab === 'securite' && <ProfileSecurity profile={profile} onChange={setProfile} />}
    </>}
  </div>;
}
