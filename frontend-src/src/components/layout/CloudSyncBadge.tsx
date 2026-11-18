'use client';

import React from 'react';
import { Cloud, RefreshCw, AlertTriangle, WifiOff } from 'lucide-react';
import type { CloudSyncSnapshot } from '@/services/dbSync';

export interface CloudSyncBadgeProps {
  cloudStatus?: 'connected' | 'connecting' | 'offline';
  syncSnapshot?: CloudSyncSnapshot;
  onRetrySync?: () => void;
  onRequestAuth?: () => void;
  variant?: 'header' | 'portal' | 'compact';
}

export const CloudSyncBadge: React.FC<CloudSyncBadgeProps> = ({
  cloudStatus = 'connected',
  syncSnapshot,
  onRetrySync,
  onRequestAuth,
  variant = 'header',
}) => {
  const pendingCount = syncSnapshot?.pendingCount ?? 0;
  const isSyncing = syncSnapshot?.isSyncing ?? false;
  const needsReauth = syncSnapshot?.needsReauth ?? false;
  const lastError = syncSnapshot?.lastError;

  const isHeader = variant === 'header';
  const isCompact = variant === 'compact';

  const baseSizeClass = isCompact
    ? 'text-[10px] px-2 py-0.5 rounded-full gap-1'
    : isHeader
      ? 'hidden lg:flex min-h-[40px] px-3 rounded-xl gap-1.5 text-xs'
      : 'flex min-h-[44px] px-2.5 sm:px-3 rounded-xl gap-1.5 text-[11px] sm:text-xs';

  if (needsReauth && pendingCount > 0) {
    return (
      <button
        type="button"
        onClick={onRequestAuth}
        className={`${baseSizeClass} items-center border font-semibold shadow-xs transition-all shrink-0 whitespace-nowrap bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 active:scale-95`}
        title={lastError || 'Phiên đăng nhập đã hết hạn — bấm để đăng nhập lại và đồng bộ dữ liệu đã lưu tạm'}
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span className="font-mono font-bold text-[10px] sm:text-[11px] whitespace-nowrap">
          Hết phiên ({pendingCount})
        </span>
      </button>
    );
  }

  if (pendingCount > 0) {
    return (
      <button
        type="button"
        onClick={onRetrySync}
        className={`${baseSizeClass} items-center border font-semibold shadow-xs transition-all shrink-0 whitespace-nowrap bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 active:scale-95`}
        title={
          lastError
            ? `${lastError} — Dữ liệu đang được giữ an toàn trên máy. Bấm để tải lại lên cơ sở dữ liệu.`
            : `Đang giữ ${pendingCount} thay đổi chờ đồng bộ lên MySQL. Bấm để thử gửi ngay.`
        }
      >
        <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
        <span className="font-mono font-bold text-[10px] sm:text-[11px] whitespace-nowrap">
          {isSyncing ? `Đang gửi (${pendingCount})...` : `Lưu tạm (${pendingCount})`}
        </span>
      </button>
    );
  }

  if (cloudStatus === 'offline') {
    return (
      <button
        type="button"
        onClick={onRetrySync}
        className={`${baseSizeClass} items-center border font-semibold shadow-xs transition-all shrink-0 whitespace-nowrap bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 active:scale-95`}
        title="Mất kết nối hoặc mạng quá yếu — đang dùng dữ liệu lưu tạm trên máy. Bấm để thử kết nối lại."
      >
        <WifiOff className="w-3.5 h-3.5 shrink-0 text-slate-500" />
        <span className="font-mono font-bold text-[10px] sm:text-[11px] whitespace-nowrap">
          Offline ↻
        </span>
      </button>
    );
  }

  const isConnecting = cloudStatus === 'connecting';

  return (
    <div
      className={`${baseSizeClass} items-center border font-semibold shadow-xs transition-all shrink-0 whitespace-nowrap ${isConnecting
          ? 'bg-amber-50 border-amber-200 text-amber-700'
          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}
      title={
        isConnecting
          ? 'Đang kết nối đến CSDL ...'
          : 'Dữ liệu đang kết nối và đồng bộ trực tiếp với CSDL'
      }
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {!isConnecting && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${isConnecting ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
        ></span>
      </span>
      {!isCompact && <Cloud className="w-3.5 h-3.5 shrink-0" />}
      <span className="font-mono font-bold text-[10px] sm:text-[11px] whitespace-nowrap">
        {isConnecting ? 'Kết nối...' : 'MySQL Sync'}
      </span>
    </div>
  );
};

interface OfflineSyncBannerProps {
  cloudStatus: 'connected' | 'connecting' | 'offline';
  syncSnapshot: CloudSyncSnapshot;
  onRetrySync: () => void;
  onRequestAuth?: () => void;
}

export const OfflineSyncBanner: React.FC<OfflineSyncBannerProps> = ({
  cloudStatus,
  syncSnapshot,
  onRetrySync,
  onRequestAuth,
}) => {
  const { pendingCount, isSyncing, needsReauth, lastError } = syncSnapshot;

  if (pendingCount === 0 && cloudStatus !== 'offline') {
    return null;
  }

  if (needsReauth && pendingCount > 0) {
    return (
      <div className="bg-rose-50 border-b border-rose-200 text-rose-800 px-3 sm:px-6 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Phiên đăng nhập hết hạn:</strong> Còn <strong>{pendingCount}</strong> thay đổi được lưu an toàn trên thiết bị. Đăng nhập lại để tự đồng bộ .
            </span>
          </div>
          {onRequestAuth && (
            <button
              type="button"
              onClick={onRequestAuth}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shrink-0 transition-colors"
            >
              Đăng Nhập &amp; Đồng Bộ
            </button>
          )}
        </div>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-3 sm:px-6 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            <RefreshCw className={`w-4 h-4 text-amber-600 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              <strong>Đang chờ đồng bộ ({pendingCount}):</strong> Mạng yếu/mất sóng — thay đổi đã được lưu an toàn trên máy và sẽ tự đẩy lên CSDL khi có mạng.
              {lastError ? <span className="text-amber-700 hidden sm:inline"> ({lastError})</span> : null}
            </span>
          </div>
          <button
            type="button"
            onClick={onRetrySync}
            disabled={isSyncing}
            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold text-[11px] shrink-0 transition-colors"
          >
            {isSyncing ? 'Đang gửi...' : 'Thử đồng bộ ngay'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-100 border-b border-slate-200 text-slate-700 px-3 sm:px-6 py-1.5 text-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <WifiOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>
            Mạng yếu hoặc đang Offline — bạn vẫn xem được dữ liệu đã tải gần nhất. Hệ thống tự kết nối lại khi có sóng.
          </span>
        </div>
        <button
          type="button"
          onClick={onRetrySync}
          className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-[11px] shrink-0 transition-colors"
        >
          Thử lại!
        </button>
      </div>
    </div>
  );
};
