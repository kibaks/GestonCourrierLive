import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCommentDots,
  faMinus,
  faPlus,
  faFilePdf,
  faCircleNotch,
  faXmark,
  faPen,
  faPenFancy,
  faFont,
  faStamp,
  faReply,
  faDownload,
  faTrash,
  faCheck,
  faCircleCheck,
  faRotateLeft,
  faEraser,
} from '@fortawesome/free-solid-svg-icons';
import type { Annotation } from '../types';
import { laravelApiService } from '../services/laravelApiService';

/**
 * PdfAnnotator — annotations sur le document (PDF, style Word/PDF).
 *
 * P1 : sélection de texte → 💬 commentaire + surlignage + épingle numérotée ;
 *      panneau latéral « Commentaires » ; Timeline du courrier (côté DetailCourrier).
 * P2 : le « stylo du DG » — encre (TRACE), boîte de texte (TEXTE), tampons
 *      Favorable / À revoir (TAMPOUR), signature tracée ou réutilisable (SIGNATURE),
 *      fils de réponse (parentId), gestion Résolu / suppression, export « PDF annoté ».
 *
 * Coordonnées normalisées 0..1000 (indépendantes du zoom) ; pdfjs-dist 5.x.
 * Rétrocompatibilité : les annotations sans position restent affichées dans la Timeline.
 */

type Tool = 'COMMENTER' | 'ENCRE' | 'TEXTE' | 'TAMPON' | 'SIGNATURE';

// P5 — images (JPG/PNG) : la visionneuse pdfjs n'accepte que du PDF.
// Une image est enveloppée à la volée dans un PDF 1 page (jsPDF) pour réutiliser
// la visionneuse, les 5 outils et l'export, sans modifier le fichier d'origine.
export const isAnnotableImageName = (name: string): boolean =>
  /\.(jpe?g|png)$/i.test(name || '');

export const wrapImageAsPdfUrl = async (imageUrl: string): Promise<string> => {
  const { jsPDF } = await import('jspdf');
  const blob = await fetch(imageUrl).then((r) => {
    if (!r.ok) throw new Error('Téléchargement de l’image impossible (HTTP ' + r.status + ')');
    return r.blob();
  });
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error('Lecture de l’image impossible'));
    fr.readAsDataURL(blob);
  });
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Image illisible'));
    el.src = dataUrl;
  });
  const w = img.naturalWidth || 1;
  const h = img.naturalHeight || 1;
  const pdf = new jsPDF({
    orientation: w > h ? 'landscape' : 'portrait',
    unit: 'px',
    format: [w, h],
    compress: true,
  });
  pdf.addImage(dataUrl, blob.type === 'image/png' ? 'PNG' : 'JPEG', 0, 0, w, h);
  return pdf.output('bloburl') as unknown as string;
};

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

interface DraftPoint {
  pageNum: number;
  pos: { x: number; y: number };
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

const INK_COLORS: { hex: string; label: string; cls: string }[] = [
  { hex: '#dc2626', label: 'rouge', cls: 'bg-red-600' },
  { hex: '#1e293b', label: 'noir', cls: 'bg-slate-800' },
  { hex: '#1d4ed8', label: 'bleu', cls: 'bg-blue-700' },
];

const STAMPS: { label: string; hex: string; cls: string; text: string }[] = [
  { label: 'FAVORABLE', hex: '#059669', cls: 'text-emerald-700 border-emerald-600', text: 'FAVORABLE' },
  { label: 'A_REVOIR', hex: '#d97706', cls: 'text-amber-700 border-amber-600', text: 'À REVOIR' },
];

const KIND_META: Record<string, { label: string; icon: typeof faPen }> = {
  COMMENTAIRE: { label: 'Commentaire', icon: faCommentDots },
  TRACE: { label: 'Encre', icon: faPen },
  TEXTE: { label: 'Texte', icon: faFont },
  TAMPOUR: { label: 'Tampon', icon: faStamp },
  SIGNATURE: { label: 'Signature', icon: faPenFancy },
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 0.86, g: 0.15, b: 0.15 };
  return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 };
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur ? cur + ' ' : '') + w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 12);
}

export interface PdfAnnotatorProps {
  courrierId: string;
  fichierId: string;
  fileUrl: string; // blob: URL du PDF
  fileName: string;
  initialPage?: number;
  annotations: Annotation[]; // toutes les annotations du courrier
  canAnnotate: boolean;
  canManageAnnotation?: (a: Annotation) => boolean; // P2 : auteur ou DG/SUPER_ADMIN
  resolveAuthorName: (userId: string) => string;
  onClose: () => void;
  onAnnotationCreated: (a: Annotation) => void;
}

const PdfAnnotator: React.FC<PdfAnnotatorProps> = ({
  courrierId,
  fichierId,
  fileUrl,
  fileName,
  initialPage = 1,
  annotations,
  canAnnotate,
  canManageAnnotation,
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
  const [draftOpen, setDraftOpen] = useState(false); // P6 : formulaire flottant ouvert (sticky, en avant-plan)
  const [draftContent, setDraftContent] = useState('');
  const [draftDecision, setDraftDecision] = useState<'' | 'FAVORABLE' | 'A_REVOIR' | 'INFO'>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [sessionExtras, setSessionExtras] = useState<Annotation[]>([]);

  // ——— P2 : outils du « stylo du DG » ———
  const [tool, setTool] = useState<Tool>('COMMENTER');
  const [inkColor, setInkColor] = useState(INK_COLORS[0].hex);
  const [stampLabel, setStampLabel] = useState('FAVORABLE');
  const [drawingPoints, setDrawingPoints] = useState<number[][] | null>(null);
  const [drawingPage, setDrawingPage] = useState<number | null>(null);
  const [textDraft, setTextDraft] = useState<DraftPoint | null>(null);
  const [textValue, setTextValue] = useState('');
  const [signDraft, setSignDraft] = useState<DraftPoint | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const lastSigRef = useRef<string | null>(null);
  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const signDrawingRef = useRef(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const textRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const docRef = useRef<any>(null);
  const initialPageRef = useRef(initialPage);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const drawingRef = useRef<{ pageNum: number; points: number[][] } | null>(null);

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

  // Numéro d'épingle stable (index dans la liste triée) — partagé document/panneau.
  const numberMap = useMemo(() => {
    const m = new Map<string, number>();
    fileAnnotations.forEach((a, i) => m.set(a.id, i + 1));
    return m;
  }, [fileAnnotations]);

  // P2 : fils de réponse (réponses = annotations avec parentId).
  const topLevelAnnotations = useMemo(() => fileAnnotations.filter((a) => !a.parentId), [fileAnnotations]);
  const repliesOf = useCallback((id: string) => fileAnnotations.filter((a) => a.parentId === id), [fileAnnotations]);

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
        // P5 : image (JPG/PNG) → enveloppée dans un PDF 1 page avant rendu
        let url = fileUrl;
        if (isAnnotableImageName(fileName)) {
          url = await wrapImageAsPdfUrl(fileUrl);
        }
        const doc = await pdfjs.getDocument({ url }).promise;
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

  // Signature réutilisable (localStorage, un seul poste à la fois = OK).
  useEffect(() => {
    try {
      lastSigRef.current = localStorage.getItem('sigc_derniere_signature');
    } catch {
      lastSigRef.current = null;
    }
  }, []);

  // Canvas du pavé de signature : préparation au clic « Signature ».
  useEffect(() => {
    if (!signDraft) return;
    const c = signCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [signDraft]);

  // Suivi de la page visible + Escape (annule d'abord les brouillons en cours).
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
      if (e.key !== 'Escape') return;
      if (textDraft) {
        setTextDraft(null);
        return;
      }
      if (signDraft) {
        setSignDraft(null);
        return;
      }
      if (draftOpen) {
        setDraftOpen(false);
        return;
      }
      if (pending) {
        cancelDraft();
        return;
      }
      onClose();
    };
    const c = scrollRef.current;
    c?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      c?.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, textDraft, signDraft, pending, draftOpen]);

  // Détection de la sélection de texte (fin de souris) — outil « Commenter » uniquement.
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!canAnnotate || tool !== 'COMMENTER') return;
      // Les clics sur l'UI (bouton « Commenter », boutons, champs) ne doivent pas effacer la sélection
      const t = e.target as HTMLElement | null;
      if (t && t.closest('button, a, input, textarea, select, aside')) return;
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          // P6 : formulaire ouvert → STICKY (il ne disparaît pas quand on clique sur le document)
          if (draftOpen) return;
          setPending(null);
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
    },
    [canAnnotate, tool, draftOpen]
  );

  const openDraftFor = useCallback((p: PendingSelection) => {
    setPending(p);
    setDraftOpen(true);
    setDraftContent('');
    setDraftDecision('');
    setSaveError(null);
  }, []);

  const cancelDraft = useCallback(() => {
    setPending(null);
    setDraftOpen(false);
    window.getSelection()?.removeAllRanges();
  }, []);

  // ——— P2 : coordonnées normalisées 0..1000 depuis un événement pointeur ———
  const normalizedFromEvent = (e: React.PointerEvent, pageNum: number) => {
    const wrapper = (e.target as HTMLElement).closest('.pdf-ann-page') as HTMLElement | null;
    if (!wrapper) return null;
    const rect = wrapper.getBoundingClientRect();
    return {
      pageNum,
      x: round1(clamp(((e.clientX - rect.left) / rect.width) * 1000, 0, 1000)),
      y: round1(clamp(((e.clientY - rect.top) / rect.height) * 1000, 0, 1000)),
    };
  };

  const commitAnnotation = async (partial: {
    contenu: string;
    kind: 'COMMENTAIRE' | 'TRACE' | 'TEXTE' | 'TAMPOUR' | 'SIGNATURE';
    page: number;
    position: NonNullable<Annotation['position']>;
    decision?: 'FAVORABLE' | 'A_REVOIR' | 'INFO';
    parentId?: string;
  }) => {
    const created = await laravelApiService.createAnnotation({
      courrierId,
      contenu: partial.contenu,
      type: 'COMMENTAIRE',
      fichierId,
      fichierNom: fileName,
      page: partial.page,
      position: partial.position,
      kind: partial.kind,
      decision: partial.decision,
      parentId: partial.parentId,
    });
    setSessionExtras((prev) => [...prev, created]);
    onAnnotationCreated(created);
    return created;
  };

  // ——— P2 : encre (TRACE) ———
  const handleInkDown = (e: React.PointerEvent, pageNum: number) => {
    if (!canAnnotate || tool !== 'ENCRE') return;
    const p = normalizedFromEvent(e, pageNum);
    if (!p) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drawingRef.current = { pageNum, points: [[p.x, p.y]] };
    setDrawingPage(pageNum);
    setDrawingPoints(drawingRef.current.points);
  };

  const handleInkMove = (e: React.PointerEvent, pageNum: number) => {
    const d = drawingRef.current;
    if (!d || d.pageNum !== pageNum) return;
    const p = normalizedFromEvent(e, pageNum);
    if (!p) return;
    const last = d.points[d.points.length - 1];
    if (Math.abs(p.x - last[0]) < 0.8 && Math.abs(p.y - last[1]) < 0.8) return;
    d.points.push([p.x, p.y]);
    setDrawingPoints([...d.points]);
  };

  const finishInk = async () => {
    const d = drawingRef.current;
    drawingRef.current = null;
    setDrawingPoints(null);
    setDrawingPage(null);
    if (!d || d.points.length < 2) return;
    setSaving(true);
    setActionError(null);
    try {
      const xs = d.points.map((p) => p[0]);
      const ys = d.points.map((p) => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      const colorMeta = INK_COLORS.find((c) => c.hex === inkColor) || INK_COLORS[0];
      await commitAnnotation({
        contenu: `Tracé encre (${colorMeta.label})`,
        kind: 'TRACE',
        page: d.pageNum,
        position: {
          x: round1(minX),
          y: round1(minY),
          w: round1(Math.max(maxX - minX, 15)),
          h: round1(Math.max(maxY - minY, 8)),
          points: d.points,
          color: inkColor,
        },
      });
    } catch (e: any) {
      setActionError(e?.message || 'Échec de la sauvegarde du tracé.');
    } finally {
      setSaving(false);
    }
  };

  // ——— P2 : boîte de texte (TEXTE) ———
  const handleTextDown = (e: React.PointerEvent, pageNum: number) => {
    if (!canAnnotate || tool !== 'TEXTE') return;
    const p = normalizedFromEvent(e, pageNum);
    if (!p) return;
    setTextDraft({ pageNum, pos: { x: clamp(p.x, 0, 920), y: clamp(p.y, 0, 950) } });
    setTextValue('');
    setActionError(null);
  };

  const saveTextBox = async () => {
    if (!textDraft || !textValue.trim()) return;
    const { pageNum, pos } = textDraft;
    setSaving(true);
    setActionError(null);
    try {
      await commitAnnotation({
        contenu: textValue.trim(),
        kind: 'TEXTE',
        page: pageNum,
        position: { x: pos.x, y: pos.y, w: 300, h: 90, text: textValue.trim() },
      });
      setTextDraft(null);
    } catch (e: any) {
      setActionError(e?.message || 'Échec de la sauvegarde du texte.');
    } finally {
      setSaving(false);
    }
  };

  // ——— P2 : tampon (TAMPOUR) ———
  const handleStampDown = (e: React.PointerEvent, pageNum: number) => {
    if (!canAnnotate || tool !== 'TAMPON') return;
    const p = normalizedFromEvent(e, pageNum);
    if (!p) return;
    const meta = STAMPS.find((s) => s.label === stampLabel) || STAMPS[0];
    setSaving(true);
    setActionError(null);
    commitAnnotation({
      contenu: `Tampon « ${meta.text} »`,
      kind: 'TAMPOUR',
      page: pageNum,
      position: {
        x: round1(clamp(p.x - 130, 0, 1000 - 260)),
        y: round1(clamp(p.y - 55, 0, 1000 - 110)),
        w: 260,
        h: 110,
        label: meta.label,
        rotation: -8,
      },
    })
      .catch((e: any) => setActionError(e?.message || 'Échec de la pose du tampon.'))
      .finally(() => setSaving(false));
  };

  // ——— P2 : signature (SIGNATURE — pavé tracé ou réutilisable) ———
  const handleSignDown = (e: React.PointerEvent, pageNum: number) => {
    if (!canAnnotate || tool !== 'SIGNATURE') return;
    const p = normalizedFromEvent(e, pageNum);
    if (!p) return;
    setSignDraft({ pageNum, pos: { x: round1(clamp(p.x - 150, 0, 1000 - 300)), y: round1(clamp(p.y - 65, 0, 1000 - 130)) } });
    setActionError(null);
  };

  const signCanvasPointer = (e: React.PointerEvent, down: boolean) => {
    const c = signCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const rect = c.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * c.width;
    const y = ((e.clientY - rect.top) / rect.height) * c.height;
    if (down) {
      signDrawingRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (signDrawingRef.current) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const signClear = () => {
    const c = signCanvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
  };

  const signReuseLast = () => {
    const c = signCanvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !lastSigRef.current) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
    };
    img.src = lastSigRef.current;
  };

  const saveSignature = async () => {
    const c = signCanvasRef.current;
    if (!c || !signDraft) return;
    const dataUrl = c.toDataURL('image/png');
    setSaving(true);
    setActionError(null);
    try {
      await commitAnnotation({
        contenu: 'Signature',
        kind: 'SIGNATURE',
        page: signDraft.pageNum,
        position: { x: signDraft.pos.x, y: signDraft.pos.y, w: 300, h: 130, image: dataUrl },
      });
      try {
        if (dataUrl.length < 300000) {
          localStorage.setItem('sigc_derniere_signature', dataUrl);
          lastSigRef.current = dataUrl;
        }
      } catch {
        /* stockage local indisponible — signature unique */
      }
      setSignDraft(null);
    } catch (e: any) {
      setActionError(e?.message || 'Échec de la sauvegarde de la signature.');
    } finally {
      setSaving(false);
    }
  };

  // ——— P2 : fils de réponse, statut, suppression ———
  const saveReply = async (parent: Annotation) => {
    if (!replyText.trim()) return;
    setSaving(true);
    setActionError(null);
    try {
      await commitAnnotation({
        contenu: replyText.trim(),
        kind: 'COMMENTAIRE',
        page: parent.page || 1,
        position: { x: 0, y: 0, w: 0, h: 0 },
        parentId: parent.id,
      });
      setReplyTo(null);
      setReplyText('');
    } catch (e: any) {
      setActionError(e?.message || 'Échec de l’enregistrement de la réponse.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatut = async (a: Annotation) => {
    const next = a.statut === 'RESOLU' ? 'OUVERT' : 'RESOLU';
    setSaving(true);
    setActionError(null);
    try {
      await laravelApiService.updateAnnotation(a.id, { statut: next });
      onAnnotationCreated({ ...a, statut: next }); // rafraîchit la liste côté parent
    } catch (e: any) {
      setActionError(e?.message || 'Échec de la mise à jour du statut.');
    } finally {
      setSaving(false);
    }
  };

  // P3b — marquage « Résolu » en masse (annotations principales ouvertes que l'on peut gérer)
  const openTopAnnotations = fileAnnotations.filter(
    (a) =>
      (a.statut ?? 'OUVERT') !== 'RESOLU' &&
      !(a.parentId ?? null) &&
      (canManageAnnotation ? canManageAnnotation(a) : true)
  );
  const resolveAll = async () => {
    if (openTopAnnotations.length === 0) return;
    setSaving(true);
    setActionError(null);
    let ok = 0;
    for (const a of openTopAnnotations) {
      try {
        await laravelApiService.updateAnnotation(a.id, { statut: 'RESOLU' });
        onAnnotationCreated({ ...a, statut: 'RESOLU' });
        ok++;
      } catch (e: any) {
        setActionError(`${ok}/${openTopAnnotations.length} marquées résolu — ${e?.message || 'erreur'}`);
        break;
      }
    }
    setSaving(false);
  };

  const removeAnnotation = async (a: Annotation) => {
    setSaving(true);
    setActionError(null);
    try {
      await laravelApiService.deleteAnnotation(a.id);
      setSessionExtras((prev) => prev.filter((x) => x.id !== a.id));
      onAnnotationCreated(a); // déclenche le rechargement de la liste chez le parent
    } catch (e: any) {
      setActionError(e?.message || 'Échec de la suppression.');
    } finally {
      setSaving(false);
      setConfirmDeleteId(null);
    }
  };

  // ——— P2 : export « PDF annoté » (pdf-lib) ———
  const exportAnnotatedPdf = async () => {
    if (exporting) return;
    setExporting(true);
    setActionError(null);
    try {
      const pdfLib: any = await import('pdf-lib');
      // P5 : pour une image, on charge le PDF enveloppé (et non le fichier image brut)
      let bytes: ArrayBuffer;
      if (isAnnotableImageName(fileName)) {
        const wrappedUrl = await wrapImageAsPdfUrl(fileUrl);
        bytes = await fetch(wrappedUrl).then((r) => r.arrayBuffer());
      } else {
        bytes = await fetch(fileUrl).then((r) => r.arrayBuffer());
      }
      const doc = await pdfLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      const helv = await doc.embedFont(pdfLib.StandardFonts.Helvetica);
      const helvBold = await doc.embedFont(pdfLib.StandardFonts.HelveticaBold);
      const rgb = pdfLib.rgb;
      const degrees = pdfLib.degrees;

      for (const a of fileAnnotations) {
        if (a.page == null || !a.position) continue;
        let page: any;
        try {
          page = doc.getPage(a.page - 1);
        } catch {
          continue;
        }
        const W = page.getWidth();
        const H = page.getHeight();
        const x0 = (a.position.x / 1000) * W;
        const y0 = H - ((a.position.y + a.position.h) / 1000) * H;
        const w = (a.position.w / 1000) * W;
        const h = (a.position.h / 1000) * H;
        const kind = a.kind || 'COMMENTAIRE';

        if (kind === 'COMMENTAIRE') {
          page.drawRectangle({ x: x0, y: y0, width: w, height: h, color: rgb(1, 0.8, 0.2), opacity: 0.3 });
          const col = a.decision === 'FAVORABLE' ? rgb(0.06, 0.73, 0.51) : a.decision === 'INFO' ? rgb(0.23, 0.51, 0.97) : rgb(0.96, 0.62, 0.04);
          page.drawLine({ start: { x: x0, y: y0 + h }, end: { x: x0 + w, y: y0 + h }, thickness: 1.2, color: col });
        } else if (kind === 'TRACE' && a.position.points && a.position.points.length > 1) {
          const c = hexToRgb01(a.position.color || '#dc2626');
          for (let i = 1; i < a.position.points.length; i++) {
            const [px, py] = a.position.points[i - 1];
            const [qx, qy] = a.position.points[i];
            page.drawLine({
              start: { x: (px / 1000) * W, y: H - (py / 1000) * H },
              end: { x: (qx / 1000) * W, y: H - (qy / 1000) * H },
              thickness: 2,
              color: rgb(c.r, c.g, c.b),
              opacity: 0.85,
            });
          }
        } else if (kind === 'TEXTE') {
          page.drawRectangle({ x: x0, y: y0, width: w, height: h, color: rgb(1, 1, 0.97), opacity: 0.92, borderColor: rgb(0.55, 0.6, 0.68), borderWidth: 0.8 });
          const lines = wrapText(a.contenu, 60);
          lines.forEach((ln, i) => {
            page.drawText(ln, { x: x0 + 4, y: y0 + h - 12 - i * 12, size: 10, font: helv, color: rgb(0.1, 0.12, 0.15) });
          });
        } else if (kind === 'TAMPOUR') {
          const isARevoir = a.position.label === 'A_REVOIR';
          const col = isARevoir ? rgb(0.85, 0.46, 0.02) : rgb(0.02, 0.59, 0.41);
          const label = isARevoir ? 'A REVOIR' : 'FAVORABLE';
          page.drawRectangle({ x: x0, y: y0, width: w, height: h, borderColor: col, borderWidth: 2.2, opacity: 0.85 });
          page.drawRectangle({ x: x0 + 3.5, y: y0 + 3.5, width: w - 7, height: h - 7, borderColor: col, borderWidth: 0.9, opacity: 0.85 });
          const size = 20;
          const tw = size * 0.62 * label.length;
          page.drawText(label, {
            x: x0 + w / 2 - tw / 2,
            y: y0 + h / 2 - size / 2,
            size,
            font: helvBold,
            color: col,
            opacity: 0.85,
            rotate: degrees(a.position.rotation ?? -8),
          });
        } else if (kind === 'SIGNATURE' && a.position.image) {
          try {
            const png = await doc.embedPng(a.position.image);
            page.drawImage(png, { x: x0, y: y0, width: w, height: h });
          } catch (e) {
            console.warn('[PdfAnnotator] Signature illisible à l’export:', e);
          }
        }
      }

      const outBytes = await doc.save();
      const outBlob = new Blob([outBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(outBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, '') + '_annote.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e: any) {
      console.error('[PdfAnnotator] Erreur export PDF annoté:', e);
      setActionError('Échec de l’export du PDF annoté : ' + (e?.message || 'erreur inconnue'));
    } finally {
      setExporting(false);
    }
  };

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
  const toolActive = canAnnotate && tool !== 'COMMENTER';

  const TOOL_BUTTONS: { id: Tool; icon: typeof faPen; label: string; title: string }[] = [
    { id: 'COMMENTER', icon: faCommentDots, label: '', title: 'Commenter (sélectionner du texte)' },
    { id: 'ENCRE', icon: faPen, label: '', title: 'Encre — écrire/dessiner sur le document' },
    { id: 'TEXTE', icon: faFont, label: '', title: 'Texte — insérer un encadré texte' },
    { id: 'TAMPON', icon: faStamp, label: '', title: 'Tampon — Favorable / À revoir' },
    { id: 'SIGNATURE', icon: faPenFancy, label: '', title: 'Signature — pavé à tracer (réutilisable)' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 text-slate-800">
      <style>{`
        .pdf-ann-text { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; }
        .pdf-ann-text span { position: absolute; white-space: pre; pointer-events: auto; user-select: text; line-height: 1; }
        .pdf-ann-page { position: relative; }
        .stamp-render { transform: rotate(-8deg); }
      `}</style>

      {/* Barre d'outils */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <FontAwesomeIcon icon={faFilePdf} className="text-red-500" />
        <span className="text-sm font-semibold truncate max-w-[220px]" title={fileName}>{fileName}</span>

        {canAnnotate ? (
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {TOOL_BUTTONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTool(t.id);
                  setPending(null);
                  setDraftOpen(false);
                  setTextDraft(null);
                  setSignDraft(null);
                }}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  tool === t.id ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'
                }`}
                title={t.title}
              >
                <FontAwesomeIcon icon={t.icon} />
              </button>
            ))}
          </div>
        ) : (
          <span className="hidden md:inline text-xs text-slate-400">Lecture seule</span>
        )}

        {/* Couleur de l'encre */}
        {canAnnotate && tool === 'ENCRE' && (
          <div className="flex items-center gap-1.5">
            {INK_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setInkColor(c.hex)}
                className={`w-5 h-5 rounded-full ${c.cls} ${inkColor === c.hex ? 'ring-2 ring-offset-1 ring-blue-500' : 'opacity-70 hover:opacity-100'}`}
                title={`Encre ${c.label}`}
              />
            ))}
          </div>
        )}

        {/* Choix du tampon */}
        {canAnnotate && tool === 'TAMPON' && (
          <div className="flex items-center gap-1.5">
            {STAMPS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setStampLabel(s.label)}
                className={`px-2.5 py-1 text-[11px] font-black uppercase tracking-wide border-2 rounded ${s.cls} ${
                  stampLabel === s.label ? 'opacity-100 ring-2 ring-blue-400' : 'opacity-50 hover:opacity-80'
                }`}
              >
                {s.text}
              </button>
            ))}
          </div>
        )}

        {canAnnotate && (
          <span className="hidden lg:inline text-xs text-slate-400">
            {tool === 'COMMENTER' && 'Sélectionnez du texte avec la souris pour ajouter un commentaire'}
            {tool === 'ENCRE' && 'Dessinez sur le document (traiter la souris comme un stylo)'}
            {tool === 'TEXTE' && 'Cliquez sur la page pour insérer un encadré texte'}
            {tool === 'TAMPON' && 'Cliquez sur la page pour poser le tampon'}
            {tool === 'SIGNATURE' && 'Cliquez sur la page pour placer la signature'}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {actionError && (
            <span className="text-xs text-red-600 max-w-[240px] truncate" title={actionError}>
              {actionError}
            </span>
          )}
          <button
            type="button"
            onClick={exportAnnotatedPdf}
            disabled={exporting}
            className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-1.5"
            title="Télécharger une copie du PDF avec les annotations appliquées"
          >
            {exporting ? <FontAwesomeIcon icon={faCircleNotch} spin className="text-xs" /> : <FontAwesomeIcon icon={faDownload} className="text-xs" />}
            PDF annoté
          </button>
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
            className="ml-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
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

              {/* Tracés vectoriels : surlignages (COMMENTAIRE) + encre (TRACE) */}
              <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 pointer-events-none">
                {fileAnnotations.map((a) => {
                  if (!a.position) return null;
                  const kind = a.kind || 'COMMENTAIRE';
                  if (kind === 'COMMENTAIRE') {
                    return (
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
                    );
                  }
                  if (kind === 'TRACE' && a.position.points && a.position.points.length > 1) {
                    return (
                      <polyline
                        key={a.id}
                        points={a.position.points.map((pt) => pt.join(',')).join(' ')}
                        fill="none"
                        stroke={a.position.color || '#dc2626'}
                        strokeWidth={focusedId === a.id ? 4 : 2.6}
                        strokeOpacity={0.85}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  }
                  // Halo de focalisation pour les annotations HTML (TEXTE / TAMPOUR / SIGNATURE)
                  return focusedId === a.id ? (
                    <rect
                      key={a.id}
                      x={a.position.x - 8}
                      y={a.position.y - 8}
                      width={a.position.w + 16}
                      height={a.position.h + 16}
                      rx={14}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      strokeDasharray="10 6"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null;
                })}
                {/* Trait en cours (aperçu direct) */}
                {drawingPage === p.n && drawingPoints && drawingPoints.length > 1 && (
                  <polyline
                    points={drawingPoints.map((pt) => pt.join(',')).join(' ')}
                    fill="none"
                    stroke={inkColor}
                    strokeWidth={2.6}
                    strokeOpacity={0.9}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>

              {/* Calque HTML : boîtes de texte, tampons, signatures */}
              <div className="absolute inset-0 pointer-events-none">
                {fileAnnotations.map((a) => {
                  if (!a.position) return null;
                  const kind = a.kind || 'COMMENTAIRE';
                  const left = `${a.position.x / 10}%`;
                  const top = `${a.position.y / 10}%`;
                  const width = `${a.position.w / 10}%`;
                  if (kind === 'TEXTE') {
                    return (
                      <div
                        key={a.id}
                        className={`absolute p-1.5 border bg-amber-50/95 rounded shadow-sm ${
                          focusedId === a.id ? 'ring-2 ring-amber-400' : 'border-slate-400/70'
                        }`}
                        style={{ left, top, width }}
                        title={`${resolveAuthorName(a.auteur)} — ${a.contenu.slice(0, 140)}`}
                      >
                        <p className="text-[11px] leading-snug text-slate-800 whitespace-pre-wrap break-words">{a.contenu}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">{resolveAuthorName(a.auteur)}</p>
                      </div>
                    );
                  }
                  if (kind === 'TAMPOUR') {
                    const meta = STAMPS.find((s) => s.label === a.position?.label) || STAMPS[0];
                    return (
                      <div
                        key={a.id}
                        className={`stamp-render absolute flex items-center justify-center border-4 rounded font-black uppercase tracking-widest ${meta.cls} ${
                          focusedId === a.id ? 'ring-2 ring-blue-400' : ''
                        }`}
                        style={{ left, top, width, opacity: 0.85, borderColor: meta.hex, color: meta.hex, fontSize: 13 }}
                        title={`Tampon ${meta.text} — ${resolveAuthorName(a.auteur)}`}
                      >
                        <span className="px-2" style={{ WebkitTextStroke: '0.4px currentColor' }}>{meta.text}</span>
                      </div>
                    );
                  }
                  if (kind === 'SIGNATURE' && a.position.image) {
                    return (
                      <img
                        key={a.id}
                        src={a.position.image}
                        alt={`Signature de ${resolveAuthorName(a.auteur)}`}
                        className={`absolute ${focusedId === a.id ? 'ring-2 ring-blue-400' : ''}`}
                        style={{ left, top, width }}
                        title={`Signature — ${resolveAuthorName(a.auteur)}`}
                      />
                    );
                  }
                  return null;
                })}
              </div>

              {/* Épingles numérotées (commentaires ancrés uniquement) */}
              {fileAnnotations.map((a) =>
                a.position && !a.parentId && (a.kind || 'COMMENTAIRE') === 'COMMENTAIRE' ? (
                  <button
                    key={a.id}
                    type="button"
                    className={`absolute z-20 w-6 h-6 -translate-x-1/2 -translate-y-full rounded-full text-white text-[11px] font-bold flex items-center justify-center shadow-lg hover:scale-125 transition-transform ${
                      PIN_COLOR[a.decision || ''] || 'bg-orange-500'
                    } ${focusedId === a.id ? 'ring-4 ring-yellow-300/70' : ''}`}
                    style={{ left: `${(a.position.x + a.position.w / 2) / 10}%`, top: `${a.position.y / 10}%` }}
                    title={`Commentaire ${numberMap.get(a.id) ?? ''} — ${resolveAuthorName(a.auteur)} : ${a.contenu.slice(0, 120)}`}
                    onMouseEnter={() => setFocusedId(a.id)}
                    onMouseLeave={() => setFocusedId(null)}
                    onClick={() => focusAnnotation(a)}
                  >
                    {numberMap.get(a.id) ?? ''}
                  </button>
                ) : null
              )}

              {/* Couche interactive P2 : encre / texte / tampon / signature */}
              {toolActive && (
                <div
                  className="absolute inset-0 z-10"
                  style={{ touchAction: 'none', cursor: tool === 'ENCRE' ? 'crosshair' : tool === 'TEXTE' ? 'text' : 'copy' }}
                  onPointerDown={(e) => {
                    if (tool === 'ENCRE') handleInkDown(e, p.n);
                    else if (tool === 'TEXTE') handleTextDown(e, p.n);
                    else if (tool === 'TAMPON') handleStampDown(e, p.n);
                    else if (tool === 'SIGNATURE') handleSignDown(e, p.n);
                  }}
                  onPointerMove={(e) => handleInkMove(e, p.n)}
                  onPointerUp={finishInk}
                  onPointerCancel={finishInk}
                />
              )}

              {/* Bouton flottant « Commenter » (sélection) */}
              {canAnnotate && tool === 'COMMENTER' && pending && !draftOpen && pending.pageNum === p.n && (
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

              {/* Éditeur inline de l'encadré texte */}
              {/* P6 — Formulaire du commentaire EN AVANT-PLAN (flottant sur la page, sticky,
                  reste ouvert même quand on clique sur le document) */}
              {canAnnotate && draftOpen && pending && pending.pageNum === p.n && (
                <div
                  className="absolute z-40 w-[300px] max-w-[86%] bg-white border-2 border-blue-400 rounded-xl shadow-2xl p-3"
                  style={{
                    left: clamp(pending.left - 12, 8, Math.max(8, p.width - 308)),
                    top: pending.top + 8 + 208 <= p.height - 8 ? pending.top + 8 : Math.max(8, pending.top - 216),
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <FontAwesomeIcon icon={faCommentDots} className="text-blue-600 text-xs" />
                    <span className="text-xs font-semibold text-slate-700">Nouveau commentaire — page {pending.pageNum}</span>
                    <button
                      type="button"
                      onClick={cancelDraft}
                      className="ml-auto p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      title="Fermer (Échap)"
                    >
                      <FontAwesomeIcon icon={faXmark} className="text-xs" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 italic bg-slate-50 border border-slate-200 rounded-lg p-1.5 mb-2 line-clamp-2">
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
                  <select
                    value={draftDecision}
                    onChange={(e) => setDraftDecision(e.target.value as '' | 'FAVORABLE' | 'A_REVOIR' | 'INFO')}
                    className="mt-1.5 w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white"
                  >
                    <option value="">Décision (optionnelle)</option>
                    <option value="FAVORABLE">✓ Favorable</option>
                    <option value="A_REVOIR">⚠ À revoir</option>
                    <option value="INFO">ℹ Info</option>
                  </select>
                  <div className="flex items-center justify-end gap-1.5 mt-2">
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
                  {saveError && <p className="text-xs text-red-600 mt-1.5">{saveError}</p>}
                </div>
              )}

              {toolActive && tool === 'TEXTE' && textDraft && textDraft.pageNum === p.n && (
                <div
                  className="absolute z-30 w-[38%] min-w-[220px] bg-white border-2 border-blue-400 rounded-lg shadow-2xl p-2"
                  style={{ left: `${textDraft.pos.x / 10}%`, top: `${textDraft.pos.y / 10}%` }}
                >
                  <textarea
                    autoFocus
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        saveTextBox();
                      }
                    }}
                    placeholder="Votre texte… (Entrée pour valider)"
                    rows={2}
                    className="w-full text-sm border border-slate-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <div className="flex items-center justify-end gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => setTextDraft(null)}
                      className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={saveTextBox}
                      disabled={saving || !textValue.trim()}
                      className="text-xs px-2.5 py-1 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <FontAwesomeIcon icon={faCheck} className="text-[10px]" /> OK
                    </button>
                  </div>
                </div>
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
            <div className="flex items-center gap-2">
              {openTopAnnotations.length > 0 && (
                <button
                  type="button"
                  onClick={resolveAll}
                  disabled={saving}
                  title="Marquer toutes les annotations ouvertes comme résolu"
                  className="text-[11px] px-2 py-1 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1 disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faCircleCheck} className="text-[9px]" /> Tout résolu ({openTopAnnotations.length})
                </button>
              )}
              <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-semibold">
                {totalComments}
              </span>
            </div>
          </div>

          {/* P6 — le formulaire du commentaire est maintenant flottant EN AVANT-PLAN sur la
              page (bloc « Nouveau commentaire ») : il ne peut plus être masqué/oublié
              dans le panneau latéral. */}

          {/* Liste (avec fils de réponse) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {totalComments === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">
                Aucun commentaire sur ce document.
                {canAnnotate && ' Utilisez la barre d’outils : commentaire, encre, texte, tampon, signature.'}
              </p>
            )}
            {topLevelAnnotations.map((a) => {
              const meta = a.decision ? DECISION_META[a.decision] : null;
              const kind = a.kind || 'COMMENTAIRE';
              const isComment = kind === 'COMMENTAIRE';
              const n = numberMap.get(a.id) ?? '';
              const canManage = canManageAnnotation ? canManageAnnotation(a) : false;
              const replies = repliesOf(a.id);
              return (
                <div key={a.id}>
                  <button
                    type="button"
                    onClick={() => focusAnnotation(a)}
                    onMouseEnter={() => setFocusedId(a.id)}
                    onMouseLeave={() => setFocusedId(null)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      focusedId === a.id ? 'bg-yellow-50 border-yellow-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    } ${a.statut === 'RESOLU' ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isComment ? (
                        <span
                          className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
                            PIN_COLOR[a.decision || ''] || 'bg-orange-500'
                          }`}
                        >
                          {n}
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-slate-500 text-white text-[10px] flex items-center justify-center">
                          <FontAwesomeIcon icon={KIND_META[kind]?.icon || faPen} />
                        </span>
                      )}
                      <span className="text-xs font-semibold text-slate-700 truncate">
                        {resolveAuthorName(a.auteur)}
                      </span>
                      <span className="ml-auto text-[10px] text-slate-400">
                        {new Date(a.dateCreation).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {kind === 'SIGNATURE' && a.position?.image ? (
                      <img src={a.position.image} alt="Signature" className="h-9 max-w-[160px] object-contain" />
                    ) : (
                      <p className={`text-xs text-slate-700 line-clamp-3 ${kind === 'TAMPOUR' ? 'font-black uppercase tracking-wide' : ''}`}>
                        {a.contenu}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-mono">
                        p. {a.page}
                      </span>
                      {!isComment && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-600 font-semibold">
                          {KIND_META[kind]?.label || kind}
                        </span>
                      )}
                      {meta && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.bg} ${meta.color} ${meta.border}`}>
                          {meta.label}
                        </span>
                      )}
                      {a.statut === 'RESOLU' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-700 font-semibold">
                          ✓ Résolu
                        </span>
                      )}
                      {replies.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700">
                          ↳ {replies.length} réponse{replies.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Actions (auteur ou DG) */}
                  {canManage && (
                    <div className="flex items-center gap-1.5 px-2 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTo(replyTo === a.id ? null : a.id);
                          setReplyText('');
                        }}
                        className="text-[11px] px-2 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center gap-1"
                      >
                        <FontAwesomeIcon icon={faReply} className="text-[9px]" /> Répondre
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatut(a)}
                        disabled={saving}
                        className={`text-[11px] px-2 py-1 rounded-md border flex items-center gap-1 ${
                          a.statut === 'RESOLU'
                            ? 'border-slate-300 text-slate-600 hover:bg-slate-50'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        <FontAwesomeIcon icon={a.statut === 'RESOLU' ? faRotateLeft : faCircleCheck} className="text-[9px]" />
                        {a.statut === 'RESOLU' ? 'Rouvrir' : 'Résolu'}
                      </button>
                      <button
                        type="button"
                        onClick={() => (confirmDeleteId === a.id ? removeAnnotation(a) : setConfirmDeleteId(a.id))}
                        disabled={saving}
                        className={`text-[11px] px-2 py-1 rounded-md border flex items-center gap-1 ${
                          confirmDeleteId === a.id
                            ? 'border-red-400 bg-red-50 text-red-700 font-semibold'
                            : 'border-slate-300 text-slate-500 hover:bg-red-50 hover:text-red-600'
                        }`}
                      >
                        <FontAwesomeIcon icon={faTrash} className="text-[9px]" />
                        {confirmDeleteId === a.id ? 'Confirmer ?' : ''}
                      </button>
                      {confirmDeleteId === a.id && (
                        <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-[11px] px-1.5 py-1 text-slate-400 hover:text-slate-600">
                          Non
                        </button>
                      )}
                    </div>
                  )}

                  {/* Fil de réponse */}
                  {replyTo === a.id && canManage && (
                    <div className="ml-4 mt-1 p-2 bg-blue-50/60 border border-blue-200 rounded-lg">
                      <textarea
                        autoFocus
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            saveReply(a);
                          }
                        }}
                        placeholder="Répondre à ce commentaire… (Ctrl+Entrée)"
                        rows={2}
                        className="w-full text-xs border border-slate-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <div className="flex justify-end gap-1.5 mt-1">
                        <button type="button" onClick={() => setReplyTo(null)} className="text-[11px] px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-white">
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={() => saveReply(a)}
                          disabled={saving || !replyText.trim()}
                          className="text-[11px] px-2.5 py-1 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                        >
                          Répondre
                        </button>
                      </div>
                    </div>
                  )}
                  {replies.map((r) => {
                    const rKind = r.kind || 'COMMENTAIRE';
                    return (
                      <div key={r.id} className="ml-6 mt-1 p-2 bg-white border border-slate-200 rounded-lg">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <FontAwesomeIcon icon={faReply} className="text-[9px] text-slate-400" />
                          <span className="text-[11px] font-semibold text-slate-600 truncate">{resolveAuthorName(r.auteur)}</span>
                          <span className="ml-auto text-[9px] text-slate-400">
                            {new Date(r.dateCreation).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {rKind === 'SIGNATURE' && r.position?.image ? (
                          <img src={r.position.image} alt="Signature" className="h-8 max-w-[140px] object-contain" />
                        ) : (
                          <p className="text-[11px] text-slate-700">{r.contenu}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Modale du pavé de signature */}
      {signDraft && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md">
            <h3 className="font-semibold text-slate-800 text-sm mb-1 flex items-center gap-2">
              <FontAwesomeIcon icon={faPenFancy} className="text-indigo-500" />
              Signature — page {signDraft.pageNum}
            </h3>
            <p className="text-xs text-slate-500 mb-3">Tracez votre signature dans le pavé (souris ou écran tactile), puis enregistrez.</p>
            <canvas
              ref={signCanvasRef}
              width={360}
              height={140}
              className="w-full border-2 border-dashed border-slate-300 rounded-lg bg-white cursor-crosshair"
              onPointerDown={(e) => signCanvasPointer(e, true)}
              onPointerMove={(e) => signCanvasPointer(e, false)}
              onPointerUp={() => {
                signDrawingRef.current = false;
              }}
              onPointerCancel={() => {
                signDrawingRef.current = false;
              }}
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={signClear}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center gap-1"
              >
                <FontAwesomeIcon icon={faEraser} className="text-[10px]" /> Effacer
              </button>
              {lastSigRef.current && (
                <button
                  type="button"
                  onClick={signReuseLast}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1"
                  title="Réutiliser la signature enregistrée précédemment sur ce poste"
                >
                  <FontAwesomeIcon icon={faPenFancy} className="text-[10px]" /> Dernière signature
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSignDraft(null)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={saveSignature}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? '…' : 'Enregistrer la signature'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfAnnotator;
