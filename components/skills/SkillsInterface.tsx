"use client";

import { useEffect } from "react";
import { useSceneTransition } from "../scene/SceneTransition";
import { relatedWork, SKILL_CATEGORIES, skillCategoryById, usesOf, type SkillCategory, type SkillUse } from "../content/skills";
import ContentIndex from "../content-ui/ContentIndex";
import DetailShell from "../content-ui/DetailShell";
import "./skills.css";

const INDEX_ITEMS = SKILL_CATEGORIES.map((category) => ({ id: category.id, accent: category.accent, label: category.name }));
const ENTRIES = SKILL_CATEGORIES.map((category) => ({ id: category.id, name: category.name }));
const SECTION_NAMES = { projects: "Project", experience: "Internship", research: "Paper" } as const;
const PLURAL = { projects: "Projects", experience: "Internships", research: "Papers" } as const;

/** The readable layer of the Skills section: the shared index, secondary to
 * the workshop's bays, and the detail of the selected skill group. */
export default function SkillsInterface() {
  const { detailId, selectDetail } = useSceneTransition();
  const category = skillCategoryById(detailId);
  useEffect(() => { if (detailId && !category) selectDetail(null); }, [detailId, category, selectDetail]);

  return <>
    <ContentIndex label="WORKSHOP" ariaLabel="Skill groups" items={INDEX_ITEMS} />
    {category && <DetailShell entries={ENTRIES} currentId={category.id} noun="skill group" backLabel="Back to Skills" labelledBy="skills-detail-title" tone="skills"
      onClose={() => selectDetail(null)} onSelect={selectDetail}>
      <SkillsDetail category={category} />
    </DetailShell>}
  </>;
}

function SkillsDetail({ category }: { category: SkillCategory }) {
  const { hop } = useSceneTransition();
  const related = relatedWork(category);
  const shown = category.skills.filter((skill) => usesOf(skill).length > 0).length;
  const across = (["projects", "experience", "research"] as const)
    .map((section) => [section, related.filter((work) => work.section === section).length] as const)
    .filter(([, count]) => count > 0);
  const open = (use: SkillUse) => hop(use.section, use.id);
  return (
    <article key={category.id} className="skills-detail-grid" style={{ "--accent": category.accent } as React.CSSProperties}>
      <aside className="skills-identity">
        <p className="content-meta">Skill group</p>
        <h2 id="skills-detail-title">{category.name}</h2>
        <p className="skills-note">{category.note}</p>
        <dl className="skills-evidence">
          <div><dt>Skills</dt><dd>{category.skills.length}</dd></div>
          <div><dt>Seen in work</dt><dd>{shown} of {category.skills.length}</dd></div>
          {across.map(([section, count]) => <div key={section}><dt>{PLURAL[section]}</dt><dd>{count}</dd></div>)}
        </dl>
      </aside>
      <div className="content-copy">
        <h3 className="skills-list-title">Skills</h3>
        <ul className="skills-list">
          {category.skills.map((skill) => {
            const uses = usesOf(skill);
            return <li key={skill}>
              <span className="skills-name">{skill}</span>
              {uses.length > 0 ? <span className="skills-uses">
                <span className="visually-hidden">Used in: </span>
                {uses.map((use) => <button type="button" key={`${use.section}-${use.id}`} className="skills-use" onClick={() => open(use)}
                  aria-label={`${use.name}, ${SECTION_NAMES[use.section]}${use.via ? `, via ${use.via}` : ""}: open`}>
                  <small>{SECTION_NAMES[use.section]}</small>{use.name}{use.via && <em>via {use.via}</em>}
                </button>)}
              </span> : <span className="skills-unlisted">On the résumé; no work here lists it yet</span>}
            </li>;
          })}
        </ul>
        {related.length > 0 && <>
          <h3>Related work</h3>
          <ul className="skills-related">
            {related.map((work) => <li key={`${work.section}-${work.id}`}>
              <button type="button" onClick={() => open(work)}>
                <span className="skills-related-head"><small>{SECTION_NAMES[work.section]}</small><strong>{work.name}</strong><span aria-hidden="true">→</span></span>
                <span className="skills-related-summary">{work.summary}</span>
                <span className="skills-related-uses">{work.skills.join(" · ")}</span>
              </button>
            </li>)}
          </ul>
        </>}
        <p className="skills-evidence-note">A skill links to work whose technology list names it, or names a library or framework that can only be used through it, shown as “via”.</p>
      </div>
    </article>
  );
}
