"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useSceneTransition } from "../scene/SceneTransition";
import { ABOUT } from "../content/about";
import { CONTACT_CHANNELS } from "../content/contact";
import EscControl from "../room/EscControl";
import "../content-ui/content.css";
import "./about.css";

const LINKS = CONTACT_CHANNELS.filter((channel) => channel.id === "github" || channel.id === "linkedin");

/** Line drawings for the four interests, in the page's warm accent. */
const MOTIFS: Record<string, ReactNode> = {
  Chess: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M22 54h22M24 54c0-6 2-10 6-14-6 0-10-2-12-5l7-9c-2-4-1-9 3-12l3 3c6 1 11 7 11 16 0 8-3 14-3 21" />
      <path d="M20 58h26" /><circle cx="33" cy="22" r="1.4" />
    </svg>
  ),
  Flute: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M6 36 58 24M7 40l52-12" />
      <path d="M6 36l1 4M58 24l1 4M18 33.5l1 4M44 27.5l1 4" />
      <circle cx="24" cy="33.5" r="1.3" /><circle cx="29" cy="32.3" r="1.3" /><circle cx="34" cy="31.2" r="1.3" /><circle cx="39" cy="30" r="1.3" /><circle cx="50" cy="27.5" r="1.3" />
    </svg>
  ),
  Football: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="20" />
      <path d="M32 23l8 6-3 9h-10l-3-9z" />
      <path d="M32 23v-11M40 29l10-4M37 38l6 9M27 38l-6 9M24 29l-10-4" />
    </svg>
  ),
  Fiction: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M16 8h24l10 10v38H16z" /><path d="M40 8v10h10" />
      <path d="M22 26h20M22 32h22M22 38h18M22 44h12" />
      <path d="M46 52l8-18 3 1.5-8 18-4 2z" />
    </svg>
  ),
};

/** About is not a record to browse but a page to read: editorial type set
 * straight over the opened About home, with no panel behind it, only a soft
 * darkening of the scene on the reading side. The page scrolls; the room
 * behind it holds still. Closing it (or Escape) returns to the City. */
export default function AboutInterface() {
  const { leave } = useSceneTransition();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.focus({ preventScroll: true }); }, []);
  // Each section settles in as it first scrolls into view.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.setAttribute("data-seen", "");
      observer.unobserve(entry.target);
    }), { root, threshold: .15 });
    root.querySelectorAll(".about-section, .about-footer").forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="about-experience">
      <EscControl label="Back to city" onPress={leave} />
      <section className="about-reading" role="dialog" aria-modal="false" aria-labelledby="about-title">
        <div ref={scroller} className="about-scroll" tabIndex={-1}>
          <article className="about-page">
            <header className="about-hero">
              <p className="about-eyebrow">About</p>
              <h2 id="about-title">{ABOUT.name}</h2>
              <p className="about-standfirst">{ABOUT.standfirst}</p>
              <blockquote className="about-headline"><p>{ABOUT.headline}</p></blockquote>
            </header>

            <Section id="about-me" label="About me">
              <div className="about-prose">{ABOUT.intro.map((paragraph) => <p key={paragraph.slice(0, 32)}>{paragraph}</p>)}</div>
            </Section>

            <Section id="about-currently" label="Currently">
              <div className="about-study">
                <p className="about-study-degree">{ABOUT.education.degree}</p>
                <p className="about-study-place">{ABOUT.education.institution}</p>
                <dl>
                  <div><dt>Years</dt><dd>{ABOUT.education.years}</dd></div>
                  <div><dt>Grade</dt><dd>{ABOUT.education.grade}</dd></div>
                </dl>
              </div>
            </Section>

            <Section id="about-focus" label="What I’m interested in">
              <ol className="about-focus">{ABOUT.focus.map((area, i) => <li key={area}><span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>{area}</li>)}</ol>
            </Section>

            <Section id="about-beyond" label="Beyond code">
              <ul className="about-interests">
                {ABOUT.interests.map((interest) => (
                  <li key={interest.name}>
                    <span className="about-motif">{MOTIFS[interest.name]}</span>
                    <h4>{interest.name}</h4>
                    <p>{interest.line}</p>
                    {interest.link && <a href={interest.link.href} target="_blank" rel="noopener noreferrer">{interest.link.label} <span aria-hidden="true">↗</span><span className="visually-hidden"> (opens in a new tab)</span></a>}
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="about-longer" label="The longer version">
              <div className="about-prose about-longer">{ABOUT.longer.map((paragraph) => <p key={paragraph.slice(0, 32)}>{paragraph}</p>)}</div>
            </Section>

            <footer className="about-footer">
              <nav aria-label="Elsewhere">
                {LINKS.map((link) => <a key={link.id} href={link.href} target="_blank" rel="noopener noreferrer">{link.label} <span aria-hidden="true">↗</span><span className="visually-hidden"> (opens in a new tab)</span></a>)}
              </nav>
              <button type="button" className="about-close" onClick={leave}><span aria-hidden="true">←</span> Back to City</button>
            </footer>
          </article>
        </div>
      </section>
    </div>
  );
}

function Section({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <section className="about-section" aria-labelledby={id}>
      <h3 id={id}>{label}</h3>
      <div>{children}</div>
    </section>
  );
}
