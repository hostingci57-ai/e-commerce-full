/**
 * React 19 removed the legacy global `JSX` namespace. Re-alias it from
 * `React.JSX` so existing `JSX.Element` return types keep working.
 */
import type { JSX as ReactJSX } from 'react';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    type Element = ReactJSX.Element;
    type ElementType = ReactJSX.ElementType;
    type IntrinsicElements = ReactJSX.IntrinsicElements;
  }
}

export {};
