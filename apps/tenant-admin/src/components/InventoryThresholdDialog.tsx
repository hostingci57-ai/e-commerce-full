'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, Button, Input, Label } from '@/components/ui';
import { updateInventoryThreshold, type InventoryLevelRow } from '@/lib/queries';

export function InventoryThresholdDialog({
  row,
  open,
  onClose,
}: {
  row: InventoryLevelRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [threshold, setThreshold] = useState<number>(5);

  useEffect(() => {
    if (open && row) setThreshold(row.lowStockThreshold);
  }, [open, row]);

  const mut = useMutation({
    mutationFn: ({ variantId, lowStockThreshold }: { variantId: string; lowStockThreshold: number }) =>
      updateInventoryThreshold(variantId, lowStockThreshold),
    onSuccess: () => {
      toast.success('Eşik güncellendi');
      qc.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi'),
  });

  if (!row) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Düşük Stok Eşiği"
      description={`${row.sku} — ${row.productTitle}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button
            onClick={() =>
              mut.mutate({ variantId: row.variantId, lowStockThreshold: threshold })
            }
            disabled={mut.isPending || threshold < 0}
          >
            Kaydet
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Mevcut uygun stok <span className="font-semibold">{row.available}</span>.
          Eşiğin altına indiğinde uyarı e-postası gönderilir.
        </p>
        <div>
          <Label>Eşik değeri</Label>
          <Input
            type="number"
            min={0}
            max={100000}
            value={threshold}
            onChange={(e) => setThreshold(Math.max(0, parseInt(e.target.value || '0', 10)))}
          />
        </div>
      </div>
    </Dialog>
  );
}
