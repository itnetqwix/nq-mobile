import { create } from "zustand";
import type { AnnotationTool } from "../features/calling/components/MeetingAnnotationToolbar";

const INITIAL = {
  tool: "freehand" as AnnotationTool,
  color: "#ff3b30",
  armed: false,
  toolbarOpen: false,
};

type MeetingAnnotationState = typeof INITIAL & {
  setTool: (tool: AnnotationTool) => void;
  setColor: (color: string) => void;
  setArmed: (armed: boolean) => void;
  setToolbarOpen: (open: boolean) => void;
  reset: () => void;
};

/** Live-lesson annotation chrome — keeps NativeMeetingScreen re-renders scoped. */
export const useMeetingAnnotationStore = create<MeetingAnnotationState>((set) => ({
  ...INITIAL,
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setArmed: (armed) => set({ armed }),
  setToolbarOpen: (toolbarOpen) => set({ toolbarOpen }),
  reset: () => set({ ...INITIAL }),
}));
