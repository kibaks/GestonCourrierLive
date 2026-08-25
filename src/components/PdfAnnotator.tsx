import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCommentDots,
  faMinus,
  faPlus,
  faFilePdf,
  faCircleNotch,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import type { Annotation } from '../types';
import { laravelApiService } from '../services/laravelApiService';

/**
 * PdfAnnotator — P1 « annotations sur le document » (style Word/PDF).
 *
 * Visionneuse PDF (pdfjs canvas + textLayer) avec :
 *  - sélection de texte → bouton flottant 💬 → commentaire + surlignage + épingle numérotée
 *  - panneau latéral « Commentaires » (auteur, décision, page, date)
 *  - navigation / zoom ; coordonnées normalisées 0..1000 (stables au zoom)
 *
 * Rétrocompatibilité : les annotations sans position restent affichées dans la Timeline du courrier.
 */

export interface PdfAnnotatorProps {
  courrierId: string;
  fichierId: string;
  fileUrl: string; // blob: URL du PDF
  fileName: string;
  initialPage?: number;
  annotations: Annotation[]; // toutes les annotations du courrier
  canAnnotate: boolean;
  resolveAuthorName: (userId: string) => string;
  onClose: () => void;
  onAnnotationCreated: (a: Annotation) => void;
}

interface PageDim {
  n: number;
  width: number;
  height: number;
}

interface PendingSelection {
  pageNum: number;
  pos: { x: number; y: number; w: number; h: number };
  left: number;
  top: number;
  text: string;
}

const DECISION_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  FAVORABLE: { label: 'Favorable', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' },
  A_REVOIR: { label: 'À revoir', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300' },
  INFO: { label: 'Info', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300' },
};

const PIN_COLOR: Record<string, string> = {
  FAVORABLE: 'bg-emerald-600',
  A_REVOIR: 'bg-amber-500',
  INFO: 'bg-blue-600',
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const PdfAnnotator: React.FC<PdfAnnotatorProps> = ({
  courrierId,
  fichierId,
  fileUrl,
  fileName,
  initialPage = 1,
  annotations,
  canAnnotate,
  resolveAuthorName,
  onClose,
  onAnnotationCreated,
}) => {
  const [scale, setScale] = useState(1.25);
  const [dims, setDims] = useState<PageDim[]>([]);
  const [loading, setLoading] = useState(true);
  const [renderedCount, setRenderedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [draftDecision, setDraftDecision] = useState<'' | 'FAVORABLE' | 'A_REVOIR' | 'INFO'>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [sessionExtras, setSessionExtras] = useState<Annotation[]>([]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const textRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const docRef = useRef<any>(null);
  const initialPageRef = useRef(initialPage);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // Annotations de CE fichier, ancrées (page + position), triées par création croissante.
  const fileAnnotations = useMemo(() => {
    const all = [...annotations, ...sessionExtras];
    const seen = new Set<string>();
    const uniq = all.filter((a) => {
      if (!a.fichierId || a.fichierId !== fichierId) return false;
      if (a.page == null || !a.position) return false;
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
    return uniq.sort((a, b) => new Date(a.dateCreation).getTime() - new Date(b.dateCreation).getTime());
  }, [annotations, sessionExtras, fichierId]);

  const scrollToPage = useCallback((n: number) => {
    const c = scrollRef.current;
    if (!c) return;
    const el = c.querySelector<HTMLElement>(`[data-page="${n}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(n);
    }
  }, []);

  // Chargement du document + dimensions des pages.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const pdfjs: any = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
        const doc = await pdfjs.getDocument({ url: fileUrl }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        docRef.current = doc;
        const pageDims: PageDim[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const vp = page.getViewport({ scale: 1.25 });
          pageDims.push({ n, width: vp.width, height: vp.height });
        }
        setDims(pageDims);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          console.error('[PdfAnnotator] Erreur chargement PDF:', e);
          setError(e?.message || 'Impossible de charger le document PDF.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      docRef.current?.destroy?.();
      docRef.current = null;
    };
  }, [fileUrl]);

  // Rendu des pages (canvas + textLayer) — re-lancé au changement de zoom.
  useEffect(() => {
    const doc = docRef.current;
    if (!doc || dims.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist');
        const count = Math.min(doc.numPages, 200);
        let rendered = 0;
        for (let n = 1; n <= count; n++) {
          if (cancelled) return;
          const canvas = canvasRefs.current[n];
          const textDiv = textRefs.current[n];
          if (!canvas || !textDiv) continue;
          const page = await doc.getPage(n);
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const cssViewport = page.getViewport({ scale });
          canvas.width = Math.floor(cssViewport.width * dpr);
          canvas.height = Math.floor(cssViewport.height * dpr);
          canvas.style.width = `${cssViewport.width}px`;
          canvas.style.height = `${cssViewport.height}px`;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          const renderTask = page.render({
            canvasContext: ctx,
            viewport: page.getViewport({ scale: scale * dpr }),
          });
          await renderTask.promise;
          if (cancelled) return;
          // Couche texte (sélection) — API pdfjs-dist 5.x : classe TextLayer
          const textContent = await page.getTextContent();
          textDiv.innerHTML = '';
          try {
            const textLayer = new pdfjs.TextLayer({
              textContentSource: textContent,
              container: textDiv,
              viewport: cssViewport,
            });
            await textLayer.render();
          } catch (e) {
            console.warn('[PdfAnnotator] Erreur textLayer:', e);
          }
          rendered += 1;
          setRenderedCount(rendered);
        }
        // Position initiale (page cible)
        if (initialPageRef.current > 1) {
          setTimeout(() => scrollToPage(initialPageRef.current), 150);
        }
      } catch (e) {
        console.error('[PdfAnnotator] Erreur rendu:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dims, scale, scrollToPage]);

  // Suivi de la page visible + Escape.
  useEffect(() => {
    const onScroll = () => {
      const c = scrollRef.current;
      if (!c) return;
      const top = c.getBoundingClientRect().top;
      let cur = 1;
      c.querySelectorAll<HTMLElement>('.pdf-ann-page').forEach((el) => {
        if (el.getBoundingClientRect().top - top < 140) {
          cur = Number(el.dataset.page) || cur;
        }
      });
      setCurrentPage((prev) => (prev === cur ? prev : cur));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const c = scrollRef.current;
    c?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      c?.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Détection de la sélection de texte (fin de souris).
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!canAnnotate) return;
    // Les clics sur l'UI (bouton « Commenter », boutons, champs) ne doivent pas effacer la sélection
    const t = e.target as HTMLElement | null;
    if (t && t.closest('button, a, input, textarea, select, aside')) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPending((p) => (p ? null : p));
        return;
      }
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const wrapper = (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement)
        ?.closest('.pdf-ann-page') as HTMLElement | null;
      if (!wrapper) {
        setPending((p) => (p ? null : p));
        return;
      }
      const rect = range.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      if (rect.width < 2 && rect.height < 2) {
        setPending(null);
        return;
      }
      const pageNum = Number(wrapper.dataset.page) || 1;
      const pos = {
        x: clamp(((rect.left - wrapperRect.left) / wrapperRect.width) * 1000, 0, 1000),
        y: clamp(((rect.top - wrapperRect.top) / wrapperRect.height) * 1000, 0, 1000),
        w: clamp(((rect.right - rect.left) / wrapperRect.width) * 1000, 15, 1000),
        h: clamp(((rect.bottom - rect.top) / wrapperRect.height) * 1000, 8, 1000),
      };
      setPending({
        pageNum,
        pos,
        left: clamp(rect.right - wrapperRect.left, 8, wrapperRect.width - 56),
        top: rect.bottom - wrapperRect.top + 6,
        text: sel.toString().replace(/\s+/g, ' ').slice(0, 220),
      });
      setSaveError(null);
    }, 10);
  }, [canAnnotate]);

  const openDraftFor = useCallback((p: PendingSelection) => {
    setPending(p);
    setDraftContent('');
    setDraftDecision('');
    setSaveError(null);
  }, []);

  const cancelDraft = useCallback(() => {
    setPending(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const saveComment = useCallback(async () => {
    if (!pending) return;
    if (!draftContent.trim()) {
      setSaveError('Le message est obligatoire.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const created = await laravelApiService.createAnnotation({
        courrierId,
        contenu: draftContent.trim(),
        type: 'COMMENTAIRE',
        fichierId,
        fichierNom: fileName,
        page: pending.pageNum,
        position: pending.pos,
        kind: 'COMMENTAIRE',
        decision: draftDecision === '' ? undefined : draftDecision,
      });
      setSessionExtras((prev) => [...prev, created]);
      setPending(null);
      window.getSelection()?.removeAllRanges();
      onAnnotationCreated(created);
    } catch (e: any) {
      setSaveError(e?.message || 'Échec de la sauvegarde du commentaire.');
    } finally {
      setSaving(false);
    }
  }, [pending, draftContent, draftDecision, courrierId, fichierId, fileName, onAnnotationCreated]);

  const focusAnnotation = useCallback(
    (a: Annotation) => {
      if (a.page) scrollToPage(a.page);
      setFocusedId(a.id);
      window.setTimeout(() => setFocusedId((f) => (f === a.id ? null : f)), 2000);
    },
    [scrollToPage]
  );

  const totalComments = fileAnnotations.length;

  return (
    <div className="flex flex-col h-full min-h-0 text-slate-800">
      <style>{`
        .pdf-ann-text { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; }
        .pdf-ann-text span { position: absolute; white-space: pre; pointer-events: auto; user-select: text; line-height: 1; }
        .pdf-ann-page { position: relative; }
      `}</style>

      {/* Barre d'outils */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <FontAwesomeIcon icon={faFilePdf} className="text-red-500" />
        <span className="text-sm font-semibold truncate max-w-[320px]" title={fileName}>{fileName}</span>
        {canAnnotate ? (
          <span className="hidden md:inline text-xs text-slate-400">
            Sélectionnez du texte avec la souris pour ajouter un commentaire
          </span>
        ) : (
          <span className="hidden md:inline text-xs text-slate-400">Lecture seule</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.6, +(s - 0.25).toFixed(2)))}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
            title="Zoom arrière"
          >
            <FontAwesomeIcon icon={faMinus} className="text-xs" />
          </button>
          <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)} %</span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2.5, +(s + 0.25).toFixed(2)))}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
            title="Zoom avant"
          >
            <FontAwesomeIcon icon={faPlus} className="text-xs" />
          </button>
          <span className="text-xs text-slate-500 border-l border-slate-200 pl-3">
            Page <b>{currentPage}</b> / {dims.length || '…'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            title="Fermer (Échap)"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Visionneuse */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto bg-slate-700/95"
          onMouseUp={handleMouseUp}
        >
          {loading && (
            <div className="flex items-center justify-center py-24 text-slate-200">
              <FontAwesomeIcon icon={faCircleNotch} spin className="mr-3" />
              Chargement du document…
            </div>
          )}
          {error && (
            <div className="max-w-lg mx-auto my-16 bg-white rounded-2xl shadow p-8 text-center">
              <FontAwesomeIcon icon={faFilePdf} className="text-4xl text-red-400 mb-3" />
              <p className="font-semibold text-slate-800">Impossible d'ouvrir le document</p>
              <p className="text-sm text-slate-500 mt-1">{error}</p>
              <button
                type="button"
                onClick={() => window.open(fileUrl, '_blank')}
                className="mt-4 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700"
              >
                Ouvrir dans un nouvel onglet
              </button>
            </div>
          )}
          {!loading && !error && dims.map((p) => (
            <div
              key={`${p.n}-${scale}`}
              data-page={p.n}
              className="pdf-ann-page mx-auto my-4 shadow-2xl bg-white"
              style={
                {
                  width: p.width,
                  height: p.height,
                  // Variables CSS requises par la couche texte pdfjs-dist 5.x
                  '--total-scale-factor': scale,
                  '--scale-round-x': '1px',
                  '--scale-round-y': '1px',
                } as React.CSSProperties
              }
            >
              <canvas
                ref={(c) => {
                  canvasRefs.current[p.n] = c;
                }}
                className="block"
              />
              <div
                ref={(d) => {
                  textRefs.current[p.n] = d;
                }}
                className="pdf-ann-text"
              />
              {/* Surlignages */}
              <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 pointer-events-none">
                {fileAnnotations.map((a) =>
                  a.position ? (
                    <rect
                      key={a.id}
                      x={a.position.x}
                      y={a.position.y}
                      width={a.position.w}
                      height={a.position.h}
                      rx={10}
                      fill={focusedId === a.id ? 'rgba(250, 204, 21, 0.5)' : 'rgba(250, 204, 21, 0.25)'}
                      stroke={a.decision === 'A_REVOIR' ? '#f59e0b' : a.decision === 'FAVORABLE' ? '#10b981' : a.decision === 'INFO' ? '#3b82f6' : '#f59e0b'}
                      strokeWidth={focusedId === a.id ? 4 : 1.5}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null
                )}
              </svg>
              {/* Épingles numérotées */}
              {fileAnnotations.map((a, i) =>
                a.position ? (
                  <button
                    key={a.id}
                    type="button"
                    className={`absolute z-20 w-6 h-6 -translate-x-1/2 -translate-y-full rounded-full text-white text-[11px] font-bold flex items-center justify-center shadow-lg hover:scale-125 transition-transform ${
                      PIN_COLOR[a.decision || ''] || 'bg-orange-500'
                    } ${focusedId === a.id ? 'ring-4 ring-yellow-300/70' : ''}`}
                    style={{ left: `${(a.position.x + a.position.w / 2) / 10}%`, top: `${a.position.y / 10}%` }}
                    title={`Commentaire ${i + 1} — ${resolveAuthorName(a.auteur)} : ${a.contenu.slice(0, 120)}`}
                    onMouseEnter={() => setFocusedId(a.id)}
                    onMouseLeave={() => setFocusedId(null)}
                    onClick={() => focusAnnotation(a)}
                  >
                    {i + 1}
                  </button>
                ) : null
              )}
              {/* Bouton flottant « Commenter » */}
              {canAnnotate && pending && pending.pageNum === p.n && (
                <button
                  type="button"
                  onClick={() => openDraftFor(pending)}
                  className="absolute z-30 flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xl"
                  style={{ left: pending.left, top: pending.top }}
                >
                  <FontAwesomeIcon icon={faCommentDots} className="text-xs" />
                  Commenter
                </button>
              )}
            </div>
          ))}
          {!loading && !error && renderedCount < dims.length && (
            <div className="text-center py-3 text-slate-300 text-xs">
              Rendu : {renderedCount}/{dims.length} pages…
            </div>
          )}
        </div>

        {/* Panneau Commentaires */}
        <aside className="w-80 shrink-0 bg-white border-l border-slate-200 flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
              <FontAwesomeIcon icon={faCommentDots} className="text-blue-600" />
              Commentaires
            </h3>
            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-semibold">
              {totalComments}
            </span>
          </div>

          {/* Formulaire du commentaire en cours */}
          {pending && canAnnotate && (
            <div className="m-3 p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">
                Page {pending.pageNum} — texte sélectionné :
              </p>
              <p className="text-xs text-slate-700 italic bg-white border border-slate-200 rounded-lg p-2 mb-2 line-clamp-3">
                « {pending.text} »
              </p>
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    saveComment();
                  }
                }}
                placeholder="Votre commentaire… (Ctrl+Entrée pour enregistrer)"
                rows={3}
                autoFocus
                className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="flex items-center gap-2 mt-2">
                <select
                  value={draftDecision}
                  onChange={(e) => setDraftDecision(e.target.value as '' | 'FAVORABLE' | 'A_REVOIR' | 'INFO')}
                  className="flex-1 text-xs border border-slate-300 rounded-lg p-1.5 bg-white"
                >
                  <option value="">Décision (optionnelle)</option>
                  <option value="FAVORABLE">✓ Favorable</option>
                  <option value="A_REVOIR">⚠ À revoir</option>
                  <option value="INFO">ℹ Info</option>
                </select>
                <button
                  type="button"
                  onClick={cancelDraft}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={saveComment}
                  disabled={saving || !draftContent.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '…' : 'Enregistrer'}
                </button>
              </div>
              {saveError && <p className="text-xs text-red-600 mt-2">{saveError}</p>}
            </div>
          )}

          {/* Liste */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {totalComments === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">
                Aucun commentaire sur ce document.
                {canAnnotate && ' Sélectionnez du texte pour en ajouter.'}
              </p>
            )}
            {fileAnnotations.map((a, i) => {
              const meta = a.decision ? DECISION_META[a.decision] : null;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => focusAnnotation(a)}
                  onMouseEnter={() => setFocusedId(a.id)}
                  onMouseLeave={() => setFocusedId(null)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    focusedId === a.id ? 'bg-yellow-50 border-yellow-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
                        PIN_COLOR[a.decision || ''] || 'bg-orange-500'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 truncate">
                      {resolveAuthorName(a.auteur)}
                    </span>
                    <span className="ml-auto text-[10px] text-slate-400">
                      {new Date(a.dateCreation).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 line-clamp-3">{a.contenu}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-mono">
                      p. {a.page}
                    </span>
                    {meta && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.bg} ${meta.color} ${meta.border}`}>
                        {meta.label}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PdfAnnotator;
