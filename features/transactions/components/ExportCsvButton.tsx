'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export function ExportCsvButton() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setMessage(null);
    setBusy(true);
    try {
      // Strip `page` — export always covers the full filtered set.
      const params = new URLSearchParams(searchParams);
      params.delete('page');
      const qs = params.toString();
      const url = `/api/transactions/export${qs ? `?${qs}` : ''}`;

      // HEAD is not offered by the route; we GET and branch on the status
      // code before kicking off the browser download.
      const res = await fetch(url, { method: 'GET', credentials: 'same-origin' });
      if (res.status === 409) {
        setMessage('Không có giao dịch nào để xuất.');
        return;
      }
      if (!res.ok) {
        setMessage('Không thể xuất CSV. Vui lòng thử lại.');
        return;
      }

      const blob = await res.blob();
      const filename =
        parseFilename(res.headers.get('content-disposition')) ??
        `transactions-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {busy ? 'Đang xuất…' : 'Xuất CSV'}
      </button>
      {message && <p className="text-xs text-amber-700 dark:text-amber-400">{message}</p>}
    </div>
  );
}

function parseFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const m = /filename="([^"]+)"/.exec(contentDisposition);
  return m?.[1] ?? null;
}
