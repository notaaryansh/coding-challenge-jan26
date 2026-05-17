import { create } from "zustand";
import type { FilterTrace, Fruit } from "./matching";

export interface LiveResult {
  kind: "live";
  source: Fruit;
  pool: Fruit[];
  pool_type: "apple" | "orange";
  trace: FilterTrace;
  /** Human-readable communication strings from the edge function. */
  prompt: {
    attributes: string;
    preferences: string;
  };
  match: {
    id: string;
    progress: "in_progress" | "matched";
    partner: Fruit | null;
  };
}

export interface TestResult {
  kind: "test";
  source: Fruit;
  pool: Fruit[];
  pool_type: "apple" | "orange";
  trace: FilterTrace;
}

export type VisualizationResult = LiveResult | TestResult;

interface VisualizationState {
  current: VisualizationResult | null;
  /** Active slide in the pipeline deck. Persisted across navigation so the
   *  user returns to the same step they were viewing. */
  activeIndex: number;
  setResult: (result: VisualizationResult) => void;
  setActiveIndex: (n: number) => void;
  clear: () => void;
}

export const useVisualization = create<VisualizationState>((set) => ({
  current: null,
  activeIndex: 0,
  setResult: (result) => set({ current: result, activeIndex: 0 }),
  setActiveIndex: (n) => set({ activeIndex: n }),
  clear: () => set({ current: null, activeIndex: 0 }),
}));
