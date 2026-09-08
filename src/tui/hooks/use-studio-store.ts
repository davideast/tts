import { useEffect, useState } from 'react';
import type { StudioAction, StudioState } from '../../studio/types.js';
import type { StudioStore } from '../../studio/studio-store.js';

export function useStudioStore(store: StudioStore): {
  state: StudioState;
  actions: StudioAction;
} {
  const [state, setState] = useState<StudioState>(() => store.getState());

  useEffect(() => {
    const unsubscribe = store.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, [store]);

  return {
    state,
    actions: store,
  };
}
