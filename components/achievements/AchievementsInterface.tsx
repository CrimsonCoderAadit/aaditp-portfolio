"use client";

import { useEffect } from "react";
import { useSceneTransition } from "../scene/SceneTransition";
import { ACHIEVEMENTS, CERTIFICATIONS, achievementById, type Achievement } from "../content/achievements";
import { PROJECTS, projectById, shortName } from "../content/projects";
import ContentIndex from "../content-ui/ContentIndex";
import DetailShell from "../content-ui/DetailShell";
import "./achievements.css";

const BRASS = "#d4b16a";
/** The workshops and certifications have no plinth; they are one more entry here. */
const CERTIFICATIONS_ID = "certifications";
const INDEX_ITEMS = [...ACHIEVEMENTS.map((entry) => ({ id: entry.id, accent: BRASS, label: entry.event })), { id: CERTIFICATIONS_ID, accent: BRASS, label: "Workshops & certifications" }];
const ENTRIES = INDEX_ITEMS.map((item) => ({ id: item.id, name: item.label }));

/** The readable layer of the Achievements section: the shared index, secondary
 * to the plaza's plinths, and the detail of the selected result. */
export default function AchievementsInterface() {
  const { detailId, selectDetail } = useSceneTransition();
  const entry = achievementById(detailId);
  const certifications = detailId === CERTIFICATIONS_ID;
  useEffect(() => { if (detailId && !entry && !certifications) selectDetail(null); }, [detailId, entry, certifications, selectDetail]);

  return <>
    <ContentIndex label="AWARDS" ariaLabel="Achievements" items={INDEX_ITEMS} />
    {(entry || certifications) && <DetailShell entries={ENTRIES} currentId={detailId!} noun="achievement" backLabel="Back to Achievements" labelledBy="achievement-detail-title" tone="achievements"
      onClose={() => selectDetail(null)} onSelect={selectDetail}>
      {entry ? <AchievementDetail entry={entry} /> : <CertificationsDetail />}
    </DetailShell>}
  </>;
}

/** A project whose own context names the event, for results the source leaves unlinked. */
function relatedProject(entry: Achievement) {
  if (entry.projectId) return null;
  const event = entry.event.toLowerCase();
  return PROJECTS.find((project) => project.context?.toLowerCase().startsWith(event)) ?? null;
}

function AchievementDetail({ entry }: { entry: Achievement }) {
  const { hop } = useSceneTransition();
  const project = projectById(entry.projectId);
  const related = relatedProject(entry);
  const number = ACHIEVEMENTS.indexOf(entry) + 1;
  return (
    <article key={entry.id} className="achievement-detail-grid">
      <aside className="achievement-identity">
        <Plinth rank={number} />
        <p className="achievement-result">{entry.result}</p>
        <h2 id="achievement-detail-title">{entry.event}</h2>
        <p className="achievement-year">{[entry.year, `Award ${String(number).padStart(2, "0")} of ${String(ACHIEVEMENTS.length).padStart(2, "0")}`].filter(Boolean).join(" · ")}</p>
      </aside>
      <div className="content-copy">
        <p className="content-summary">{entry.description}</p>
        {project && <>
          <section aria-labelledby="achievement-built">
            <h3 id="achievement-built">Built for it</h3>
            <button type="button" className="achievement-project" onClick={() => hop("projects", project.id)}>
              <strong>{shortName(project)} <span aria-hidden="true">→</span></strong><span>{project.summary}</span>
            </button>
          </section>
          {project.highlights.length > 0 && <section aria-labelledby="achievement-involved">
            <h3 id="achievement-involved">What it involved</h3>
            <ul className="content-highlights">{project.highlights.slice(0, 3).map((line) => <li key={line}>{line}</li>)}</ul>
          </section>}
          <section aria-labelledby="achievement-stack">
            <h3 id="achievement-stack">Technologies</h3>
            <ul className="content-stack">{project.technologies.map((tech) => <li key={tech}>{tech}</li>)}</ul>
          </section>
        </>}
        {related && <section aria-labelledby="achievement-related">
          <h3 id="achievement-related">Related work</h3>
          <button type="button" className="achievement-project" onClick={() => hop("projects", related.id)}>
            <strong>{shortName(related)} <span aria-hidden="true">→</span></strong><span>{[related.context, related.summary].filter(Boolean).join(" · ")}</span>
          </button>
        </section>}
      </div>
    </article>
  );
}

/** The plaza's plinth in brass line work, carrying the award's number. */
function Plinth({ rank }: { rank: number }) {
  return (
    <svg className="achievement-plinth" viewBox="0 0 72 60" aria-hidden="true">
      <path d="M26 20h20l-3 6H29zM24 8h24v12H24zM31 26h10v4H31z" />
      <path d="M14 30h44v8H14zM10 38h52v14H10zM6 52h60v4H6z" />
      <text x="36" y="49" textAnchor="middle">{String(rank).padStart(2, "0")}</text>
    </svg>
  );
}

function CertificationsDetail() {
  return (
    <article className="achievement-detail-grid">
      <aside className="achievement-identity">
        <h2 id="achievement-detail-title">Workshops &amp; certifications</h2>
      </aside>
      <div className="content-copy">
        <ul className="achievement-certifications">
          {CERTIFICATIONS.map((item) => <li key={item.name}><span>{item.name}</span>{(item.issuer || item.year) && <small>{[item.issuer, item.year].filter(Boolean).join(" · ")}</small>}</li>)}
        </ul>
      </div>
    </article>
  );
}
