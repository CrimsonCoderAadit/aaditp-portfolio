"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useSceneTransition } from "../scene/SceneTransition";
import { isValidLink, linkLabel, PROJECTS, projectById, projectMeta, shortName, type Project } from "../content/projects";
import ContentIndex from "../content-ui/ContentIndex";
import DetailShell from "../content-ui/DetailShell";
import ProjectSchematic from "./ProjectSchematic";
import "./projects.css";

const INDEX_ITEMS = PROJECTS.map((project) => ({ id: project.id, label: shortName(project), accent: project.accent }));

/** The readable layer of the Projects section: the shared index, secondary to
 * the physical exhibits, and the detail panel of the selected project. */
export default function ProjectsInterface() {
  const { detailId, selectDetail } = useSceneTransition();
  const project = projectById(detailId);
  // A deep link or stale address naming no real project closes it again.
  useEffect(() => { if (detailId && !project) selectDetail(null); }, [detailId, project, selectDetail]);

  return <>
    <ContentIndex label="SELECTED WORK" ariaLabel="Projects" items={INDEX_ITEMS} />
    {project && <DetailShell entries={PROJECTS} currentId={project.id} noun="project" backLabel="Back to Projects" labelledBy="project-detail-title"
      onClose={() => selectDetail(null)} onSelect={selectDetail}>
      <ProjectDetail project={project} />
    </DetailShell>}
  </>;
}

function ProjectDetail({ project }: { project: Project }) {
  const links = project.links.filter((link) => isValidLink(link.href));
  // The chosen screenshot belongs to one project; any other starts on its first.
  const [picked, setPicked] = useState({ id: project.id, index: 0 });
  const shot = picked.id === project.id ? picked.index : 0;
  const setShot = (index: number) => setPicked({ id: project.id, index });

  return (
    <article key={project.id} className="project-detail-grid" style={{ "--accent": project.accent } as React.CSSProperties}>
      <figure className="project-visual">
        {project.media.length > 0 ? <>
          <Image src={project.media[shot].src} alt={project.media[shot].alt} width={project.media[shot].width} height={project.media[shot].height} sizes="(max-width: 900px) 100vw, 30vw" />
          {project.media.length > 1 && <div className="project-thumbs" role="group" aria-label="Screenshots">
            {project.media.map((media, i) => <button key={media.src} type="button" aria-pressed={i === shot} aria-label={`Show screenshot ${i + 1}: ${media.alt}`} onClick={() => setShot(i)}>
              <Image src={media.src} alt="" width={media.width} height={media.height} sizes="96px" />
            </button>)}
          </div>}
        </> : <>
          <ProjectSchematic project={project} />
          <figcaption>Schematic illustration · no screenshot available</figcaption>
        </>}
      </figure>
      <div className="content-copy">
        {projectMeta(project) && <p className="content-meta">{projectMeta(project)}</p>}
        <h2 id="project-detail-title">{project.name}</h2>
        <p className="content-summary">{project.summary}</p>
        {links.length > 0 && <div className="content-links">
          {links.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={link.kind === "demo" ? "is-primary" : undefined}>
            {linkLabel(link.kind)} <span aria-hidden="true">↗</span><span className="visually-hidden"> (opens in a new tab)</span>
          </a>)}
        </div>}
        {project.highlights.length > 0 && <section aria-labelledby="project-highlights">
          <h3 id="project-highlights">Highlights</h3>
          <ul className="content-highlights">{project.highlights.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>}
        {project.technologies.length > 0 && <section aria-labelledby="project-stack">
          <h3 id="project-stack">Technologies</h3>
          <ul className="content-stack">{project.technologies.map((tech) => <li key={tech}>{tech}</li>)}</ul>
        </section>}
        <section aria-labelledby="project-about">
          <h3 id="project-about">About the project</h3>
          <div className="content-body">{project.description.map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)}</div>
        </section>
      </div>
    </article>
  );
}
