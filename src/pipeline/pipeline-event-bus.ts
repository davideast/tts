import type { PipelineEventMap } from '../types/events.js';

type Listener<T> = (data: T) => void;

export class UniversalEventBus {
  private readonly listeners = new Map<keyof PipelineEventMap, Set<Listener<any>>>();

  on<K extends keyof PipelineEventMap>(event: K, listener: Listener<PipelineEventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  off<K extends keyof PipelineEventMap>(event: K, listener: Listener<PipelineEventMap[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
    }
  }

  emit<K extends keyof PipelineEventMap>(event: K, data: PipelineEventMap[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of set) {
        listener(data);
      }
    }
  }
}
