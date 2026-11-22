import { useLayoutEffect, useState } from 'react';
import { logRendererError } from './errors';

export type ExplorerOrder = 'manual' | 'alphabetical';
const storageKey = 'textotheque:explorer-order:v1';

function readOrder(): ExplorerOrder {
  try {
    return localStorage.getItem(storageKey) === 'alphabetical' ? 'alphabetical' : 'manual';
  } catch (error) {
    logRendererError('read-explorer-order', error);
    return 'manual';
  }
}

export function useExplorerOrder(): ExplorerOrder {
  const [order, setOrder] = useState(readOrder);
  useLayoutEffect(() => window.textotheque?.onExplorerOrderChoice((choice) => {
    setOrder(choice);
    try {
      localStorage.setItem(storageKey, choice);
    } catch (error) {
      logRendererError('persist-explorer-order', error);
    }
  }), []);
  useLayoutEffect(() => {
    void window.textotheque?.setExplorerOrder(order).catch((error: unknown) => logRendererError('set-explorer-order', error));
  }, [order]);
  return order;
}
