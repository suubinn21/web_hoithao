import {
  Tournament,
  Team,
  Match,
  Venue,
  Referee,
  Complaint,
  FinancialTransaction,
  TournamentAward,
  AuditLog,
  TournamentStatus,
  PaidFineRecord,
} from '@/types';
import { StorageService } from './storage';
import { fetchJsonWithTimeout, isRetryableFailure } from '@/utils/network';

export interface TournamentCloudData {
  tournament: Tournament;
  teams: Team[];
  matches: Match[];
  venues: Venue[];
  referees: Referee[];
  complaints: Complaint[];
  finances: FinancialTransaction[];
  awards: TournamentAward[];
  auditLogs: AuditLog[];
  manualSuspensions?: Record<
    string,
    { isSuspended: boolean; reason?: string; yellows: number; reds: number; decision?: 'PENDING' | 'SUSPENDED' | 'CLEARED' }
  >;
  btcTieBreaks?: Record<string, string[]>;
  paidFines?: Record<string, PaidFineRecord>;
  status: TournamentStatus;
  updatedAt?: number;
}

export type TournamentStatsMap = Record<string, { teamsCount: number; matchesCount: number; version?: number }>;

export interface CloudSyncSnapshot {
  pendingCount: number;
  isSyncing: boolean;
  needsReauth: boolean;
  lastError: string | null;
  lastSyncedAt: number | null;
}

interface QueuedPatchEntry {
  patch: Partial<TournamentCloudData>;
  revision: number;
  queuedAt: number;
  retryCount: number;
  lastError?: string;
  needsAuth?: boolean;
}

interface TournamentGetResponse {
  ok?: boolean;
  error?: string;
  unchanged?: boolean;
  version?: number;
  data?: TournamentCloudData;
}

interface TournamentListResponse {
  ok?: boolean;
  error?: string;
  tournaments?: Tournament[];
  stats?: TournamentStatsMap;
}

interface TournamentMutationResponse {
  ok?: boolean;
  error?: string;
  id?: string;
  version?: number;
}

const OFFLINE_QUEUE_STORAGE_KEY = 'itftms_offline_sync_queue_v1';
const MAX_CLOUD_AUDIT_LOGS = 150;
const DEBOUNCE_PUSH_MS = 100;
const MAX_RETRY_BACKOFF_MS = 30000;

const tournamentVersionCache = new Map<string, number>();
const offlineQueue = new Map<string, QueuedPatchEntry>();
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const flushingTournaments = new Set<string>();
const syncListeners = new Set<(snap: CloudSyncSnapshot) => void>();

let queueHydrated = false;
let lifecycleListenersBound = false;
let lastSyncErrorGlobal: string | null = null;
let lastSyncedAtGlobal: number | null = null;
let listRefreshTrigger: (() => void) | null = null;
let detailRefreshTrigger: (() => void) | null = null;

function isClientEnv(): boolean {
  return typeof window !== 'undefined';
}

function hydrateQueueOnce(): void {
  if (queueHydrated || !isClientEnv()) return;
  queueHydrated = true;
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, QueuedPatchEntry>;
    if (!parsed || typeof parsed !== 'object') return;
    for (const [tid, entry] of Object.entries(parsed)) {
      if (tid && entry && entry.patch && typeof entry.patch === 'object') {
        offlineQueue.set(tid, {
          patch: entry.patch,
          revision: typeof entry.revision === 'number' ? entry.revision : 1,
          queuedAt: typeof entry.queuedAt === 'number' ? entry.queuedAt : Date.now(),
          retryCount: typeof entry.retryCount === 'number' ? entry.retryCount : 0,
          lastError: entry.lastError,
          needsAuth: Boolean(entry.needsAuth),
        });
      }
    }
  } catch {
    // Ignore corrupted storage entry
  }
}

function persistQueue(): void {
  if (!isClientEnv()) return;
  if (offlineQueue.size === 0) {
    try {
      localStorage.removeItem(OFFLINE_QUEUE_STORAGE_KEY);
    } catch {}
    return;
  }

  const obj: Record<string, QueuedPatchEntry> = {};
  offlineQueue.forEach((entry, tid) => {
    obj[tid] = entry;
  });

  try {
    localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Fallback on QuotaExceededError: drop heavy auditLogs from persisted queue (already stored in StorageService)
    try {
      const compactObj: Record<string, QueuedPatchEntry> = {};
      offlineQueue.forEach((entry, tid) => {
        const { auditLogs: _ignored, ...restPatch } = entry.patch;
        compactObj[tid] = { ...entry, patch: restPatch };
      });
      localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(compactObj));
    } catch {}
  }
}

export function getCloudSyncSnapshot(): CloudSyncSnapshot {
  hydrateQueueOnce();
  let needsReauth = false;
  let latestEntryError: string | null = null;
  offlineQueue.forEach((entry) => {
    if (entry.needsAuth) needsReauth = true;
    if (!latestEntryError && entry.lastError) latestEntryError = entry.lastError;
  });

  return {
    pendingCount: offlineQueue.size,
    isSyncing: flushingTournaments.size > 0,
    needsReauth,
    lastError: offlineQueue.size > 0 ? latestEntryError || lastSyncErrorGlobal : null,
    lastSyncedAt: lastSyncedAtGlobal,
  };
}

function emitSyncSnapshot(): void {
  const snap = getCloudSyncSnapshot();
  syncListeners.forEach((cb) => {
    try {
      cb(snap);
    } catch {}
  });
}

export function subscribeCloudSyncSnapshot(cb: (snap: CloudSyncSnapshot) => void): () => void {
  hydrateQueueOnce();
  syncListeners.add(cb);
  cb(getCloudSyncSnapshot());
  return () => {
    syncListeners.delete(cb);
  };
}

export function hasPendingCloudSync(tournamentId?: string): boolean {
  hydrateQueueOnce();
  if (tournamentId) {
    return offlineQueue.has(tournamentId);
  }
  return offlineQueue.size > 0;
}

export function getQueuedTournamentPatch(tournamentId: string): Tournament | undefined {
  hydrateQueueOnce();
  return offlineQueue.get(tournamentId)?.patch.tournament;
}

function compactAuditLogs(logs?: AuditLog[]): AuditLog[] | undefined {
  if (!Array.isArray(logs)) return logs;
  return logs.slice(0, MAX_CLOUD_AUDIT_LOGS).map((log) => ({
    ...log,
    details: log.details && log.details.length > 300 ? `${log.details.slice(0, 300)}...` : log.details,
  }));
}

export function invalidateTournamentPollCache(tournamentId?: string): void {
  if (tournamentId) {
    tournamentVersionCache.delete(tournamentId);
  } else {
    tournamentVersionCache.clear();
  }
}

export function triggerCloudRefreshNow(): void {
  if (listRefreshTrigger) listRefreshTrigger();
  if (detailRefreshTrigger) detailRefreshTrigger();
}

function clearTimer(tournamentId: string): void {
  const timer = pendingTimers.get(tournamentId);
  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(tournamentId);
  }
}

function scheduleFlush(tournamentId: string, delayMs: number): void {
  clearTimer(tournamentId);
  const timer = setTimeout(() => {
    pendingTimers.delete(tournamentId);
    void flushTournamentPatch(tournamentId);
  }, delayMs);
  pendingTimers.set(tournamentId, timer);
}

function flushAllWithKeepalive(): void {
  hydrateQueueOnce();
  offlineQueue.forEach((entry, tid) => {
    if (!entry.needsAuth && !flushingTournaments.has(tid)) {
      clearTimer(tid);
      void flushTournamentPatch(tid, true);
    }
  });
}

function ensureNetworkLifecycleListeners(): void {
  if (lifecycleListenersBound || !isClientEnv()) return;
  lifecycleListenersBound = true;

  window.addEventListener('online', () => {
    void flushAllOfflineSyncQueue();
    triggerCloudRefreshNow();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushAllWithKeepalive();
    } else if (document.visibilityState === 'visible') {
      void flushAllOfflineSyncQueue();
    }
  });

  window.addEventListener('pagehide', () => {
    flushAllWithKeepalive();
  });
}

export function clearOfflineSyncForTournament(tournamentId: string): void {
  if (!tournamentId) return;
  hydrateQueueOnce();
  clearTimer(tournamentId);
  offlineQueue.delete(tournamentId);
  persistQueue();
  emitSyncSnapshot();
}

export async function flushAllOfflineSyncQueue(): Promise<void> {
  hydrateQueueOnce();
  const ids = Array.from(offlineQueue.keys());
  for (const tid of ids) {
    clearTimer(tid);
    await flushTournamentPatch(tid);
  }
}

export async function retryOfflineSyncAfterAuth(): Promise<void> {
  hydrateQueueOnce();
  offlineQueue.forEach((entry, tid) => {
    offlineQueue.set(tid, {
      ...entry,
      needsAuth: false,
      retryCount: 0,
      lastError: undefined,
    });
  });
  persistQueue();
  emitSyncSnapshot();
  await flushAllOfflineSyncQueue();
}

async function flushTournamentPatch(tournamentId: string, keepalive = false): Promise<boolean> {
  hydrateQueueOnce();
  if (!tournamentId || flushingTournaments.has(tournamentId)) return false;

  const entry = offlineQueue.get(tournamentId);
  if (!entry) return true;
  if (entry.needsAuth && !keepalive) return false;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    offlineQueue.set(tournamentId, {
      ...entry,
      lastError: 'Thiết bị đang mất mạng — dữ liệu đã lưu tạm, tự gửi khi có sóng.',
    });
    persistQueue();
    emitSyncSnapshot();
    return false;
  }

  clearTimer(tournamentId);
  const snapshotRevision = entry.revision;
  const patchSnapshot: Partial<TournamentCloudData> = { ...entry.patch };

  flushingTournaments.add(tournamentId);
  emitSyncSnapshot();

  try {
    const latestLogs = StorageService.getAuditLogs();
    const payload: Partial<TournamentCloudData> & { id: string } = {
      id: tournamentId,
      ...patchSnapshot,
      auditLogs: compactAuditLogs(patchSnapshot.auditLogs || latestLogs),
    };
    const bodyStr = JSON.stringify(payload);

    const res = await fetchJsonWithTimeout<TournamentMutationResponse>('/api/tournaments.php?action=save', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
      keepalive: keepalive && bodyStr.length < 60000,
      timeoutMs: 15000,
    });

    if (res.ok && res.data?.ok) {
      if (res.data.version) {
        tournamentVersionCache.set(tournamentId, Number(res.data.version));
      }
      lastSyncedAtGlobal = Date.now();
      lastSyncErrorGlobal = null;

      const latestQueued = offlineQueue.get(tournamentId);
      if (!latestQueued || latestQueued.revision === snapshotRevision) {
        offlineQueue.delete(tournamentId);
        persistQueue();
        if (listRefreshTrigger) listRefreshTrigger();
        return true;
      }

      // Newer local edits arrived while the slow save request was in flight
      offlineQueue.set(tournamentId, {
        ...latestQueued,
        retryCount: 0,
        needsAuth: false,
        lastError: undefined,
      });
      persistQueue();
      scheduleFlush(tournamentId, 60);
      return false;
    }

    // 404: Tournament was deleted on server, drop orphaned patch
    if (res.status === 404) {
      offlineQueue.delete(tournamentId);
      persistQueue();
      return false;
    }

    const curr = offlineQueue.get(tournamentId) || entry;

    // 401 or 403: Keep changes safely on device so re-login / BTC can sync without losing data
    if (res.status === 401 || res.status === 403) {
      const authErr =
        res.status === 401
          ? 'Phiên đăng nhập đã hết hạn — dữ liệu đang giữ tạm trên máy.'
          : res.error || 'Tài khoản hiện tại không đủ quyền đồng bộ thay đổi này.';
      lastSyncErrorGlobal = authErr;
      offlineQueue.set(tournamentId, {
        ...curr,
        needsAuth: true,
        lastError: authErr,
      });
      persistQueue();
      return false;
    }

    if (isRetryableFailure(res)) {
      const nextRetry = curr.retryCount + 1;
      const backoffMs = Math.min(MAX_RETRY_BACKOFF_MS, 2000 * Math.pow(2, Math.min(4, nextRetry - 1)));
      const errMsg = res.error || 'Mạng yếu hoặc mất kết nối MySQL, đang chờ tự gửi lại.';
      lastSyncErrorGlobal = errMsg;
      offlineQueue.set(tournamentId, {
        ...curr,
        retryCount: nextRetry,
        lastError: errMsg,
      });
      persistQueue();
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        scheduleFlush(tournamentId, backoffMs);
      }
      return false;
    }

    // Non-retryable 400 validation error
    lastSyncErrorGlobal = res.error || 'Dữ liệu gửi lên không hợp lệ.';
    offlineQueue.set(tournamentId, {
      ...curr,
      lastError: lastSyncErrorGlobal,
    });
    persistQueue();
    return false;
  } finally {
    flushingTournaments.delete(tournamentId);
    emitSyncSnapshot();
  }
}

export async function fetchTournamentsListCloud(): Promise<{
  tournaments: Tournament[];
  stats: TournamentStatsMap;
}> {
  const res = await fetchJsonWithTimeout<TournamentListResponse>('/api/tournaments.php?action=list', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    timeoutMs: 10000,
  });
  if (!res.ok || !res.data?.ok) {
    throw new Error(res.error || res.data?.error || 'Không thể tải danh sách giải đấu từ CSDL MySQL.');
  }
  const rawList = Array.isArray(res.data.tournaments) ? res.data.tournaments : [];
  // Keep unsynced local profile edits visible until offline queue finishes pushing
  const mergedList = rawList.map((t) => getQueuedTournamentPatch(t.id) || t);

  return {
    tournaments: mergedList,
    stats: res.data.stats && typeof res.data.stats === 'object' ? res.data.stats : {},
  };
}

export function subscribeTournamentsListCloud(
  onList: (list: Tournament[], stats: TournamentStatsMap) => void,
  onError?: (err: Error) => void
): () => void {
  ensureNetworkLifecycleListeners();
  let stopped = false;
  let inFlight = false;
  let consecutiveFailures = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const scheduleNext = (delayMs: number) => {
    if (stopped) return;
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      void pull();
    }, delayMs);
  };

  const pull = async () => {
    if (stopped || inFlight) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      scheduleNext(8000);
      return;
    }

    inFlight = true;
    try {
      const { tournaments, stats } = await fetchTournamentsListCloud();
      consecutiveFailures = 0;
      if (!stopped) {
        onList(tournaments, stats);
      }
    } catch (err) {
      consecutiveFailures++;
      if (!stopped && onError) {
        onError(err instanceof Error ? err : new Error('Lỗi kết nối MySQL'));
      }
    } finally {
      inFlight = false;
      const nextDelay = consecutiveFailures > 0 ? Math.min(24000, 8000 * Math.pow(1.5, Math.min(3, consecutiveFailures))) : 8000;
      scheduleNext(Math.round(nextDelay));
    }
  };

  listRefreshTrigger = () => {
    consecutiveFailures = 0;
    if (timerId) clearTimeout(timerId);
    void pull();
  };

  void pull();

  return () => {
    stopped = true;
    listRefreshTrigger = null;
    if (timerId) clearTimeout(timerId);
  };
}

export function subscribeTournamentCloud(
  tournamentId: string,
  onData: (data: TournamentCloudData) => void,
  onError?: (err: Error) => void
): () => void {
  if (!tournamentId) return () => {};
  ensureNetworkLifecycleListeners();
  hydrateQueueOnce();

  let stopped = false;
  let inFlight = false;
  let consecutiveFailures = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const scheduleNext = (delayMs: number) => {
    if (stopped) return;
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      void pull();
    }, delayMs);
  };

  const pull = async () => {
    if (stopped || inFlight) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      scheduleNext(5000);
      return;
    }

    inFlight = true;
    try {
      // Push pending offline writes for this tournament first before pulling server snapshot
      if (hasPendingCloudSync(tournamentId)) {
        const queued = offlineQueue.get(tournamentId);
        if (queued && !queued.needsAuth && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
          await flushTournamentPatch(tournamentId);
        }
        if (hasPendingCloudSync(tournamentId)) {
          const latestErr = offlineQueue.get(tournamentId)?.lastError;
          if (!queued?.needsAuth && latestErr && !stopped && onError) {
            onError(new Error(latestErr));
          }
          return;
        }
      }

      const since = tournamentVersionCache.get(tournamentId) || 0;
      const res = await fetchJsonWithTimeout<TournamentGetResponse>(
        `/api/tournaments.php?action=get&id=${encodeURIComponent(tournamentId)}&sinceVersion=${since}`,
        {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          timeoutMs: 10000,
        }
      );

      if (!res.ok || !res.data?.ok) {
        throw new Error(res.error || res.data?.error || 'Không thể tải dữ liệu giải đấu.');
      }

      // Guard against stale GET finishing after the user made a local edit during flight
      if (stopped || hasPendingCloudSync(tournamentId)) {
        invalidateTournamentPollCache(tournamentId);
        return;
      }

      consecutiveFailures = 0;
      if (res.data.version) {
        tournamentVersionCache.set(tournamentId, Number(res.data.version));
      }
      if (!res.data.unchanged && res.data.data) {
        onData(res.data.data);
      }
    } catch (err) {
      consecutiveFailures++;
      if (!stopped && onError) {
        onError(err instanceof Error ? err : new Error('Lỗi đồng bộ MySQL'));
      }
    } finally {
      inFlight = false;
      const nextDelay = consecutiveFailures > 0 ? Math.min(20000, 5000 * Math.pow(1.6, Math.min(3, consecutiveFailures))) : 5000;
      scheduleNext(Math.round(nextDelay));
    }
  };

  detailRefreshTrigger = () => {
    consecutiveFailures = 0;
    if (timerId) clearTimeout(timerId);
    void pull();
  };

  void pull();

  return () => {
    stopped = true;
    detailRefreshTrigger = null;
    if (timerId) clearTimeout(timerId);
  };
}

export async function createTournamentCloud(
  initialData: TournamentCloudData
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetchJsonWithTimeout<TournamentMutationResponse>('/api/tournaments.php?action=create', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...initialData,
      auditLogs: compactAuditLogs(initialData.auditLogs),
    }),
    timeoutMs: 15000,
  });

  if (!res.ok || !res.data?.ok) {
    return {
      ok: false,
      error: res.error || res.data?.error || 'Không thể tạo giải đấu trên MySQL.',
    };
  }

  if (res.data.version && initialData.tournament?.id) {
    tournamentVersionCache.set(initialData.tournament.id, Number(res.data.version));
  }
  if (listRefreshTrigger) listRefreshTrigger();
  return { ok: true };
}

export async function pushTournamentCloud(
  tournamentId: string,
  data: Partial<TournamentCloudData>
): Promise<void> {
  if (!tournamentId) return;
  ensureNetworkLifecycleListeners();
  hydrateQueueOnce();

  const existing = offlineQueue.get(tournamentId);
  offlineQueue.set(tournamentId, {
    patch: { ...(existing?.patch || {}), ...data },
    revision: (existing?.revision || 0) + 1,
    queuedAt: existing?.queuedAt || Date.now(),
    retryCount: 0,
    needsAuth: false,
    lastError: undefined,
  });
  persistQueue();
  emitSyncSnapshot();

  scheduleFlush(tournamentId, DEBOUNCE_PUSH_MS);
}

export async function deleteTournamentCloud(tournamentId: string): Promise<{ ok: boolean; error?: string }> {
  if (!tournamentId) return { ok: false, error: 'Thiếu mã giải đấu.' };

  const res = await fetchJsonWithTimeout<TournamentMutationResponse>('/api/tournaments.php?action=delete', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: tournamentId }),
    timeoutMs: 12000,
  });

  if (!res.ok || !res.data?.ok) {
    return {
      ok: false,
      error: res.error || res.data?.error || 'Không thể xóa giải đấu.',
    };
  }

  clearOfflineSyncForTournament(tournamentId);
  tournamentVersionCache.delete(tournamentId);
  if (listRefreshTrigger) listRefreshTrigger();
  return { ok: true };
}
