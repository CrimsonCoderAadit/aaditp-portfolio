"use client";

import { Fragment, useEffect } from "react";
import { useSceneTransition } from "../scene/SceneTransition";
import { RESEARCH, researchById, researchLinkLabel, type Pipeline, type ResearchEntry } from "../content/research";
import { isValidLink } from "../content/projects";
import ContentIndex from "../content-ui/ContentIndex";
import DetailShell from "../content-ui/DetailShell";
import "./research.css";

const INDEX_ITEMS = RESEARCH.map((entry) => ({ id: entry.id, accent: entry.accent, label: <><small>{entry.year}</small>{entry.shortName}</> }));
const ENTRIES = RESEARCH.map((entry) => ({ id: entry.id, name: entry.shortName }));

/** The readable layer of the Research section: the shared index, secondary to
 * the lab's stations, and the detail panel of the selected publication. */
export default function ResearchInterface() {
  const { detailId, selectDetail } = useSceneTransition();
  const entry = researchById(detailId);
  // A deep link or stale address naming no real publication closes it again.
  useEffect(() => { if (detailId && !entry) selectDetail(null); }, [detailId, entry, selectDetail]);

  return <>
    <ContentIndex label="PUBLICATIONS" ariaLabel="Publications" items={INDEX_ITEMS} />
    {entry && <DetailShell entries={ENTRIES} currentId={entry.id} noun="publication" backLabel="Back to Research" labelledBy="research-detail-title"
      onClose={() => selectDetail(null)} onSelect={selectDetail}>
      <ResearchDetail entry={entry} />
    </DetailShell>}
  </>;
}

/** A paper's own pipeline, input to output, with side-by-side stages drawn as
 * parallel branches. */
function PipelineDiagram({ pipeline }: { pipeline: Pipeline }) {
  return (
    <figure className="research-pipeline">
      {pipeline.label && <figcaption>{pipeline.label}</figcaption>}
      <ol>
        {pipeline.stages.map((stage, i) => <Fragment key={i}>
          {i > 0 && <li className="research-arrow" aria-hidden="true" />}
          <li className={Array.isArray(stage) ? "research-branch" : i === pipeline.stages.length - 1 ? "research-output" : undefined}>
            {Array.isArray(stage) ? <ul aria-label="In parallel">{stage.map((part) => <li key={part}>{part}</li>)}</ul> : stage}
          </li>
        </Fragment>)}
      </ol>
    </figure>
  );
}

function ResearchDetail({ entry }: { entry: ResearchEntry }) {
  const links = entry.links.filter((link) => isValidLink(link.href));
  return (
    <article key={entry.id} className="research-detail-grid" style={{ "--accent": entry.accent } as React.CSSProperties}>
      <aside className="research-identity">
        <p className="content-meta">{entry.shortName} · {entry.year}</p>
        <h2 id="research-detail-title">{entry.title}</h2>
        <dl>
          <div><dt>Task</dt><dd>{entry.task}</dd></div>
          <div><dt>Venue</dt><dd>{entry.venue}</dd></div>
          <div><dt>Year</dt><dd>{entry.year}</dd></div>
          <div><dt>Authors</dt><dd><ol className="research-authors">{entry.authors.map((author) => <li key={author}>{author}</li>)}</ol></dd></div>
        </dl>
        {links.length > 0 && <div className="content-links">
          {links.map((link, i) => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={i === 0 ? "is-primary" : undefined}>
            {researchLinkLabel(link.kind)} <span aria-hidden="true">↗</span><span className="visually-hidden"> (opens in a new tab)</span>
          </a>)}
        </div>}
      </aside>
      <div className="content-copy">
        <p className="content-summary">{entry.summary}</p>
        <section aria-labelledby="research-problem">
          <h3 id="research-problem">Task</h3>
          <div className="content-body">{entry.problem.map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)}</div>
          {entry.data && <p className="research-data"><span>Data</span>{entry.data}</p>}
        </section>
        <section aria-labelledby="research-method">
          <h3 id="research-method">Methodology</h3>
          <div className="research-pipelines">{entry.pipelines.map((pipeline, i) => <PipelineDiagram key={i} pipeline={pipeline} />)}</div>
        </section>
        {entry.contributions.length > 0 && <section aria-labelledby="research-contributions">
          <h3 id="research-contributions">Contributions</h3>
          <ul className="content-highlights">{entry.contributions.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>}
        {entry.results.length > 0 && <section aria-labelledby="research-results">
          <h3 id="research-results">Results</h3>
          <dl className="research-results">
            {entry.results.map((result) => <div key={result.label}><dt>{result.label}</dt><dd>{result.value}</dd>{result.note && <dd className="research-result-note">{result.note}</dd>}</div>)}
          </dl>
          {entry.resultsNote && <p className="research-results-note">{entry.resultsNote}</p>}
        </section>}
        {entry.tools.length > 0 && <section aria-labelledby="research-tools">
          <h3 id="research-tools">Models &amp; tools</h3>
          <ul className="content-stack">{entry.tools.map((tool) => <li key={tool}>{tool}</li>)}</ul>
        </section>}
      </div>
    </article>
  );
}
