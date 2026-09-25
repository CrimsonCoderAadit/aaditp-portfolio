"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { hoverDetail, useHoveredDetail, useSceneTransition } from "../scene/SceneTransition";
import "./content.css";

export type IndexItem = { id: string; label: ReactNode; accent: string };

/** A section's secondary selector: a slim index along the bottom of the screen.
 * The district's physical models are the primary navigation; they and this
 * index share one `detailId` and one `hoveredDetailId`, so each highlights what
 * the other points at. */
export default function ContentIndex({ label, ariaLabel, items }: { label: string; ariaLabel: string; items: IndexItem[] }) {
  const { detailId, selectDetail } = useSceneTransition();
  const hoveredDetailId = useHoveredDetail();
  const open = items.some((item) => item.id === detailId);
  const lastOpened = useRef<string | null>(null);
  const indexRef = useRef<HTMLElement>(null);
  const entry = (id: string) => indexRef.current?.querySelector<HTMLButtonElement>(`[data-entry="${CSS.escape(id)}"]`);

  // Closing an entry returns focus to it in the index.
  useEffect(() => {
    if (open) { lastOpened.current = detailId; return; }
    const id = lastOpened.current;
    if (id) entry(id)?.focus({ preventScroll: true });
  }, [open, detailId]);
  // An entry pointed at in the scene comes into view on narrow screens.
  useEffect(() => {
    const id = hoveredDetailId ?? detailId;
    if (id) entry(id)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [hoveredDetailId, detailId]);
  const unhover = (id: string) => hoverDetail((current) => current === id ? null : current);

  return (
    <nav ref={indexRef} className="content-index" aria-label={ariaLabel} data-detail={open ? true : undefined}>
      <span className="content-index-label">{label} <b>{String(items.length).padStart(2, "0")}</b></span>
      <ul>
        {items.map((item) => <li key={item.id}>
          <button type="button" data-entry={item.id} data-active={hoveredDetailId === item.id ? true : undefined} aria-current={detailId === item.id ? "true" : undefined}
            style={{ "--accent": item.accent } as CSSProperties} onClick={() => selectDetail(item.id)}
            onPointerEnter={() => hoverDetail(item.id)} onPointerLeave={() => unhover(item.id)} onFocus={() => hoverDetail(item.id)} onBlur={() => unhover(item.id)}>{item.label}</button>
        </li>)}
      </ul>
    </nav>
  );
}
