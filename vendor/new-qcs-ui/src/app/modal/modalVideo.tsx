"use client";
import React, { useEffect, useState } from "react";

const ModalVideo = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);

  const onOpenModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  const onCloseModal = () => setOpen(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseModal();
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div>
      <div onClick={onOpenModal}>{children}</div>
      {open && (
        <div
          aria-modal="true"
          role="dialog"
          onClick={onCloseModal}
          style={{
            alignItems: "center",
            background: "rgba(0, 0, 0, 0.72)",
            display: "flex",
            inset: 0,
            justifyContent: "center",
            padding: "24px",
            position: "fixed",
            zIndex: 9999,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              background: "#000",
              borderRadius: "20px",
              maxWidth: "90vw",
              overflow: "hidden",
              padding: 0,
              position: "relative",
              width: "800px",
            }}
          >
            <button
              aria-label="Close video modal"
              onClick={onCloseModal}
              style={{
                alignItems: "center",
                background: "#fff",
                border: "none",
                borderRadius: "999px",
                color: "#111",
                cursor: "pointer",
                display: "flex",
                fontSize: "24px",
                height: "36px",
                justifyContent: "center",
                lineHeight: 1,
                position: "absolute",
                right: "10px",
                top: "10px",
                width: "36px",
                zIndex: 1,
              }}
              type="button"
            >
              ×
            </button>
            <div
              style={{
                height: 0,
                paddingBottom: "56.25%",
                position: "relative",
                width: "100%",
              }}
            >
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                src="https://www.youtube.com/embed/Q5PG0rMXgvw"
                style={{
                  border: "none",
                  height: "100%",
                  left: 0,
                  position: "absolute",
                  top: 0,
                  width: "100%",
                }}
                title="YouTube video player"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModalVideo;
