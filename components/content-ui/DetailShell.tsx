"use client";

import { useEffect, useRef, type ReactNode } from "react";
import "./content.css";

type Entry = { id: string; name: string };

/** The detail panel every content section opens into: a back button to the
 * district, a stepper through the section's entries when there is more than
 * one, and a scrolling body that the section lays out itself. */
export default function DetailShell({ entries, currentId, noun, backLabel, labelledBy, tone, onClose, onSelect, children }: {
  entries: Entry[]; currentId: string; noun: string; backLabel: string; labelledBy: string;
  /** The section's colour identity, which its stylesheet keys on. */
  tone?: string;
  onClose: () => void; onSelect: (id: string) => void; children: ReactNode;
}) {
  const index = entries.findIndex((entry) => entry.id === currentId);
  const previous = entries[(index + entries.length - 1) % entries.length];
  const next = entries[(index + 1) % entries.length];
  const back = useRef<HTMLButtonElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => { back.current?.focus({ preventScroll: true }); }, []);
  // A new entry starts at its top.
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [currentId]);

  return (
    <section className="content-detail" data-tone={tone} role="dialog" aria-modal="false" aria-labelledby={labelledBy}>
      <header className="content-detail-bar">
        <button ref={back} type="button" className="content-back" onClick={onClose}><span aria-hidden="true">←</span> {backLabel}</button>
        {entries.length > 1 && <div className="content-stepper">
          <span aria-hidden="true">{String(index + 1).padStart(2, "0")} / {String(entries.length).padStart(2, "0")}</span>
          <button type="button" onClick={() => onSelect(previous.id)} aria-label={`Previous ${noun}: ${previous.name}`}><span aria-hidden="true">←</span></button>
          <button type="button" onClick={() => onSelect(next.id)} aria-label={`Next ${noun}: ${next.name}`}><span aria-hidden="true">→</span></button>
        </div>}
      </header>
      <div ref={scroller} className="content-detail-scroll" tabIndex={-1}>{children}</div>
    </section>
  );
}
