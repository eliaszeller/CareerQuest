import { useState } from "react";
import characterSheet from "./assets/career-character-sheet-original.png";
import skiingCharacterSheet from "./assets/career-character-skiing-side-profile.png";
import resortMap from "./assets/careerquest-alpine-resort-map.png";

const journey = [
  { number: "01", label: "Build", text: "Turn your experiences, interests, and goals into an editable character." },
  { number: "02", label: "Explore", text: "Compare three plausible routes—including lower-cost and alternative options." },
  { number: "03", label: "Choose", text: "Play through real tradeoffs and see exactly how each decision changes your path." },
  { number: "04", label: "Act", text: "Leave with specific next-week actions and a longer-term roadmap." },
];

type View = "landing" | "onboarding" | "manual" | "resume" | "character" | "quest" | "paths" | "simulation" | "roadmap";
type Profession = "Military" | "Nurse" | "Firefighter" | "Corporate" | "Pilot";
type AvatarSelection = { profession: Profession; gender: "masculine" | "feminine" };
type QuestPlan = { goal: string; role: string; priorities: string[]; horizon: string; budget: string };
type PathChoice = { id: string; label: string };

type ResumeDraft = {
  name: string | null;
  education: string[];
  experience: string[];
  skills: string[];
  certifications: string[];
  projects: string[];
};

type ResumeResult = {
  filename: string;
  character_count: number;
  draft: ResumeDraft;
  message: string;
};

type EducationRecord = {
  institution: string;
  location?: string;
  degree?: string;
  date?: string;
  details: string[];
};

type ExperienceRecord = {
  company: string;
  location?: string;
  role?: string;
  date?: string;
  accomplishments: string[];
};

const ORGANIZATION_DOMAINS: Record<string, string> = {
  "university of colorado boulder - leeds school of business": "colorado.edu",
  "university of colorado boulder": "colorado.edu",
  "university of colorado colorado springs": "uccs.edu",
  "mike maroone automotive": "mikemaroonecolorado.com",
  "amazon": "amazon.com",
  "colorado national guard": "nationalguard.mil",
};

export function resolveOrganizationDomain(name: string): string | null {
  const normalized = name.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
  return ORGANIZATION_DOMAINS[normalized] ?? null;
}

function organizationInitials(name: string) {
  const meaningful = name.split(/\s+/).filter((word) => !/^(of|the|and|-)$/.test(word.toLowerCase()));
  return meaningful.slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "ORG";
}

function OrganizationLogo({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  const token = import.meta.env.VITE_LOGO_DEV_TOKEN?.trim();
  const domain = resolveOrganizationDomain(name);
  const identifier = domain || `name/${encodeURIComponent(name)}`;
  const source = token
    ? `https://img.logo.dev/${identifier}?token=${encodeURIComponent(token)}&size=96&format=png`
    : domain
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
      : null;

  if (!source || failed) return <span className="organization-fallback" aria-label={`${name} logo unavailable`}>{organizationInitials(name)}</span>;
  return <img className="organization-logo" src={source} alt={`${name} logo`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

export function groupEducation(values: string[]): EducationRecord[] {
  const records: EducationRecord[] = [];
  const institutionPattern = /\b(university|college|school|institute|academy)\b/i;
  const locationPattern = /^[A-Za-z .'-]+,\s*[A-Z]{2}$/;
  const degreePattern = /^(A[ASB]|B[AS]|M[AS]|MBA|MS|MA|MPH|PhD|EdD|JD|MD|DO|Certificate)\b/i;
  const datePattern = /^(expected\s+)?(?:spring|summer|fall|winter)?\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)?\s*\d{4}$/i;

  for (const value of values) {
    if (institutionPattern.test(value)) {
      records.push({ institution: value.replace(/[.,]+$/, ""), details: [] });
      continue;
    }
    const current = records.at(-1);
    if (!current) continue;
    if (!current.location && locationPattern.test(value)) current.location = value;
    else if (!current.degree && degreePattern.test(value)) current.degree = value;
    else if (!current.date && datePattern.test(value)) current.date = value.replace(/^Expected\s+/i, "Exp ");
    else current.details.push(value.replace(/^[*•]\s*/, ""));
  }
  return records;
}

function EducationReview({ values }: { values: string[] }) {
  const records = groupEducation(values);
  if (!records.length) return <p>Nothing confidently identified—add this manually during review.</p>;
  return (
    <div className="education-records">
      {records.map((record) => (
        <article key={`${record.institution}-${record.degree ?? "education"}`}>
          <p className="school-line"><strong>{record.institution}.</strong>{record.location && <> {record.location}</>}</p>
          {(record.degree || record.date) && <p className="degree-line">- {record.degree}{record.date && ` - ${record.date}`}</p>}
          {record.details.map((detail) => <p className="education-detail" key={detail}>* {detail}</p>)}
        </article>
      ))}
    </div>
  );
}

export function groupExperience(values: string[]): ExperienceRecord[] {
  const records: ExperienceRecord[] = [];
  const locationPattern = /^[A-Za-z .'-]+,\s*[A-Z]{2}$/;
  const datePattern = /(?:19|20)\d{2}|present/i;
  let index = 0;
  while (index < values.length) {
    if (index + 1 < values.length && locationPattern.test(values[index + 1])) {
      records.push({ company: values[index].replace(/[.,]+$/, ""), location: values[index + 1], accomplishments: [] });
      index += 2;
      continue;
    }
    const current = records.at(-1);
    if (!current) { index += 1; continue; }
    const value = values[index].replace(/^\uf0b7\s*/, "• ");
    if (!current.role && !value.startsWith("•") && !datePattern.test(value)) current.role = value;
    else if (!current.date && !value.startsWith("•") && datePattern.test(value)) current.date = value;
    else if (value.startsWith("•")) current.accomplishments.push(value.replace(/^•\s*/, ""));
    else if (current.accomplishments.length) current.accomplishments[current.accomplishments.length - 1] += ` ${value}`;
    else current.accomplishments.push(value);
    index += 1;
  }
  return records;
}

function ExperienceReview({ values }: { values: string[] }) {
  const records = groupExperience(values);
  const [showAllEmployers, setShowAllEmployers] = useState(false);
  if (!records.length) return <p>Nothing confidently identified—add this manually during review.</p>;
  const visibleRecords = showAllEmployers ? records : records.slice(0, 1);
  const hiddenEmployers = records.length - visibleRecords.length;
  return (
    <div className="experience-records">
      {visibleRecords.map((record) => <ExperienceCard key={`${record.company}-${record.role ?? "experience"}`} record={record} />)}
      {records.length > 1 && (
        <button className="employer-toggle" type="button" onClick={() => setShowAllEmployers(!showAllEmployers)} aria-expanded={showAllEmployers}>
          {showAllEmployers ? "Hide additional experience" : `View more experience (${hiddenEmployers} roles)`}
        </button>
      )}
    </div>
  );
}

function ExperienceCard({ record }: { record: ExperienceRecord }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? record.accomplishments : record.accomplishments.slice(0, 2);
  const hiddenCount = record.accomplishments.length - visible.length;
  return (
    <article>
      <p className="company-line"><strong>{record.company}</strong>{record.location && <> - {record.location}</>}</p>
      {record.role && <p className="role-line">{record.role}{record.date && <span> · {record.date}</span>}</p>}
      <ul>{visible.map((item) => <li key={item}>{item}</li>)}</ul>
      {record.accomplishments.length > 2 && (
        <button className="panel-toggle" type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </article>
  );
}

function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button className="brand brand-button" type="button" onClick={onClick} aria-label="CareerQuest home">
      <span className="brand-mark" aria-hidden="true">CQ</span>
      <span>CareerQuest</span>
    </button>
  );
}

function ResumeUpload({ onBack, onManual, onComplete }: { onBack: () => void; onManual: () => void; onComplete: (result: ResumeResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResumeResult | null>(null);

  const upload = async () => {
    if (!file || !consent) return;
    setStatus("uploading");
    setError("");
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/v1/resume/extract", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "The résumé could not be processed.");
      setResult(payload as ResumeResult);
      setStatus("done");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The résumé could not be processed.");
      setStatus("error");
    }
  };

  if (result) {
    const { name: _name, ...profileSections } = result.draft;
    const sections = Object.entries(profileSections) as [Exclude<keyof ResumeDraft, "name">, string[]][];
    return (
      <main id="main" className="builder-page">
        <button className="back-button" type="button" onClick={() => setResult(null)}>← Upload another résumé</button>
        <section className="review-panel">
          <p className="kicker">Review your character</p>
          <h1 className="builder-title">We found a starting point.</h1>
          <p className="success-message" role="status">✓ {result.message}</p>
          <div className="review-meta"><strong>{result.filename}</strong><span>{result.character_count.toLocaleString()} readable characters</span></div>
          <div className="review-sections">
            {sections.map(([name, values]) => (
              <section key={name}>
                <h2>{name === "skills" ? "Top 10 skills" : name.replace("_", " ")}</h2>
                {name === "education" ? <EducationReview values={values} /> : name === "experience" ? <ExperienceReview values={values} /> : values.length ? <ul className={name === "skills" ? "skills-grid" : undefined}>{values.map((value) => <li key={value}>{value}</li>)}</ul> : <p>Nothing confidently identified—add this manually during review.</p>}
              </section>
            ))}
          </div>
          <div className="review-warning"><strong>Draft only</strong><span>Review and edit these extracted facts before approving your character.</span></div>
          <button className="primary-button" type="button" onClick={() => onComplete(result)}>Complete my character →</button>
        </section>
      </main>
    );
  }

  return (
    <main id="main" className="builder-page">
      <button className="back-button" type="button" onClick={onBack}>← Back to options</button>
      <section className="upload-panel">
        <p className="kicker">Build from résumé</p>
        <h1 className="builder-title">Bring what you've already done.</h1>
        <p>Upload a résumé to create a draft profile. You will review everything before it becomes part of your character.</p>
        <div className="privacy-callout"><strong>Before you upload</strong><span>PDF, DOCX, or UTF-8 TXT · Maximum 5 MB · Temporary files are deleted immediately after processing. Remove sensitive details you do not want processed.</span></div>
        <label className="file-drop" htmlFor="resume-file">
          <span aria-hidden="true">↥</span>
          <strong>{file ? file.name : "Choose your résumé"}</strong>
          <small>{file ? `${(file.size / 1024).toFixed(1)} KB selected` : "PDF, DOCX, or TXT up to 5 MB"}</small>
        </label>
        <input className="visually-hidden" id="resume-file" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setStatus("idle"); setError(""); }} />
        <label className="consent-row">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>I understand the document will be processed into an editable draft and the temporary file will be deleted.</span>
        </label>
        {error && <p className="upload-error" role="alert">{error}</p>}
        <button className="primary-button upload-button" type="button" disabled={!file || !consent || status === "uploading"} onClick={upload}>{status === "uploading" ? "Processing securely…" : "Process my résumé →"}</button>
        <button className="text-button" type="button" onClick={onManual}>Build manually instead</button>
      </section>
    </main>
  );
}

function CharacterComplete({ result, initialAvatar, onEdit, onUseCharacter }: { result: ResumeResult; initialAvatar: AvatarSelection; onEdit: () => void; onUseCharacter: (avatar: AvatarSelection) => void }) {
  const name = result.draft.name || "Your character";
  const professions: Profession[] = ["Military", "Nurse", "Firefighter", "Corporate", "Pilot"];
  const [profession, setProfession] = useState<Profession>(initialAvatar.profession);
  const [gender, setGender] = useState<"masculine" | "feminine">(initialAvatar.gender);
  const education = groupEducation(result.draft.education).slice(0, 2);
  const experience = groupExperience(result.draft.experience).slice(0, 3);
  const spriteStyle = (item: (typeof professions)[number]) => {
    const column = professions.indexOf(item);
    return {
      backgroundImage: `url(${characterSheet})`,
      backgroundPosition: `${column * 25}% ${gender === "masculine" ? 0 : 100}%`,
    };
  };

  return (
    <main id="main" className="character-select-page">
      <div className="character-select-heading">
        <div><p className="kicker">Complete your character</p><h1>Choose your pathfinder.</h1></div>
        <div className="gender-select" role="group" aria-label="Character gender presentation">
          <button type="button" className={gender === "masculine" ? "active" : ""} onClick={() => setGender("masculine")}>Masculine</button>
          <button type="button" className={gender === "feminine" ? "active" : ""} onClick={() => setGender("feminine")}>Feminine</button>
        </div>
      </div>

      <section className="character-selector-shell">
        <aside className="profession-roster" aria-label="Choose a profession">
          <h2>Profession</h2>
          <div className="profession-grid">
            {professions.map((item) => (
              <button key={item} type="button" aria-pressed={profession === item} className={profession === item ? "selected" : ""} onClick={() => setProfession(item)}>
                <span className="profession-sprite" style={spriteStyle(item)} aria-hidden="true" />
                <strong>{item}</strong>
              </button>
            ))}
          </div>
        </aside>

        <section className="active-character" aria-live="polite">
          <div className="character-stage"><span className="active-sprite" style={spriteStyle(profession)} aria-hidden="true" /></div>
          <p className="character-name">{name}</p>
          <h2>{profession} Pathfinder</h2>
          <p>Choose the look that represents you. It won’t limit the careers you can explore.</p>
          <button className="primary-button" type="button" onClick={() => onUseCharacter({ profession, gender })}>Use this character →</button>
        </section>

        <aside className="resume-highlights">
          <p className="panel-eyebrow">Character profile</p>
          <h2>{name}</h2>
          <section>
            <h3>Education</h3>
            {education.length ? education.map((record) => (
              <div className="highlight-row" key={`${record.institution}-${record.degree}`}>
                <OrganizationLogo name={record.institution} />
                <div><strong>{record.degree || record.institution}</strong>{record.degree && <small>{record.institution}</small>}</div>
              </div>
            )) : <p>{name} · {result.draft.education[0] || "Education added during character setup"}</p>}
          </section>
          <section>
            <h3>Experience</h3>
            {experience.length ? experience.map((record) => (
              <div className="highlight-row" key={`${record.company}-${record.role}`}>
                <OrganizationLogo name={record.company} />
                <div><strong>{record.role || record.company}</strong>{record.role && <small>{record.company}</small>}</div>
              </div>
            )) : <p>{name} · Add experience as your journey grows</p>}
          </section>
          <div className="highlight-skills">{result.draft.skills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div>
        </aside>
      </section>

      <div className="character-select-footer">
        <button className="text-button" type="button" onClick={onEdit}>← Review résumé details</button>
        <span>Profession artwork is cosmetic—your options stay open.</span>
      </div>
    </main>
  );
}

const questOptions = [
  { id: "career", label: "Enter a career", icon: "↗" },
  { id: "promotion", label: "Earn a promotion", icon: "↑" },
  { id: "skills", label: "Use my skills", icon: "✦" },
  { id: "education", label: "More education", icon: "+" },
  { id: "industry", label: "Change industries", icon: "⇄" },
  { id: "business", label: "Start a business", icon: "◇" },
  { id: "income", label: "Reach a pay goal", icon: "$" },
  { id: "flexibility", label: "More flexibility", icon: "⌂" },
] as const;

function suggestedRoles(result: ResumeResult, profession: Profession) {
  const profile = [...result.draft.education, ...result.draft.skills, ...result.draft.experience].join(" ").toLowerCase();
  if (/analytics|data|python|sql|machine learning/.test(profile)) return ["Healthcare Data Analyst", "BI Analyst", "Operations Analytics Manager"];
  const byProfession: Record<Profession, string[]> = {
    Military: ["Operations Specialist", "Emergency Management Specialist", "Logistics Analyst"],
    Nurse: ["Registered Nurse", "Clinical Care Coordinator", "Healthcare Operations Analyst"],
    Firefighter: ["Firefighter", "Fire Inspector", "Emergency Management Specialist"],
    Corporate: ["Business Analyst", "Project Coordinator", "Operations Manager"],
    Pilot: ["Commercial Pilot", "Flight Operations Coordinator", "Aviation Safety Specialist"],
  };
  return byProfession[profession];
}

function QuestScreen({ result, avatar, onBack, onGenerate }: { result: ResumeResult; avatar: AvatarSelection; onBack: () => void; onGenerate: (plan: QuestPlan) => void }) {
  const roles = suggestedRoles(result, avatar.profession);
  const [quest, setQuest] = useState<(typeof questOptions)[number]["id"]>("career");
  const [role, setRole] = useState(roles[0]);
  const [customRole, setCustomRole] = useState("");
  const [priorities, setPriorities] = useState(["Advancement", "Income"]);
  const [horizon, setHorizon] = useState("1–2 yrs");
  const [budget, setBudget] = useState("<$1K");
  const prioritiesList = ["Stability", "Flexibility", "Creativity", "Advancement", "Income", "Social impact", "Work-life fit", "Learning"];
  const selectedQuest = questOptions.find((item) => item.id === quest)!;
  const targetRole = customRole.trim() || role;
  const avatarColumn = (["Military", "Nurse", "Firefighter", "Corporate", "Pilot"] as Profession[]).indexOf(avatar.profession);
  const avatarStyle = {
    backgroundImage: `url(${skiingCharacterSheet})`,
    backgroundPosition: `${avatarColumn * 25}% ${avatar.gender === "masculine" ? 0 : 100}%`,
  };
  const goalRoutes = [
    { id: "career", d: "M450 615 Q440 470 462 220" },
    { id: "promotion", d: "M450 615 Q620 450 795 125" },
    { id: "skills", d: "M450 615 Q600 500 735 265" },
    { id: "education", d: "M450 615 Q520 430 585 190" },
    { id: "industry", d: "M450 615 Q245 505 92 300" },
    { id: "business", d: "M450 615 Q250 430 165 150" },
    { id: "income", d: "M450 615 Q350 380 315 92" },
    { id: "flexibility", d: "M450 615 Q390 440 365 225" },
  ];

  const togglePriority = (item: string) => {
    setPriorities((current) => current.includes(item) ? current.filter((value) => value !== item) : current.length < 3 ? [...current, item] : current);
  };

  return (
    <main id="main" className="quest-page">
      <div className="quest-heading-row">
        <div><p className="kicker">Step 2 · Quest</p><h1>Choose your quest.</h1></div>
        <ol className="quest-progress" aria-label="CareerQuest progress">
          <li className="complete">✓ Character</li><li className="active">Quest</li><li>Paths</li><li>Simulation</li><li>Roadmap</li>
        </ol>
      </div>

      <div className="quest-workspace">
        <section className="quest-map" aria-labelledby="quest-map-title">
          <img className="resort-map-art" src={resortMap} alt="" aria-hidden="true" />
          <div className="resort-map-shade" aria-hidden="true" />
          <div className="resort-map-header"><span id="quest-map-title">CareerQuest Alpine</span><small>8 summits · Choose your ascent</small></div>
          <svg className="goal-route-lines" viewBox="0 0 900 650" preserveAspectRatio="none" aria-hidden="true">
            {goalRoutes.map((route) => <path key={route.id} className={quest === route.id ? "active" : ""} d={route.d} />)}
          </svg>
          <div className="quest-nodes">
            {questOptions.map((item, index) => (
              <button key={item.id} type="button" className={`quest-node quest-node-${index + 1} ${quest === item.id ? "selected" : ""}`} aria-pressed={quest === item.id} onClick={() => setQuest(item.id)}>
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
          <div className="quest-avatar-stage" aria-label={`${result.draft.name || "Your"} ${avatar.profession} character`}>
            <span className="quest-avatar-sprite" style={avatarStyle} aria-hidden="true" />
            <span className="avatar-marker"><strong>{result.draft.name || "You"}</strong><small>{avatar.profession} Pathfinder</small></span>
          </div>
          <div className="basecamp-label"><strong>BASECAMP</strong><span>All lifts begin here</span></div>
        </section>

        <aside className="quest-controls">
          <p className="panel-eyebrow">{result.draft.name || "Your"}’s trail</p>
          <h2>{selectedQuest.label}</h2>
          <p className="quest-summary">Build a practical route toward <strong>{targetRole}</strong> over the next {horizon}.</p>

          <fieldset><legend>Target role</legend><div className="choice-chips">{roles.map((item) => <button key={item} type="button" className={role === item && !customRole ? "selected" : ""} onClick={() => { setRole(item); setCustomRole(""); }}>{item}</button>)}</div>
            <input aria-label="Custom target role" placeholder="Or type your own…" value={customRole} onChange={(event) => setCustomRole(event.target.value)} />
            <small>Suggested from your character profile. Starting points, not limits.</small>
          </fieldset>

          <fieldset><legend>Top priorities <span>{priorities.length} of 3</span></legend><div className="choice-chips priorities">{prioritiesList.map((item) => <button key={item} type="button" className={priorities.includes(item) ? "selected" : ""} aria-pressed={priorities.includes(item)} onClick={() => togglePriority(item)}>{item}</button>)}</div></fieldset>
          <fieldset><legend>Time horizon</legend><div className="segmented-control">{["6 mo", "1–2 yrs", "3–5 yrs", "5+ yrs"].map((item) => <button key={item} type="button" className={horizon === item ? "selected" : ""} onClick={() => setHorizon(item)}>{item}</button>)}</div></fieldset>
          <fieldset><legend>Training budget</legend><div className="segmented-control">{["<$1K", "$1–5K", "$5K+", "Not sure"].map((item) => <button key={item} type="button" className={budget === item ? "selected" : ""} onClick={() => setBudget(item)}>{item}</button>)}</div></fieldset>
        </aside>
      </div>

      <div className="quest-footer"><button className="text-button" type="button" onClick={onBack}>← Back to character</button><button className="primary-button" type="button" onClick={() => onGenerate({ goal: selectedQuest.label, role: targetRole, priorities, horizon, budget })}>Generate my 3 paths →</button></div>
    </main>
  );
}

function PathsScreen({ result, plan, onBack, onContinue }: { result: ResumeResult; plan: QuestPlan; onBack: () => void; onContinue: (path: PathChoice) => void }) {
  const [selected, setSelected] = useState("direct");
  const knownSkills = result.draft.skills.slice(0, 3);
  const pathOptions = [
    { id: "direct", number: "01", label: "Direct ascent", tag: "Fastest", time: plan.horizon === "6 mo" ? "3–6 months" : "6–12 months", cost: plan.budget, fit: 88, salary: "$72K–$98K", description: `Position your current experience directly for ${plan.role} opportunities.`, skills: knownSkills.length ? knownSkills : ["Communication", "Analysis", "Project work"], actions: ["Rewrite résumé around measurable outcomes", `Build a targeted ${plan.role} portfolio case`, "Apply to 5 aligned roles each week"] },
    { id: "skills", number: "02", label: "Skills traverse", tag: "Best fit", time: "9–18 months", cost: plan.budget === "<$1K" ? "$500–$1K" : plan.budget, fit: 94, salary: "$82K–$112K", description: `Close the strongest skill gaps before moving into ${plan.role}.`, skills: ["Advanced analytics", "Industry tools", "Stakeholder storytelling"], actions: ["Complete one focused credential", "Ship two applied portfolio projects", "Find a mentor in the target field"] },
    { id: "bridge", number: "03", label: "Bridge route", tag: "Lower risk", time: "12–24 months", cost: "Low", fit: 84, salary: "$68K–$105K", description: `Move through an adjacent role that builds credibility toward ${plan.role}.`, skills: ["Transferable skills", "Domain knowledge", "Leadership"], actions: ["Target adjacent internal roles", "Lead a cross-functional project", "Build target-industry relationships"] },
  ];

  return <main id="main" className="paths-page">
    <div className="paths-heading-row"><div><p className="kicker">Step 3 · Paths</p><h1>Three ways up.</h1><p>Built for {result.draft.name || "you"} around <strong>{plan.role}</strong>, {plan.priorities.join(" and ").toLowerCase() || "your priorities"}.</p></div><ol className="quest-progress"><li className="complete">✓ Character</li><li className="complete">✓ Quest</li><li className="active">Paths</li><li>Simulation</li><li>Roadmap</li></ol></div>
    <section className="path-cards" aria-label="Generated career paths">
      {pathOptions.map((path) => <button key={path.id} type="button" className={`path-option ${selected === path.id ? "selected" : ""}`} onClick={() => setSelected(path.id)}>
        <div className="path-card-top"><span>{path.number}</span><i>{path.tag}</i></div><h2>{path.label}</h2><p>{path.description}</p>
        <div className="path-metrics"><span><small>Time</small><strong>{path.time}</strong></span><span><small>Cost</small><strong>{path.cost}</strong></span><span><small>Fit</small><strong>{path.fit}%</strong></span><span><small>Outlook</small><strong>{path.salary}</strong></span></div>
        <div className="path-detail"><h3>Skills to strengthen</h3><div>{path.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><h3>First moves</h3><ol>{path.actions.map((action) => <li key={action}>{action}</li>)}</ol></div>
        <span className="select-path">{selected === path.id ? "✓ Selected" : "Choose this path"}</span>
      </button>)}
    </section>
    <div className="quest-footer"><button className="text-button" type="button" onClick={onBack}>← Refine my quest</button><button className="primary-button" type="button" onClick={() => { const path = pathOptions.find((item) => item.id === selected)!; onContinue({ id: path.id, label: path.label }); }}>Continue to simulation →</button></div>
  </main>;
}

type Impact = { growth: number; income: number; flexibility: number; stability: number };
const simulationScenarios = [
  { title: "The stretch opportunity", context: "Your manager offers you ownership of a high-visibility project. It could accelerate your move, but the deadline overlaps with the course you planned to finish.", choices: [
    { label: "Take full ownership", detail: "Prioritize visibility and learn on the job.", impact: { growth: 3, income: 2, flexibility: -2, stability: 0 }, feedback: "You gain executive exposure and a strong résumé story, but your schedule tightens." },
    { label: "Co-lead the project", detail: "Share delivery while protecting learning time.", impact: { growth: 2, income: 1, flexibility: 1, stability: 2 }, feedback: "You build credibility with less burnout risk, though recognition is shared." },
    { label: "Finish the credential", detail: "Decline and keep the original development plan.", impact: { growth: 1, income: 0, flexibility: 2, stability: 3 }, feedback: "You protect momentum on your credential, but delay a visible leadership opportunity." },
  ]},
  { title: "The offer tradeoff", context: "An adjacent-role offer arrives sooner than expected. It pays more now, but the work is less directly connected to your target role.", choices: [
    { label: "Accept the offer", detail: "Take the immediate income and build from inside.", impact: { growth: 1, income: 3, flexibility: 0, stability: 2 }, feedback: "Your financial position improves and you gain access, but the route becomes less direct." },
    { label: "Negotiate the scope", detail: "Ask for target-role projects and development support.", impact: { growth: 3, income: 2, flexibility: 1, stability: 1 }, feedback: "You create a stronger bridge role and demonstrate clear career intent." },
    { label: "Keep searching", detail: "Hold out for stronger alignment.", impact: { growth: 2, income: -1, flexibility: 2, stability: -1 }, feedback: "You preserve alignment, while accepting more short-term uncertainty." },
  ]},
  { title: "The sustainability test", context: "Three months into your route, the workload is working—but it is starting to crowd out recovery, relationships, and other priorities.", choices: [
    { label: "Push through", detail: "Maintain pace until the next milestone.", impact: { growth: 3, income: 2, flexibility: -3, stability: -1 }, feedback: "Progress accelerates, but the path becomes harder to sustain." },
    { label: "Reduce the scope", detail: "Keep the goal while extending the timeline.", impact: { growth: 1, income: 0, flexibility: 3, stability: 2 }, feedback: "The route slows slightly and becomes much more sustainable." },
    { label: "Ask for support", detail: "Use mentors, peers, or your manager to rebalance.", impact: { growth: 2, income: 1, flexibility: 2, stability: 3 }, feedback: "You preserve momentum and create a stronger support system." },
  ]},
];

function SimulationScreen({ result, plan, path, onBack, onRoadmap }: { result: ResumeResult; plan: QuestPlan; path: PathChoice; onBack: () => void; onRoadmap: () => void }) {
  const [round, setRound] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [scores, setScores] = useState<Impact>({ growth: 50, income: 50, flexibility: 50, stability: 50 });
  const [history, setHistory] = useState<string[]>([]);
  const complete = round >= simulationScenarios.length;
  const scenario = simulationScenarios[Math.min(round, simulationScenarios.length - 1)];

  const choose = (index: number) => {
    if (selectedChoice !== null) return;
    const choice = scenario.choices[index];
    setSelectedChoice(index);
    setScores((current) => ({ growth: current.growth + choice.impact.growth * 5, income: current.income + choice.impact.income * 5, flexibility: current.flexibility + choice.impact.flexibility * 5, stability: current.stability + choice.impact.stability * 5 }));
    setHistory((current) => [...current, choice.label]);
  };
  const next = () => { setRound((current) => current + 1); setSelectedChoice(null); };

  return <main id="main" className="simulation-page">
    <div className="simulation-heading"><div><p className="kicker">Step 4 · Simulation</p><h1>Test your route.</h1><p>{result.draft.name || "Your"} · {path.label} toward <strong>{plan.role}</strong></p></div><ol className="quest-progress"><li className="complete">✓ Character</li><li className="complete">✓ Quest</li><li className="complete">✓ Paths</li><li className="active">Simulation</li><li>Roadmap</li></ol></div>
    <div className="simulation-layout">
      <section className="scenario-panel">
        {!complete ? <>
          <div className="scenario-progress"><span>Decision {round + 1} of {simulationScenarios.length}</span><progress value={round + 1} max={simulationScenarios.length}>{round + 1} of 3</progress></div>
          <p className="scenario-label">Career moment</p><h2>{scenario.title}</h2><p className="scenario-context">{scenario.context}</p>
          <div className="decision-list">{scenario.choices.map((choice, index) => <button key={choice.label} type="button" className={selectedChoice === index ? "selected" : ""} disabled={selectedChoice !== null} onClick={() => choose(index)}><span>{String.fromCharCode(65 + index)}</span><div><strong>{choice.label}</strong><small>{choice.detail}</small></div></button>)}</div>
          {selectedChoice !== null && <div className="decision-feedback" role="status"><strong>What changes</strong><p>{scenario.choices[selectedChoice].feedback}</p><button className="primary-button" type="button" onClick={next}>{round === simulationScenarios.length - 1 ? "See my results →" : "Next decision →"}</button></div>}
        </> : <div className="simulation-results"><p className="scenario-label">Simulation complete</p><h2>Your route has a shape.</h2><p>Your decisions favored <strong>{Object.entries(scores).sort((a,b) => b[1] - a[1])[0][0]}</strong>. This is not a prediction—it shows the tradeoffs your choices consistently prioritized.</p><div className="decision-recap">{history.map((item, index) => <span key={item}><b>{index + 1}</b>{item}</span>)}</div><button className="primary-button" type="button" onClick={onRoadmap}>View my roadmap →</button></div>}
      </section>
      <aside className="impact-panel"><p className="panel-eyebrow">Live impact</p><h2>Your tradeoff profile</h2>{Object.entries(scores).map(([label, value]) => <div className="impact-row" key={label}><div><span>{label}</span><strong>{value}</strong></div><progress value={Math.max(0, Math.min(100, value))} max="100">{value}</progress></div>)}<div className="route-summary"><small>Selected route</small><strong>{path.label}</strong><span>{plan.role}</span></div><p>Scores show relative emphasis inside this simulation—not guaranteed outcomes.</p></aside>
    </div>
    <div className="quest-footer"><button className="text-button" type="button" onClick={onBack}>← Back to paths</button><button className="primary-button" type="button" onClick={onRoadmap}>View roadmap →</button></div>
  </main>;
}

function RoadmapScreen({ result, plan, path, onBack }: { result: ResumeResult; plan: QuestPlan; path: PathChoice; onBack: () => void }) {
  const [done, setDone] = useState<string[]>([]);
  const milestones = [
    { phase: "Next 7 days", title: "Set your basecamp", items: [`Rewrite your headline toward ${plan.role}`, "Save five representative job descriptions", "Choose one person to ask for perspective"] },
    { phase: "Days 8–30", title: "Build visible proof", items: [`Create one ${plan.role} portfolio case`, `Strengthen ${result.draft.skills[0] || "one core technical skill"}`, "Schedule two informational conversations"] },
    { phase: "Days 31–60", title: "Test the market", items: ["Tailor your résumé to the target role", "Practice three achievement stories", "Apply to five high-fit opportunities each week"] },
    { phase: "Days 61–90", title: "Choose with evidence", items: ["Review interview and application signals", "Compare offers against your top priorities", "Adjust the route without abandoning the goal"] },
  ];
  const total = milestones.reduce((sum, phase) => sum + phase.items.length, 0);
  const toggle = (item: string) => setDone((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  return <main id="main" className="roadmap-page">
    <div className="roadmap-heading"><div><p className="kicker">Step 5 · Roadmap</p><h1>Your next 90 days.</h1><p>{result.draft.name || "Your"} · {path.label} toward <strong>{plan.role}</strong></p></div><ol className="quest-progress"><li className="complete">✓ Character</li><li className="complete">✓ Quest</li><li className="complete">✓ Paths</li><li className="complete">✓ Simulation</li><li className="active">Roadmap</li></ol></div>
    <section className="roadmap-summary"><div><span>Goal</span><strong>{plan.role}</strong></div><div><span>Route</span><strong>{path.label}</strong></div><div><span>Horizon</span><strong>{plan.horizon}</strong></div><div><span>Progress</span><strong>{done.length} of {total}</strong></div></section>
    <section className="roadmap-timeline">{milestones.map((milestone, phaseIndex) => <article key={milestone.phase}><div className="timeline-marker">{phaseIndex + 1}</div><p>{milestone.phase}</p><h2>{milestone.title}</h2><div>{milestone.items.map((item) => <label key={item} className={done.includes(item) ? "complete" : ""}><input type="checkbox" checked={done.includes(item)} onChange={() => toggle(item)} /><span>{item}</span></label>)}</div></article>)}</section>
    <div className="quest-footer"><button className="text-button" type="button" onClick={onBack}>← Back to simulation</button><button className="primary-button" type="button" onClick={() => window.print()}>Print my roadmap</button></div>
  </main>;
}

function ManualCharacterBuilder({ onBack, onComplete }: { onBack: () => void; onComplete: (result: ResumeResult) => void }) {
  const [name, setName] = useState("");
  const [stage, setStage] = useState("");
  const stages = ["High school", "College", "Graduate or professional school", "Workforce"];
  const ready = name.trim().length > 0 && stage.length > 0;

  const continueToCharacter = () => {
    if (!ready) return;
    onComplete({
      filename: "Manual profile",
      character_count: 0,
      message: "Your manually entered profile is ready.",
      draft: {
        name: name.trim(),
        education: [stage],
        experience: [],
        skills: [],
        certifications: [],
        projects: [],
      },
    });
  };

  return (
    <main id="main" className="builder-page">
      <button className="back-button" type="button" onClick={onBack}>← Back to options</button>
      <div className="builder-layout">
        <aside>
          <p className="kicker">Character builder</p>
          <h1 className="builder-title">Tell us where you're starting.</h1>
          <p>This first step creates a draft. You’ll review and edit everything before it is used.</p>
        </aside>
        <form className="starter-form" onSubmit={(event) => { event.preventDefault(); continueToCharacter(); }}>
          <div className="form-progress"><span>Step 1 of 4</span><progress value="1" max="4">25%</progress></div>
          <label htmlFor="character-name">What should we call your character?</label>
          <input id="character-name" name="character-name" autoComplete="nickname" placeholder="Enter a name" value={name} onChange={(event) => setName(event.target.value)} />
          <fieldset>
            <legend>Where are you right now?</legend>
            <div className="option-grid">
              {stages.map((option) => (
                <label className="radio-card" key={option}>
                  <input type="radio" name="life-stage" value={option} checked={stage === option} onChange={() => setStage(option)} />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="primary-button form-next" type="submit" disabled={!ready}>Continue →</button>
          {!ready && <p className="form-note">Complete the name and life-stage fields to continue.</p>}
        </form>
      </div>
    </main>
  );
}

function Onboarding({ view, onBack, onSelect, resumeResult, avatar, questPlan, pathChoice, onAvatarSelect, onGeneratePaths, onChoosePath, onResumeComplete }: { view: View; onBack: () => void; onSelect: (view: View) => void; resumeResult: ResumeResult | null; avatar: AvatarSelection; questPlan: QuestPlan | null; pathChoice: PathChoice | null; onAvatarSelect: (avatar: AvatarSelection) => void; onGeneratePaths: (plan: QuestPlan) => void; onChoosePath: (path: PathChoice) => void; onResumeComplete: (result: ResumeResult) => void }) {
  if (view === "roadmap" && resumeResult && questPlan && pathChoice) {
    return <RoadmapScreen result={resumeResult} plan={questPlan} path={pathChoice} onBack={() => onSelect("simulation")} />;
  }
  if (view === "simulation" && resumeResult && questPlan && pathChoice) {
    return <SimulationScreen result={resumeResult} plan={questPlan} path={pathChoice} onBack={() => onSelect("paths")} onRoadmap={() => onSelect("roadmap")} />;
  }
  if (view === "paths" && resumeResult && questPlan) {
    return <PathsScreen result={resumeResult} plan={questPlan} onBack={() => onSelect("quest")} onContinue={onChoosePath} />;
  }
  if (view === "quest" && resumeResult) {
    return <QuestScreen result={resumeResult} avatar={avatar} onBack={() => onSelect("character")} onGenerate={onGeneratePaths} />;
  }
  if (view === "character" && resumeResult) {
    return <CharacterComplete result={resumeResult} initialAvatar={avatar} onEdit={() => onSelect("resume")} onUseCharacter={onAvatarSelect} />;
  }
  if (view === "manual") {
    return <ManualCharacterBuilder onBack={() => onSelect("onboarding")} onComplete={onResumeComplete} />;
  }

  if (view === "resume") {
    return <ResumeUpload onBack={() => onSelect("onboarding")} onManual={() => onSelect("manual")} onComplete={onResumeComplete} />;
  }

  return (
    <main id="main" className="onboarding-page">
      <button className="back-button" type="button" onClick={onBack}>← Back home</button>
      <section className="onboarding-intro">
        <p className="kicker">Begin your journey</p>
        <h1 className="onboarding-title">How would you like to build your character?</h1>
        <p>Choose the route that works for you. Both create an editable draft—nothing is finalized without your approval.</p>
      </section>
      <div className="method-grid">
        <button className="method-card manual-card" type="button" onClick={() => onSelect("manual")}>
          <span className="method-icon" aria-hidden="true">✦</span>
          <span className="method-label">Recommended</span>
          <strong>Build my character</strong>
          <span>Answer a few guided questions about your experience, interests, priorities, and goals.</span>
          <i>About 5 minutes →</i>
        </button>
        <button className="method-card resume-card" type="button" onClick={() => onSelect("resume")}>
          <span className="method-icon" aria-hidden="true">↥</span>
          <span className="method-label">Faster start</span>
          <strong>Build from my résumé</strong>
          <span>Upload a résumé and review the profile CareerQuest proposes from it.</span>
          <i>PDF, DOCX, or TXT →</i>
        </button>
      </div>
      <p className="onboarding-note">High-school students can add ACT or SAT scores during manual setup.</p>
    </main>
  );
}

export function App() {
  const [view, setView] = useState<View>("landing");
  const [resumeResult, setResumeResult] = useState<ResumeResult | null>(null);
  const [avatar, setAvatar] = useState<AvatarSelection>({ profession: "Corporate", gender: "masculine" });
  const [questPlan, setQuestPlan] = useState<QuestPlan | null>(null);
  const [pathChoice, setPathChoice] = useState<PathChoice | null>(null);

  const completeResumeCharacter = (result: ResumeResult) => {
    setResumeResult(result);
    setView("character");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showLanding = () => {
    setView("landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showOnboarding = () => {
    setView("onboarding");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const useCharacter = (selectedAvatar: AvatarSelection) => {
    setAvatar(selectedAvatar);
    setView("quest");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const generatePaths = (plan: QuestPlan) => {
    setQuestPlan(plan);
    setView("paths");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const choosePath = (path: PathChoice) => {
    setPathChoice(path);
    setView("simulation");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToHow = () => document.querySelector("#how")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="site-shell">
      <header className="topbar">
        <Brand onClick={showLanding} />
        <nav aria-label="Primary navigation">
          {view === "landing" && <a href="#how">How it works</a>}
          {view === "landing" && <a href="#trust">Privacy</a>}
          <button className="nav-cta" type="button" onClick={showOnboarding}>Start your quest</button>
        </nav>
      </header>

      {view !== "landing" ? <Onboarding view={view} onBack={showLanding} onSelect={setView} resumeResult={resumeResult} avatar={avatar} questPlan={questPlan} pathChoice={pathChoice} onAvatarSelect={useCharacter} onGeneratePaths={generatePaths} onChoosePath={choosePath} onResumeComplete={completeResumeCharacter} /> : <main id="main">
        <section className="hero" id="top">
          <div className="eyebrow"><span /> Your career is not a straight line</div>
          <h1>Build your character.<br /><em>Explore your future.</em></h1>
          <p className="hero-copy">
            Turn what you know about yourself into career paths you can compare, test, and act on—without pretending anyone can predict your future.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={showOnboarding}>Build my character <span aria-hidden="true">→</span></button>
            <button className="text-button" type="button" onClick={scrollToHow}>See how it works <span aria-hidden="true">↓</span></button>
          </div>
          <p className="microcopy">No account required · Your data stays in this session</p>

          <div className="quest-card" aria-label="Example career journey map">
            <div className="card-topline">
              <span>Quest preview</span>
              <span className="status"><i /> Ready to explore</span>
            </div>
            <div className="path-map" aria-hidden="true">
              <div className="path-line" />
              <div className="node node-one"><span>YOU</span><b>Character</b></div>
              <div className="node node-two"><span>3</span><b>Paths</b></div>
              <div className="node node-three"><span>6</span><b>Choices</b></div>
              <div className="node node-four"><span>✓</span><b>Roadmap</b></div>
            </div>
            <div className="resource-strip">
              <span>More than salary</span>
              <ul>
                <li>Fit</li><li>Growth</li><li>Wellbeing</li><li>Flexibility</li><li>Stability</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="journey-section" id="how">
          <div className="section-heading">
            <p className="kicker">A guided journey</p>
            <h2>Four steps. Your choices.</h2>
            <p>CareerQuest combines trustworthy career information with a simulation built around your priorities.</p>
          </div>
          <div className="journey-grid">
            {journey.map((item) => (
              <article key={item.number}>
                <span className="step-number">{item.number}</span>
                <h3>{item.label}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="trust-section" id="trust">
          <div>
            <p className="kicker">Designed around you</p>
            <h2>Guidance with guardrails.</h2>
          </div>
          <div className="trust-points">
            <p><strong>You stay in control.</strong> Edit every AI suggestion before it becomes part of your character.</p>
            <p><strong>Your options stay open.</strong> Test scores and past experience never lock you out of a career path.</p>
            <p><strong>The math is transparent.</strong> Game outcomes come from visible rules—not a hidden AI score.</p>
          </div>
        </section>
      </main>}

      <footer>
        <span>CareerQuest</span>
        <p>Educational guidance, not a guarantee of career outcomes.</p>
      </footer>
    </div>
  );
}
