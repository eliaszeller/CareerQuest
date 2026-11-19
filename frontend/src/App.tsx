import { useEffect, useState } from "react";
import { Survey, JohnBusiness, emptySurvey } from "./features/survey/Survey";
import { RetroLandscape, JohnToken } from "./features/roadmap/RetroLandscape";
import { buildMilestones } from "./features/roadmap/model";
import { MarketPanel } from "./features/careers/MarketPanel";
import { useSkillGaps } from "./features/careers/useSkillGaps";
import { Sources } from "./features/careers/Sources";


import { CharacterBuilder, NavigationLock, ProfileSummary } from "./features/character/CharacterBuilder";
import { CharacterProfile, emptyProfile, toJourneyProfile } from "./features/character/model";

const journey = [
  { number: "01", label: "Build", text: "Turn your experiences, interests, and goals into an editable character." },
  { number: "02", label: "Explore", text: "Compare three plausible routes—including lower-cost and alternative options." },
  { number: "03", label: "Choose", text: "Play through real tradeoffs and see exactly how each decision changes your path." },
  { number: "04", label: "Act", text: "Leave with specific next-week actions and a longer-term roadmap." },
];

type View = "sources" | "survey" | "landing" | "onboarding" | "manual" | "resume" | "character" | "quest" | "paths" | "simulation" | "roadmap";
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

function Brand({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button className="brand brand-button" type="button" disabled={disabled} onClick={onClick} aria-label="CareerQuest home">
      <span className="brand-mark" aria-hidden="true">CQ</span>
      <span>CareerQuest</span>
    </button>
  );
}

function CharacterComplete({ result, profile, initialAvatar, onEdit, onUseCharacter }: { result: ResumeResult; profile: CharacterProfile; initialAvatar: AvatarSelection; onEdit: () => void; onUseCharacter: (avatar: AvatarSelection) => void }) {
  const name = result.draft.name || "Your character";
  return <main id="main" className="character-select-page">
    <div className="character-select-heading"><div><p className="kicker">Player 01 · Ready to explore</p><h1>Choose your pathfinder.</h1></div></div>
    <section className="character-selector-shell john-selector">
      <section className="active-character"><div className="john-stage"><RetroLandscape /><JohnToken large /></div><p className="character-name">{name}</p><h2>John Business</h2><p>Your character for every career adventure. Your interests and experience shape the path—not the suit.</p><button className="primary-button" onClick={() => onUseCharacter(initialAvatar)}>Use this character →</button></section>
      <ProfileSummary profile={profile} />
    </section>
    <div className="character-select-footer"><button className="text-button" onClick={onEdit}>← Edit my character</button><span>One familiar face. Every career remains open.</span></div>
  </main>;
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

const surveyRoles: Record<string, string[]> = {
  Healthcare: ["Registered Nurse", "Medical Laboratory Technician", "Community Health Worker"],
  Business: ["Business Analyst", "Project Coordinator", "Accountant"],
  Education: ["Teacher", "Instructional Designer", "School Counselor"],
  Military: ["Military Logistics Specialist", "Military Communications Specialist", "Military Medic"],
  Law: ["Paralegal", "Lawyer", "Legal Research Assistant"],
  Trades: ["Electrician", "Welder", "HVAC Technician"],
  Political: ["Policy Analyst", "Legislative Aide", "Community Organizer"],
};
function suggestedRoles(result: ResumeResult, profession: Profession, selectedCareer?: string | null) {
  if (selectedCareer && surveyRoles[selectedCareer]) return surveyRoles[selectedCareer];
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

function QuestScreen({ result, avatar, onBack, onGenerate, selectedCareer }: { selectedCareer?: string | null; result: ResumeResult; avatar: AvatarSelection; onBack: () => void; onGenerate: (plan: QuestPlan) => void }) {
  const roles = suggestedRoles(result, avatar.profession, selectedCareer);
  const [quest, setQuest] = useState<(typeof questOptions)[number]["id"]>("career");
  const [role, setRole] = useState(roles[0]);
  const [customRole, setCustomRole] = useState("");
  const [priorities, setPriorities] = useState(["Advancement", "Income"]);
  const [horizon, setHorizon] = useState("1–2 yrs");
  const [budget, setBudget] = useState("<$1K");
  const prioritiesList = ["Stability", "Flexibility", "Creativity", "Advancement", "Income", "Social impact", "Work-life fit", "Learning"];
  const selectedQuest = questOptions.find((item) => item.id === quest)!;
  const targetRole = customRole.trim() || role;
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
          <RetroLandscape />
          <div className="resort-map-shade" aria-hidden="true" />
          <div className="resort-map-header"><span id="quest-map-title">CareerQuest World 01</span><small>8 destinations · Choose your mission</small></div>
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
          <div className="quest-avatar-stage" aria-label="John Business, your character">
            <JohnToken />
            <span className="avatar-marker"><strong>{result.draft.name || "You"}</strong><small>John Business</small></span>
          </div>
          <div className="basecamp-label"><strong>START HERE</strong><span>Your next move starts here</span></div>
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
  const [marketSalary, setMarketSalary] = useState<string | null>(null);
  const knownSkills = result.draft.skills.slice(0, 3);
  const pathOptions = [
    { id: "direct", number: "01", label: "Direct ascent", tag: "Fastest", time: plan.horizon === "6 mo" ? "3–6 months" : "6–12 months", cost: plan.budget, fit: 88, salary: "$72K–$98K", description: `Position your current experience directly for ${plan.role} opportunities.`, skills: knownSkills.length ? knownSkills : ["Communication", "Analysis", "Project work"], actions: ["Rewrite résumé around measurable outcomes", `Build a targeted ${plan.role} portfolio case`, "Apply to 5 aligned roles each week"] },
    { id: "skills", number: "02", label: "Skills traverse", tag: "Best fit", time: "9–18 months", cost: plan.budget === "<$1K" ? "$500–$1K" : plan.budget, fit: 94, salary: "$82K–$112K", description: `Close the strongest skill gaps before moving into ${plan.role}.`, skills: ["Advanced analytics", "Industry tools", "Stakeholder storytelling"], actions: ["Complete one focused credential", "Ship two applied portfolio projects", "Find a mentor in the target field"] },
    { id: "bridge", number: "03", label: "Bridge route", tag: "Lower risk", time: "12–24 months", cost: "Low", fit: 84, salary: "$68K–$105K", description: `Move through an adjacent role that builds credibility toward ${plan.role}.`, skills: ["Transferable skills", "Domain knowledge", "Leadership"], actions: ["Target adjacent internal roles", "Lead a cross-functional project", "Build target-industry relationships"] },
  ];

  return <main id="main" className="paths-page">
    <div className="paths-heading-row"><div><p className="kicker">Step 3 · Paths</p><h1>Three ways up.</h1><p>Built for {result.draft.name || "you"} around <strong>{plan.role}</strong>, {plan.priorities.join(" and ").toLowerCase() || "your priorities"}.</p></div><ol className="quest-progress"><li className="complete">✓ Character</li><li className="complete">✓ Quest</li><li className="active">Paths</li><li>Simulation</li><li>Roadmap</li></ol></div>
    <MarketPanel role={plan.role} skills={result.draft.skills} goal={plan.goal} onSalaryRange={setMarketSalary} />
    <section className="path-cards" aria-label="Generated career paths">
      {pathOptions.map((path) => <button key={path.id} type="button" className={`path-option ${selected === path.id ? "selected" : ""}`} onClick={() => setSelected(path.id)}>
        <div className="path-card-top"><span>{path.number}</span><i>{path.tag}</i></div><h2>{path.label}</h2><p>{path.description}</p>
        <div className="path-metrics"><span><small>Time</small><strong>{path.time}</strong></span><span><small>Cost</small><strong>{path.cost}</strong></span><span><small>Fit</small><strong>{path.fit}%</strong></span><span><small>{marketSalary ? "Pay (postings)" : "Outlook (illustrative)"}</small><strong>{marketSalary ?? path.salary}</strong></span></div>
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

function RoadmapScreen({ result, plan, path, profile, done, setDone, onBack }: { result: ResumeResult; plan: QuestPlan; path: PathChoice; profile: CharacterProfile; done: string[]; setDone: (done: string[]) => void; onBack: () => void }) {
  const gaps = useSkillGaps(plan.role, result.draft.skills);
  const milestones = buildMilestones(plan, path.id, profile, gaps);
  const total = milestones.reduce((sum, phase) => sum + phase.items.length, 0);
  const toggle = (id: string) => setDone(done.includes(id) ? done.filter(value => value !== id) : [...done, id]);
  const cleared = milestones.map((phase, index) => phase.items.every((_, task) => done.includes(`${index}-${task}`)));
  return <main id="main" className="roadmap-page retro-roadmap">
    <div className="roadmap-heading"><div><p className="kicker">World 01 · Your action plan</p><h1>Your next 90 days.</h1><p>{result.draft.name || "Your"} · {path.label} toward <strong>{plan.role}</strong></p></div><div className="roadmap-counter" role="status">★ {done.length} / {total} actions complete</div></div>
    <section className="roadmap-world" aria-label="Four roadmap checkpoints"><RetroLandscape /><div className="world-hud"><span>CAREERQUEST / WORLD 01</span><span>PLAYER · JOHN BUSINESS</span></div><div className="world-checkpoints">{milestones.map((phase,index)=><a href={`#milestone-${index}`} key={phase.phase} className={cleared[index] ? "cleared" : ""}><b>{cleared[index] ? "★" : `0${index+1}`}</b><strong>{["Research", "Practice", "Experience", "Decide"][index]}</strong><span>{phase.phase}</span></a>)}</div><div className="world-player"><JohnToken /><span>YOUR NEXT MOVE</span></div></section>
    <section className="roadmap-brief"><div><p className="kicker">The mission</p><h2>Build evidence. Make a decision.</h2><p>Each checkpoint has a concrete deliverable. Mark an action complete when you have the evidence described below. These 90 days are for preparation and exploration; qualifying for {plan.role} may take longer.</p></div><div><strong>Planning constraints</strong><p>Budget: {plan.budget}<br/>Longer-term horizon: {plan.horizon}<br/>Priorities: {plan.priorities.join(" · ") || "Still exploring"}</p><small>Progress stays while navigating this page’s session. Print a copy before refreshing.</small></div></section>
    <section className="roadmap-timeline">{milestones.map((phase,index)=><article id={`milestone-${index}`} key={phase.phase} tabIndex={-1}><div className="checkpoint-title"><span className="timeline-marker">{cleared[index] ? "★" : index+1}</span><p>{phase.phase}</p><span className="checkpoint-state">{cleared[index] ? "Complete" : "In progress"}</span></div><h2>{phase.title}</h2><p className="checkpoint-reward">Deliverable: {phase.reward}</p><div>{phase.items.map((item,task)=>{const id=`${index}-${task}`;return <label key={id} className={done.includes(id) ? "complete" : ""}><input type="checkbox" checked={done.includes(id)} onChange={()=>toggle(id)}/><span><strong>{item.title}</strong><small>{item.proof}</small></span></label>;})}</div></article>)}</section>
    <div className="quest-footer"><button className="text-button" onClick={onBack}>← Back to simulation</button><button className="primary-button" onClick={()=>window.print()}>Print my roadmap</button></div>
  </main>;
}

function Onboarding({ roadmapDone, setRoadmapDone, selectedCareer, view, onBack, onSelect, resumeResult, avatar, questPlan, pathChoice, onAvatarSelect, onGeneratePaths, onChoosePath, profile, builderStep, onProfileChange, onBuilderStep, onApprove, onReset }: { roadmapDone: string[]; setRoadmapDone: (done: string[]) => void; selectedCareer: string | null; view: View; onBack: () => void; onSelect: (view: View) => void; resumeResult: ResumeResult | null; avatar: AvatarSelection; questPlan: QuestPlan | null; pathChoice: PathChoice | null; onAvatarSelect: (avatar: AvatarSelection) => void; onGeneratePaths: (plan: QuestPlan) => void; onChoosePath: (path: PathChoice) => void; profile: CharacterProfile; builderStep: number; onProfileChange: (profile: CharacterProfile) => void; onBuilderStep: (step: number) => void; onApprove: (profile: CharacterProfile) => void; onReset: () => void }) {
  if (view === "roadmap" && resumeResult && questPlan && pathChoice) {
    return <RoadmapScreen profile={profile} done={roadmapDone} setDone={setRoadmapDone} result={resumeResult} plan={questPlan} path={pathChoice} onBack={() => onSelect("simulation")} />;
  }
  if (view === "simulation" && resumeResult && questPlan && pathChoice) {
    return <SimulationScreen result={resumeResult} plan={questPlan} path={pathChoice} onBack={() => onSelect("paths")} onRoadmap={() => onSelect("roadmap")} />;
  }
  if (view === "paths" && resumeResult && questPlan) {
    return <PathsScreen result={resumeResult} plan={questPlan} onBack={() => onSelect("quest")} onContinue={onChoosePath} />;
  }
  if (view === "quest" && resumeResult) {
    return <QuestScreen selectedCareer={selectedCareer} result={resumeResult} avatar={avatar} onBack={() => onSelect("character")} onGenerate={onGeneratePaths} />;
  }
  if (view === "character" && resumeResult) {
    return <CharacterComplete result={resumeResult} profile={profile} initialAvatar={avatar} onEdit={() => { onBuilderStep(3); onSelect("manual"); }} onUseCharacter={onAvatarSelect} />;
  }
  if (view === "manual" || view === "resume") {
    return <CharacterBuilder profile={profile} step={builderStep} resumeFirst={view === "resume"} onChange={onProfileChange} onStep={onBuilderStep} onBack={() => onSelect("onboarding")} onApprove={onApprove} onReset={onReset} />;
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
        <button className="method-card resume-card" type="button" onClick={() => { onBuilderStep(0); onSelect("resume"); }}>
          <span className="method-icon" aria-hidden="true">↥</span>
          <span className="method-label">Faster start</span>
          <strong>Build from my résumé</strong>
          <span>Upload a résumé and review the profile CareerQuest proposes from it.</span>
          <i>PDF, DOCX, or TXT →</i>
        </button>
      </div>
      <p className="onboarding-note">No résumé needed. Classes, hobbies, projects, and helping others all belong in your story.</p>
    </main>
  );
}

export function App() {
  const [navigationLocked, setNavigationLocked] = useState(false);
  const [view, setView] = useState<View>("landing");
  const [survey, setSurvey] = useState(emptySurvey);
  const [surveyReturn, setSurveyReturn] = useState<View>("landing");
  const [selectedCareer, setSelectedCareer] = useState<string | null>(null);
  const openSurvey = () => { if (view !== "survey") setSurveyReturn(view); setView("survey"); window.scrollTo(0, 0); };
  const [profile, setProfile] = useState<CharacterProfile>(emptyProfile);
  const [builderStep, setBuilderStep] = useState(0);
  const resumeResult = profile.approval_status === "approved" ? toJourneyProfile(profile) : null;
  useEffect(() => {
    const hasDraft = Boolean(profile.name || profile.life_stage || profile.goal || profile.entries.length);
    if (!hasDraft && !Object.keys(survey.answers).length) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [profile, survey.answers]);
  const [avatar, setAvatar] = useState<AvatarSelection>({ profession: "Corporate", gender: "masculine" });
  const [questPlan, setQuestPlan] = useState<QuestPlan | null>(null);
  const [roadmapDone, setRoadmapDone] = useState<string[]>([]);
  const [pathChoice, setPathChoice] = useState<PathChoice | null>(null);

  const completeResumeCharacter = (confirmed: CharacterProfile) => {
    setProfile(confirmed);
    setQuestPlan(null);
    setPathChoice(null);
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
    setRoadmapDone([]);
    setView("paths");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const choosePath = (path: PathChoice) => {
    if (pathChoice?.id !== path.id) setRoadmapDone([]);
    setPathChoice(path);
    setView("simulation");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToHow = () => document.querySelector("#how")?.scrollIntoView({ behavior: "smooth" });

  return (
    <NavigationLock.Provider value={setNavigationLocked}><div className="site-shell">
      <header className="topbar">
        <Brand onClick={showLanding} disabled={navigationLocked} />
        <nav aria-label="Primary navigation">
          {view === "landing" && <a href="#how">How it works</a>}
          {view === "landing" && <a href="#trust">Privacy</a>}
          <button className="text-button" type="button" disabled={navigationLocked} onClick={openSurvey}>Career survey</button>
          <button className="nav-cta" type="button" disabled={navigationLocked} onClick={showOnboarding}>Start your quest</button>
        </nav>
      </header>

      {selectedCareer && view !== "survey" && <aside className="survey-selection"><strong>Exploring {selectedCareer}.</strong> Your quest will suggest roles in this field. You can still choose any direction. <button className="text-button" onClick={openSurvey} disabled={navigationLocked}>Review survey</button></aside>}
      {view === "sources" ? <Sources onBack={showLanding} /> : view === "survey" ? <Survey state={survey} onChange={setSurvey} onExit={() => setView(surveyReturn)} onChoose={career => { setSelectedCareer(career); setView(profile.approval_status === "approved" ? "character" : "onboarding"); window.scrollTo(0, 0); }} /> : view !== "landing" ? <Onboarding roadmapDone={roadmapDone} setRoadmapDone={setRoadmapDone} selectedCareer={selectedCareer} view={view} onBack={showLanding} onSelect={setView} resumeResult={resumeResult} avatar={avatar} questPlan={questPlan} pathChoice={pathChoice} onAvatarSelect={useCharacter} onGeneratePaths={generatePaths} onChoosePath={choosePath} profile={profile} builderStep={builderStep} onProfileChange={setProfile} onBuilderStep={setBuilderStep} onApprove={completeResumeCharacter} onReset={() => { setProfile(emptyProfile()); setBuilderStep(0); setQuestPlan(null); setPathChoice(null); }} /> : <main id="main">
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
          <p className="microcopy">No account required · Drafts clear when you refresh or close this page</p>

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

        <section className="mascot-invite"><JohnBusiness>Not sure where to begin? I’m John Business, your CareerQuest guide. Let’s discover what matters to you—one small step at a time.</JohnBusiness><button className="primary-button" onClick={openSurvey}>Find my direction · Take the survey →</button></section>
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
        <button className="text-button" type="button" disabled={navigationLocked} onClick={() => { setView("sources"); window.scrollTo(0, 0); }}>Data sources and credits</button>
      </footer>
    </div></NavigationLock.Provider>
  );
}
