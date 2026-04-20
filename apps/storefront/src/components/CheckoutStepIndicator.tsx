import { clsx } from 'clsx';

type Step = 'address' | 'shipping' | 'payment';

const STEPS: { key: Step; label: string }[] = [
  { key: 'address', label: 'Adres' },
  { key: 'shipping', label: 'Kargo' },
  { key: 'payment', label: 'Odeme' },
];

export function CheckoutStepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="mb-8 flex items-center gap-2 text-sm">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              className={clsx(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                done
                  ? 'bg-brand-600 text-white'
                  : active
                    ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-600'
                    : 'bg-slate-100 text-slate-500',
              )}
            >
              {i + 1}
            </span>
            <span
              className={clsx(
                'font-medium',
                active ? 'text-brand-700' : done ? 'text-slate-700' : 'text-slate-400',
              )}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="mx-2 h-px w-8 bg-slate-200" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
