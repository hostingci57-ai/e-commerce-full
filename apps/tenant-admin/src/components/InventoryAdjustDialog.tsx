'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, Button, Input, Label, Select, Textarea } from '@/components/ui';
import { adjustStock, type InventoryLevelRow } from '@/lib/queries';

const REASONS = [
  { value: 'manual_adjustment', label: 'Elle düzeltme' },
  { value: 'return', label: 'İade' },
  { value: 'damage', label: 'Hasar / fire' },
  { value: 'bulk_import', label: 'Toplu içe aktarım' },
  { value: 'other', label: 'Diğer' },
] as const;

export function InventoryAdjustDialog({
  row,
  open,
  onClose,
}: {
  row: InventoryLevelRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [sign, setSign] = useState<'+' | '-'>('+');
  const [amount, setAmount] = useState<number>(1);
  const [reason, setReason] = useState<string>('manual_adjustment');
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (open) {
      setSign('+');
      setAmount(1);
      setReason('manual_adjustment');
      setNote('');
    }
  }, [open]);

  const adjustMut = useMutation({
    mutationFn: adjustStock,
    onSuccess: () => {
      toast.success('Stok güncellendi');
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['inventory-movements'] });
      onClose();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi'),
  });

  if (!row) return null;

  const delta = sign === '-' ? -amount : amount;
  const projected = row.stockOnHand + delta;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Stok Düzelt"
      description={`${row.sku} — ${row.productTitle}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button
            onClick={() =>
              adjustMut.mutate({
                variantId: row.variantId,
                delta,
                reason,
                note: note || null,
              })
            }
            disabled={amount === 0 || projected < 0 || adjustMut.isPending}
          >
            Kaydet
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 rounded-md bg-slate-50 p-3 text-sm">
          <div>
            <div className="text-slate-500">Mevcut</div>
            <div className="font-semibold">{row.stockOnHand}</div>
          </div>
          <div>
            <div className="text-slate-500">Rezerve</div>
            <div className="font-semibold">{row.stockReserved}</div>
          </div>
          <div>
            <div className="text-slate-500">Sonrası</div>
            <div className={projected < 0 ? 'font-semibold text-red-600' : 'font-semibold'}>
              {projected}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Yön</Label>
            <Select value={sign} onChange={(e) => setSign(e.target.value as '+' | '-')}>
              <option value="+">Ekle (+)</option>
              <option value="-">Çıkar (−)</option>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Miktar</Label>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value || '0', 10)))}
            />
          </div>
        </div>
        <div>
          <Label>Sebep</Label>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Not (opsiyonel)</Label>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Düzeltme gerekçesi, referans..."
          />
        </div>
      </div>
    </Dialog>
  );
}
