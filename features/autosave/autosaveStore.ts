"use client";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export interface AutosaveState {
  status: AutosaveStatus;
  lastSaved: Date | null;
}

type Listener = () => void;

let currentState: AutosaveState = {
  status: "idle",
  lastSaved: null
};

const listeners = new Set<Listener>();

export const autosaveStore = {
  getSnapshot(): AutosaveState {
    return currentState;
  },
  setStatus(status: AutosaveStatus, lastSaved: Date | null = currentState.lastSaved) {
    if (currentState.status === status && currentState.lastSaved === lastSaved) return;
    currentState = { status, lastSaved };
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error("AutosaveStore listener error:", err);
      }
    });
  },
  reset() {
    currentState = { status: "idle", lastSaved: null };
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {}
    });
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};
