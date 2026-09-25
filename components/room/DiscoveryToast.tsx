"use client";

import { useEffect, useState } from "react";
import { DISCOVERIES, useLatestDiscovery } from "./discovery";

const SHOW_MS = 1400;
const pad = (n: number) => String(n).padStart(2, "0");

/** A brief count when a hidden detail is found for the first time: small,
 * in a corner, and gone again in under two seconds. */
export default function DiscoveryToast() {
  const latest = useLatestDiscovery();
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!latest) return;
    const show = window.setTimeout(() => setShown(latest.count), 0);
    const hide = window.setTimeout(() => setShown(null), SHOW_MS);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [latest]);
  return <div className="discovery-toast" role="status" aria-live="polite" data-shown={shown !== null || undefined}>
    {shown !== null && <>Discovered {pad(shown)}/{pad(DISCOVERIES.length)}</>}
  </div>;
}
