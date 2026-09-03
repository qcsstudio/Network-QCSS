"use client";

import { ArrowRight, Monitor, RotateCcw, Send } from "lucide-react";
import { useState } from "react";

export function CcnaFirstPractice() {
  const [message, setMessage] = useState("");
  const [received, setReceived] = useState("");
  return (
    <form className="ccna-first-practice" onSubmit={(event) => { event.preventDefault(); setReceived(message.trim()); }}>
      <label htmlFor="ccna-practice-message">Practice message</label>
      <div className="ccna-practice-input-row">
        <input id="ccna-practice-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={80} autoComplete="off" placeholder="Hello network" />
        <button className="button primary" type="submit" disabled={!message.trim()}><Send size={17} aria-hidden="true" /> Send practice message</button>
        <button className="icon-button" type="button" title="Clear practice" aria-label="Clear practice" onClick={() => { setMessage(""); setReceived(""); }}><RotateCcw aria-hidden="true" size={18} /></button>
      </div>
      <div className="ccna-practice-message-path" aria-label="Message learning model">
        <span><Monitor size={25} aria-hidden="true" /> Your device</span><ArrowRight aria-hidden="true" size={22} /><div role="status" aria-live="polite"><strong>Received message</strong><p>{received || "No message yet."}</p></div>
      </div>
      <p className="ccna-practice-note">This is a learning model, not real network traffic. The text stays on this page.</p>
    </form>
  );
}
