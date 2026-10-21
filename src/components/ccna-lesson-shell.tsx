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
  const initialAutoCloseTimerRef = useRef<number | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    initialAutoCloseTimerRef.current = window.setTimeout(() => {
      initialAutoCloseTimerRef.current = null;
      restoreFocusRef.current = Boolean(sidebarRef.current?.contains(document.activeElement));
      setIsOutlineOpen(false);
    }, 5000);

    return () => {
      if (initialAutoCloseTimerRef.current !== null) window.clearTimeout(initialAutoCloseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    const button = isOutlineOpen ? closeButtonRef.current : restoreButtonRef.current;
    button?.focus({ preventScroll: true });
  }, [isOutlineOpen]);

  useEffect(() => {
    if (!isOutlineOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      cancelInitialAutoClose();
      restoreFocusRef.current = true;
      setIsOutlineOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOutlineOpen]);

  function cancelInitialAutoClose() {
    if (initialAutoCloseTimerRef.current === null) return;
    window.clearTimeout(initialAutoCloseTimerRef.current);
    initialAutoCloseTimerRef.current = null;
  }

  function closeOutline() {
    cancelInitialAutoClose();
    restoreFocusRef.current = true;
    setIsOutlineOpen(false);
  }

  function openOutline() {
    cancelInitialAutoClose();
    restoreFocusRef.current = true;
    setIsOutlineOpen(true);
  }

  function closeAfterNavigation(event: MouseEvent<HTMLElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest('a[href^="#"]')) {
      cancelInitialAutoClose();
      setIsOutlineOpen(false);
    }
  }

  return (
    <div className={`ccna-lesson-layout ${isOutlineOpen ? "is-outline-open" : "is-outline-closed"}`}>
      <article className="ccna-lesson-article">{children}</article>

      <button
        aria-hidden={!isOutlineOpen}
        aria-label="Close lesson outline"
        className="ccna-outline-backdrop"
        onClick={closeOutline}
        tabIndex={isOutlineOpen ? 0 : -1}
        type="button"
      />

      <aside aria-hidden={!isOutlineOpen} aria-label="Lesson outline" className="ccna-lesson-sidebar" id="ccna-lesson-outline" inert={!isOutlineOpen} ref={sidebarRef}>
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
        aria-label="Open lesson outline"
        className="ccna-outline-restore"
        onClick={openOutline}
        ref={restoreButtonRef}
        tabIndex={isOutlineOpen ? -1 : 0}
        title="Open lesson outline"
        type="button"
      >
        <PanelRightOpen aria-hidden="true" size={20} />
      </button>
    </div>
  );
}
