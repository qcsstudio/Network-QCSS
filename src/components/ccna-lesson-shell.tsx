"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

type CcnaLessonShellProps = {
  children: ReactNode;
  outline: ReactNode;
  sources: ReactNode;
};

export function CcnaLessonShell({ children, outline, sources }: CcnaLessonShellProps) {
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOutlineOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOutlineOpen(false);
      window.setTimeout(() => restoreButtonRef.current?.focus(), 0);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOutlineOpen]);

  function closeOutline() {
    setIsOutlineOpen(false);
    window.setTimeout(() => restoreButtonRef.current?.focus(), 0);
  }

  function openOutline() {
    setIsOutlineOpen(true);
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
  }

  function closeAfterNavigation(event: MouseEvent<HTMLElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest('a[href^="#"]')) setIsOutlineOpen(false);
  }

  return (
    <div className={`ccna-lesson-layout ${isOutlineOpen ? "is-outline-open" : "is-outline-closed"}`}>
      <article className="ccna-lesson-article">{children}</article>

      <button
        aria-label="Close lesson outline"
        className="ccna-outline-backdrop"
        onClick={closeOutline}
        tabIndex={isOutlineOpen ? 0 : -1}
        type="button"
      />

      <aside aria-label="Lesson outline" className="ccna-lesson-sidebar" id="ccna-lesson-outline">
        <div className="ccna-outline-panel">
          <header>
            <strong>In this lesson</strong>
            <button
              aria-controls="ccna-lesson-outline"
              aria-expanded={isOutlineOpen}
              aria-label="Hide lesson outline"
              onClick={closeOutline}
              ref={closeButtonRef}
              title="Hide lesson outline"
              type="button"
            >
              <PanelRightClose aria-hidden="true" size={20} />
            </button>
          </header>
          <nav aria-label="Lesson contents" onClickCapture={closeAfterNavigation}>{outline}</nav>
        </div>
        <section><strong>Sources checked</strong>{sources}</section>
      </aside>

      <button
        aria-controls="ccna-lesson-outline"
        aria-expanded={isOutlineOpen}
        className="ccna-outline-restore"
        onClick={openOutline}
        ref={restoreButtonRef}
        title="Open lesson outline"
        type="button"
      >
        <PanelRightOpen aria-hidden="true" size={20} />
        <span>Lesson outline</span>
      </button>
    </div>
  );
}
