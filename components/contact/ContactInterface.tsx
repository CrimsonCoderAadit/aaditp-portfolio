"use client";

import { useEffect, useRef, useState } from "react";
import { useSceneTransition } from "../scene/SceneTransition";
import { CONTACT_CHANNELS, EMAIL } from "../content/contact";
import DetailShell from "../content-ui/DetailShell";
import "./contact.css";

const ONLY = [{ id: "contact", name: "Contact" }];
const [MAIL, ...PROFILES] = CONTACT_CHANNELS;

/** Contact is the tower's communication console: one panel of real channels,
 * no form (there is nothing behind one to send it). Closing it leaves the
 * section. */
export default function ContactInterface() {
  const { leave } = useSceneTransition();
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const reset = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(reset.current), []);
  const canCopy = typeof navigator !== "undefined" && !!navigator.clipboard?.writeText;
  const copy = async () => {
    try { await navigator.clipboard.writeText(EMAIL); setCopied("yes"); } catch { setCopied("no"); }
    window.clearTimeout(reset.current);
    reset.current = window.setTimeout(() => setCopied(null), 2400);
  };

  return (
    <DetailShell entries={ONLY} currentId="contact" noun="page" backLabel="Back to City" labelledBy="contact-title" tone="contact" onClose={leave} onSelect={() => {}}>
      <article className="contact-console">
        <header>
          <p className="content-meta">Let&rsquo;s connect</p>
          <h2 id="contact-title">Open a channel.</h2>
          <p className="contact-invite">Get in touch by email or find my work across the profiles below.</p>
        </header>
        <p className="contact-route" aria-hidden="true">
          <span>You</span><i /><span>Contact tower</span><i /><span>Email · profiles</span>
        </p>
        <section className="contact-mail" aria-labelledby="contact-mail-label">
          <p id="contact-mail-label" className="contact-label">{MAIL.label}</p>
          <p className="contact-address">{MAIL.value}</p>
          <div className="contact-actions">
            <a className="contact-primary" href={MAIL.href}>{MAIL.action} <span aria-hidden="true">→</span></a>
            {canCopy && <button type="button" onClick={copy}>{copied === "yes" ? "Copied" : copied === "no" ? "Copy failed" : "Copy email"}</button>}
            <span className="visually-hidden" role="status">{copied === "yes" ? "Email address copied" : ""}</span>
          </div>
        </section>
        <ul className="contact-profiles" aria-label="Profiles">
          {PROFILES.map((channel) => <li key={channel.id}>
            <a href={channel.href} target="_blank" rel="noopener noreferrer">
              <span className="contact-label">{channel.label}</span>
              <span className="contact-value">{channel.value}</span>
              <span className="contact-arrow" aria-hidden="true">↗</span>
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          </li>)}
        </ul>
      </article>
    </DetailShell>
  );
}
