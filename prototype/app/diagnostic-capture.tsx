'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, LoaderCircle } from 'lucide-react';

export function DiagnosticCapture({ state }: { state: {
  researchId: string; savedRecordId: string; selectedPathId: string;
  focusedCaseId: string; filter: string; step: string;
} }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const update = () => setTarget(Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).at(-1) || document.body);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, []);

  async function capture() {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('body *'));
    const payload = {
      ...state,
      scroll: { x: window.scrollX, y: window.scrollY },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      details: Array.from(document.querySelectorAll('details')).map((node, index) => ({ index, caseId: node.closest('article')?.id || '', open: node.open })),
      dialogs: Array.from(document.querySelectorAll('dialog')).map((node, index) => ({ index, open: node.open, scrollTop: node.scrollTop })),
      visibleCaseIds: Array.from(document.querySelectorAll('article[id]')).filter((node) => { const rect = node.getBoundingClientRect(); return rect.bottom > 0 && rect.top < window.innerHeight; }).map((node) => node.id),
      scrollers: elements.flatMap((node, index) => node.scrollTop > 0 || node.scrollLeft > 0 ? [{ index, x: node.scrollLeft, y: node.scrollTop }] : []).slice(0, 200),
    };
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/branches/diagnostic-snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error('save failed');
      setMessage('诊断快照已保存到本地');
    } catch { setMessage('保存失败，请重试'); }
    finally { setSaving(false); }
  }

  return target ? createPortal(<div className="diagnostic-capture">
    {message && <output>{message}</output>}
    <button type="button" aria-label="保存诊断快照" title="保存诊断快照（仅本地）" disabled={saving} onClick={() => void capture()}>
      {saving ? <LoaderCircle size={21} /> : <Camera size={21} />}
    </button>
  </div>, target) : null;
}
