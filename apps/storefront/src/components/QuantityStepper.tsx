'use client';

interface Props {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export function QuantityStepper({
  value,
  min = 1,
  max = 99,
  onChange,
  disabled,
}: Props) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div className="inline-flex items-center overflow-hidden rounded-md border border-slate-300">
      <button
        type="button"
        onClick={dec}
        disabled={disabled || value <= min}
        className="px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        aria-label="Azalt"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        readOnly
        className="w-12 border-x border-slate-200 bg-white px-2 py-1.5 text-center text-sm focus:outline-none"
      />
      <button
        type="button"
        onClick={inc}
        disabled={disabled || value >= max}
        className="px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        aria-label="Arttir"
      >
        +
      </button>
    </div>
  );
}
