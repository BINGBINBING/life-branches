import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const identifier = (value) => typeof value === 'string' && /^[\w:-]{0,160}$/.test(value) ? value : '';
const number = (value) => Number.isFinite(value) ? Math.max(0, Math.min(10000000, Math.round(value))) : 0;
const list = (value) => Array.isArray(value) ? value.slice(0, 2000) : [];

// Only explicit UI metadata is persisted; never serialize client state wholesale.
export function normalizeDiagnosticSnapshot(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid snapshot');
  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    researchId: identifier(input.researchId),
    savedRecordId: identifier(input.savedRecordId),
    selectedPathId: identifier(input.selectedPathId),
    focusedCaseId: identifier(input.focusedCaseId),
    filter: identifier(input.filter),
    step: ['start', 'conditions', 'explore'].includes(input.step) ? input.step : 'start',
    scroll: { x: number(input.scroll?.x), y: number(input.scroll?.y) },
    viewport: { width: number(input.viewport?.width), height: number(input.viewport?.height) },
    details: list(input.details).map((item) => ({ index: number(item?.index), caseId: identifier(item?.caseId), open: item?.open === true })),
    dialogs: list(input.dialogs).map((item) => ({ index: number(item?.index), open: item?.open === true, scrollTop: number(item?.scrollTop) })),
    visibleCaseIds: list(input.visibleCaseIds).map(identifier).filter(Boolean),
    scrollers: list(input.scrollers).map((item) => ({ index: number(item?.index), x: number(item?.x), y: number(item?.y) })),
  };
}

export async function saveDiagnosticSnapshot(input, directory = join(process.cwd(), '.local/diagnostics')) {
  const snapshot = normalizeDiagnosticSnapshot(input);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, `${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(snapshot, null, 2), { mode: 0o600, flag: 'wx' });
    await rename(temporary, join(directory, 'latest.json'));
  } finally { await rm(temporary, { force: true }); }
  return { ok: true, capturedAt: snapshot.capturedAt };
}
