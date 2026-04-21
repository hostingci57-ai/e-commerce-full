'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import {
  createMediaAsset,
  deleteMediaAsset,
  getMediaSignedUrl,
  listMediaAssets,
  requestPresignedUpload,
  type MediaAsset,
  type MediaKind,
} from '@/lib/queries';
import { Badge, Button, Select } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

const MAX_BYTES = 20 * 1024 * 1024;

export default function MediaPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<'all' | MediaKind>('all');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const assetsQ = useQuery({
    queryKey: ['media-assets', kind],
    queryFn: () =>
      listMediaAssets({ kind: kind === 'all' ? undefined : kind, limit: 48 }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteMediaAsset(id),
    onSuccess: () => {
      toast.success('Silindi');
      qc.invalidateQueries({ queryKey: ['media-assets'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Silinemedi'),
  });

  async function onUploadChange(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(`Desteklenmeyen tür: ${file.type || 'bilinmiyor'}`);
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`Dosya çok büyük (maks ${MAX_BYTES / (1024 * 1024)} MB)`);
      return;
    }
    setUploading(true);
    try {
      const presign = await requestPresignedUpload({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Yükleme başarısız: HTTP ${putRes.status}`);
      }
      await createMediaAsset({
        key: presign.key,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      toast.success('Yüklendi');
      qc.invalidateQueries({ queryKey: ['media-assets'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yükleme hatası');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const rows = assetsQ.data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <ImageIcon className="h-6 w-6 text-brand-600" /> Medya Kütüphanesi
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ürün görselleri, belgeler ve diğer medya dosyaları.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="all">Tüm tipler</option>
            <option value="IMAGE">Görsel</option>
            <option value="VIDEO">Video</option>
            <option value="DOCUMENT">Belge</option>
          </Select>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept={ALLOWED_TYPES.join(',')}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUploadChange(f);
            }}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4" /> {uploading ? 'Yükleniyor…' : 'Yükle'}
          </Button>
        </div>
      </div>

      {assetsQ.isLoading ? (
        <div className="rounded-md border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Yükleniyor…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          Henüz dosya yok. Üst sağdaki &quot;Yükle&quot; butonu ile ekleyin.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {rows.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onDelete={() => {
                if (confirm(`${asset.filename} silinsin mi?`)) {
                  deleteMut.mutate(asset.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetCard({
  asset,
  onDelete,
}: {
  asset: MediaAsset;
  onDelete: () => void;
}) {
  const { data } = useQuery({
    queryKey: ['media-signed-url', asset.id],
    queryFn: () => getMediaSignedUrl(asset.id),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="group relative overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="relative aspect-square bg-slate-100">
        {asset.kind === 'IMAGE' && data?.url ? (
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
        <button
          type="button"
          onClick={onDelete}
          className="absolute right-1 top-1 rounded bg-white/90 p-1 text-rose-600 opacity-0 shadow transition group-hover:opacity-100"
          aria-label="delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-0.5 p-2 text-xs">
        <div className="truncate font-medium text-slate-900" title={asset.filename}>
          {asset.filename}
        </div>
        <div className="text-slate-500">{formatDateTime(asset.createdAt)}</div>
      </div>
    </div>
  );
}
