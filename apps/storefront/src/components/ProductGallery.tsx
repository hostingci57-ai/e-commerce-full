'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import type { ProductImage } from '@/lib/types';

export function ProductGallery({
  images,
  name,
}: {
  images: ProductImage[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  const main = images[active] ?? images[0];

  if (!main) {
    return (
      <div className="aspect-square w-full rounded-lg bg-slate-100" aria-hidden />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={main.url}
          alt={main.alt ?? name}
          className="h-full w-full object-cover"
        />
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              type="button"
              key={img.id}
              onClick={() => setActive(i)}
              className={clsx(
                'h-16 w-16 flex-shrink-0 overflow-hidden rounded border-2 bg-slate-100',
                i === active
                  ? 'border-brand-600'
                  : 'border-transparent hover:border-slate-300',
              )}
              aria-label={`Gorsel ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt ?? `${name} ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
