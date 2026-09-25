"use client";

import { useEffect } from "react";
import { useSceneTransition } from "../scene/SceneTransition";
import { CAREER, dateRange, experienceById, startYear, type ExperienceEntry } from "../content/experience";
import { isValidLink } from "../content/projects";
import ContentIndex from "../content-ui/ContentIndex";
import DetailShell from "../content-ui/DetailShell";
import "./experience.css";

/** Newest first, as the index and the timeline read. */
const LATEST_FIRST = [...CAREER].reverse();
const INDEX_ITEMS = LATEST_FIRST.map((entry) => ({ id: entry.id, accent: entry.accent, label: <><small>{startYear(entry)}</small>{entry.company}</> }));
const ENTRIES = LATEST_FIRST.map((entry) => ({ id: entry.id, name: entry.company }));
const LINK_LABELS: Record<ExperienceEntry["links"][number]["kind"], string> = { company: "Company", certificate: "View certificate", project: "Project", reference: "Reference" };

/** The readable layer of the Experience section: the shared index, secondary to
 * the tower's career floors, and the detail panel of the selected position. */
export default function ExperienceInterface() {
  const { detailId, selectDetail } = useSceneTransition();
  const entry = experienceById(detailId);
  // A deep link or stale address naming no real position closes it again.
  useEffect(() => { if (detailId && !entry) selectDetail(null); }, [detailId, entry, selectDetail]);

  return <>
    <ContentIndex label="CAREER" ariaLabel="Experience" items={INDEX_ITEMS} />
    {entry && <DetailShell entries={ENTRIES} currentId={entry.id} noun="position" backLabel="Back to Experience" labelledBy="experience-detail-title"
      onClose={() => selectDetail(null)} onSelect={selectDetail}>
      <ExperienceDetail entry={entry} onSelect={selectDetail} />
    </DetailShell>}
  </>;
}

function ExperienceDetail({ entry, onSelect }: { entry: ExperienceEntry; onSelect: (id: string) => void }) {
  const links = entry.links.filter((link) => isValidLink(link.href));
  const years = [...new Set(LATEST_FIRST.map(startYear))];
  return (
    <article key={entry.id} className="experience-detail-grid" style={{ "--accent": entry.accent } as React.CSSProperties}>
      <aside className="experience-facts">
        <h2 id="experience-detail-title">{entry.company}</h2>
        <p className="experience-role">{entry.role}</p>
        <dl>
          <div><dt>Dates</dt><dd>{dateRange(entry)}</dd></div>
          {entry.location && <div><dt>Location</dt><dd>{entry.location}</dd></div>}
        </dl>
        <nav className="experience-timeline" aria-label="Career timeline">
          <ol>
            {years.map((year) => <li key={year}>
              <span className="experience-year">{year}</span>
              <ol>
                {LATEST_FIRST.filter((item) => startYear(item) === year).map((item) => <li key={item.id}>
                  <button type="button" aria-current={item.id === entry.id ? "true" : undefined} style={{ "--accent": item.accent } as React.CSSProperties} onClick={() => onSelect(item.id)}>
                    <strong>{item.company}</strong><span>{item.role} · {dateRange(item)}</span>
                  </button>
                </li>)}
              </ol>
            </li>)}
          </ol>
        </nav>
      </aside>
      <div className="content-copy">
        <p className="content-summary">{entry.summary}</p>
        {links.length > 0 && <div className="content-links">
          {links.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
            {LINK_LABELS[link.kind]} <span aria-hidden="true">↗</span><span className="visually-hidden"> (opens in a new tab)</span>
          </a>)}
        </div>}
        {entry.highlights.length > 0 && <section aria-labelledby="experience-highlights">
          <h3 id="experience-highlights">Key contributions</h3>
          <ul className="content-highlights">{entry.highlights.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>}
        {entry.technologies.length > 0 && <section aria-labelledby="experience-stack">
          <h3 id="experience-stack">Technologies</h3>
          <ul className="content-stack">{entry.technologies.map((tech) => <li key={tech}>{tech}</li>)}</ul>
        </section>}
        <section aria-labelledby="experience-about">
          <h3 id="experience-about">About the role</h3>
          <div className="content-body">{entry.description.map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)}</div>
        </section>
      </div>
    </article>
  );
}
