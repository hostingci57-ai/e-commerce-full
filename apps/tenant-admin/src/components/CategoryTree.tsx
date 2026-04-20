'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  children?: CategoryNode[];
}

interface CategoryTreeProps {
  nodes: CategoryNode[];
  onSelect?: (node: CategoryNode) => void;
  renderRowActions?: (node: CategoryNode) => ReactNode;
}

export function CategoryTree({
  nodes,
  onSelect,
  renderRowActions,
}: CategoryTreeProps) {
  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
      {nodes.map((n) => (
        <TreeItem
          key={n.id}
          node={n}
          level={0}
          onSelect={onSelect}
          renderRowActions={renderRowActions}
        />
      ))}
    </ul>
  );
}

function TreeItem({
  node,
  level,
  onSelect,
  renderRowActions,
}: {
  node: CategoryNode;
  level: number;
  onSelect?: (n: CategoryNode) => void;
  renderRowActions?: (n: CategoryNode) => ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <li>
      <div
        className={clsx(
          'flex items-center gap-2 px-3 py-2 hover:bg-slate-50',
        )}
        style={{ paddingLeft: 12 + level * 20 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded p-0.5 hover:bg-slate-200"
            aria-label={open ? 'collapse' : 'expand'}
          >
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="inline-block h-4 w-4" />
        )}
        <button
          type="button"
          onClick={() => onSelect?.(node)}
          className="flex-1 truncate text-left text-sm text-slate-700 hover:text-brand-600"
        >
          {node.name}
        </button>
        <span className="text-xs text-slate-400">{node.slug}</span>
        {renderRowActions ? (
          <div className="flex items-center gap-1">{renderRowActions(node)}</div>
        ) : null}
      </div>
      {hasChildren && open ? (
        <ul className="divide-y divide-slate-100">
          {node.children!.map((c) => (
            <TreeItem
              key={c.id}
              node={c}
              level={level + 1}
              onSelect={onSelect}
              renderRowActions={renderRowActions}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
