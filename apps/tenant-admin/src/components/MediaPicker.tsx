'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ImageIcon } from 'lucide-react';
import { getMediaSignedUrl, listMediaAssets, type MediaAsset } from '@/lib/queries';
import { Badge, Button, Dialog } from '@/components/ui';

interface MediaPickerProps {
  /**
   * Render-prop trigger. The consumer decides button styling; we only own the
   * dialog. When a user selects an image, `onPick` receives a signed URL that
   * survives ~15min — long enough to submit the product form.
   */
  trigger: (open: () => void) => React.ReactNode;
  onPick: (url: string, asset: MediaAsset) => void;
}

export function MediaPicker({ trigger, onPick }: MediaPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Medya Kütüphanesinden Seç"
        description="Yüklenmiş bir görseli seçin. Gösterilen bağlantılar kısa ömürlüdür; kaydet butonuna basıldığında sunucu tarafında yeniden işlenir."
        widthClass="max-w-3xl"
      >
        <MediaPickerGrid
          onPick={(url, asset) => {
            onPick(url, asset);
            setOpen(false);
          }}
        />
      </Dialog>
    </>
  );
}

function MediaPickerGrid({
  onPick,
}: {
  onPick: (url: string, asset: MediaAsset) => void;
}) {
  const assetsQ = useQuery({
    queryKey: ['media-picker-assets'],
    queryFn: () => listMediaAssets({ kind: 'IMAGE', limit: 48 }),
    staleTime: 60 * 1000,
  });

  if (assetsQ.isLoading) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">Yükleniyor…</div>
    );
  }
  const items = assetsQ.data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <ImageIcon className="mx-auto mb-2 h-8 w-8 text-slate-400" />
        <p className="text-sm text-slate-500">
          Kütüphanede henüz görsel yok. Önce &quot;Medya Kütüphanesi&quot;
          sayfasından yükleyin.
        </p>
      </div>
    );
  }
  return (
    <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
      {items.map((asset) => (
        <PickerCard key={asset.id} asset={asset} onPick={onPick} />
      ))}
    </div>
  );
}

function PickerCard({
  asset,
  onPick,
}: {
  asset: MediaAsset;
  onPick: (url: string, asset: MediaAsset) => void;
}) {
  const { data } = useQuery({
    queryKey: ['media-signed-url', asset.id],
    queryFn: () => getMediaSignedUrl(asset.id),
    staleTime: 10 * 60 * 1000,
  });
  return (
    <button
      type="button"
      className="group relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-white transition hover:border-brand-500"
      onClick={() => {
        if (data?.url) onPick(data.url, asset);
      }}
      disabled={!data?.url}
    >
      {data?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.url}
          alt={asset.filename}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Badge tone="slate">{asset.kind}</Badge>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 truncate bg-white/80 px-2 py-1 text-xs text-slate-700">
        {asset.filename}
      </div>
      <div className="absolute right-1 top-1 rounded-full bg-brand-600 p-1 text-white opacity-0 transition group-hover:opacity-100">
        <Check className="h-3 w-3" />
      </div>
    </button>
  );
}

// Backward-compat export for the Button variant consumers.
export function MediaPickerButton({
  onPick,
  label = 'Medya Kütüphanesinden Seç',
}: {
  onPick: (url: string, asset: MediaAsset) => void;
  label?: string;
}) {
  return (
    <MediaPicker
      onPick={onPick}
      trigger={(open) => (
        <Button type="button" variant="outline" onClick={open}>
          <ImageIcon className="h-4 w-4" /> {label}
        </Button>
      )}
    />
  );
}
