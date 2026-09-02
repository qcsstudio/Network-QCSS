"use client";

import { Check, Circle, RotateCcw } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

const storageKey = "qcs-ccna-completed-lessons";

function readProgress() {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function CcnaProgress({ slug }: { slug: string }) {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    window.addEventListener("qcs-ccna-progress", notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener("qcs-ccna-progress", notify);
    };
  }, []);
  const snapshot = useCallback(() => readProgress().includes(slug), [slug]);
  const completed = useSyncExternalStore(subscribe, snapshot, () => false);

  function toggle() {
    const progress = new Set(readProgress());
    if (progress.has(slug)) progress.delete(slug);
    else progress.add(slug);
    window.localStorage.setItem(storageKey, JSON.stringify([...progress]));
    window.dispatchEvent(new Event("qcs-ccna-progress"));
  }

  return (
    <button className={`ccna-complete-button ${completed ? "is-complete" : ""}`} onClick={toggle} type="button">
      {completed ? <Check aria-hidden="true" size={18} /> : <Circle aria-hidden="true" size={18} />}
      {completed ? "Lesson complete" : "Mark lesson complete"}
      {completed ? <RotateCcw aria-hidden="true" size={15} /> : null}
    </button>
  );
}
