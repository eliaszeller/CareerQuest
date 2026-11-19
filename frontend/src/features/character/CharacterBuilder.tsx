import { createContext, FormEvent, useContext, useEffect, useRef, useState } from "react";
import type { CareerSuggestions } from "../careers/contract";
import { approveProfile, extractResume, validateResumeFile } from "./api";
import { approvalIssues, categories, Category, categoryInfo, CharacterEntry, CharacterProfile, mergeResume, stages } from "./model";
import "./character.css";

const steps = ["Your starting point", "Your story", "What sparks you", "Review & confirm"];
export const NavigationLock = createContext<(locked: boolean) => void>(() => {});
const stepCategories: Category[][] = [[], ["education", "experience", "classes", "projects"], ["interests", "hobbies", "skills", "certifications"], [...categories]];

type Props = {
  profile: CharacterProfile; step: number; resumeFirst: boolean;
  onChange: (profile: CharacterProfile) => void; onStep: (step: number) => void;
  onBack: () => void; onApprove: (profile: CharacterProfile) => void; onReset: () => void;
};

function ResumeImport({ onImport }: { onImport: (profile: CharacterProfile, warnings: string[], suggestions: CareerSuggestions | null) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const choose = (candidate: File | undefined) => {
    if (!candidate || busy) return;
    const problem = validateResumeFile(candidate);
    setError(problem || ""); setFile(problem ? null : candidate); setConsent(false);
  };
  const upload = async () => {
    if (!file || !consent || busy) return;
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError("");
    try {
      const result = await extractResume(file, request.signal);
      if (!request.signal.aborted) {
        onImport(result.profile, result.warnings, result.careerSuggestions); setFile(null); setConsent(false);
        if (input.current) input.current.value = "";
      }
    } catch (reason) {
      if (!request.signal.aborted) setError(reason instanceof Error ? reason.message : "We couldn’t process this file.");
    } finally { if (!request.signal.aborted) setBusy(false); }
  };
  return <div className="cq-import">
    <p>A résumé is a shortcut, never a requirement. Imported details will be suggestions until you confirm them.</p>
    <div className="cq-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files[0]); }}>
      <span className="cq-upload-icon" aria-hidden="true">↥</span>
      <label htmlFor="resume-file">{file ? file.name : "Choose a résumé or drop it here"}</label>
      <input ref={input} id="resume-file" type="file" accept=".pdf,.docx,.txt" disabled={busy} onChange={(event) => choose(event.target.files?.[0])} aria-describedby="file-help" />
      <small id="file-help">PDF, DOCX, or TXT · up to 5 MB · text-based PDFs only</small>
    </div>
    <label className="cq-checkbox"><input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} />
      <span>Process this file on the local CareerQuest server. No AI service receives it; the temporary file is deleted after processing.</span></label>
    {error && <p className="cq-error" role="alert">{error}</p>}
    <div className="cq-inline-actions">
      <button className="primary-button" type="button" disabled={!file || !consent || busy} onClick={upload}>{busy ? "Reading your résumé…" : "Extract suggestions"}</button>
      {busy && <button className="text-button" type="button" onClick={() => { controller.current?.abort(); setBusy(false); }}>Cancel</button>}
    </div>
    {busy && <p role="status">Looking for recognizable sections. You can cancel and continue manually.</p>}
  </div>;
}

function EntryForm({ category, entry, onSave, onCancel }: { category: Category; entry?: CharacterEntry; onSave: (entry: CharacterEntry) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [details, setDetails] = useState(entry?.details ?? "");
  const info = categoryInfo[category];
  const formId = entry?.id ?? `new-${category}`;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onSave({ id: entry?.id ?? crypto.randomUUID(), category, title: title.trim(), details: details.trim(),
      source: entry?.source ?? "manual", status: "confirmed", evidence: entry?.evidence ?? null });
  };
  return <form className="cq-entry-form" onSubmit={submit}>
    <label htmlFor={`${formId}-title`}>{info.singular} name</label>
    <input autoFocus id={`${formId}-title`} required maxLength={160} value={title} placeholder={info.placeholder} onChange={(event) => setTitle(event.target.value)} />
    <label htmlFor={`${formId}-details`}>Details <span>(optional)</span></label>
    <textarea id={`${formId}-details`} maxLength={2000} rows={4} value={details} placeholder="What did you do or learn? What would you like to explore?" onChange={(event) => setDetails(event.target.value)} />
    <small className="cq-counter">{details.length}/2,000</small>
    {entry?.evidence && <details className="cq-evidence"><summary>Original résumé excerpt</summary><p>{entry.evidence}</p></details>}
    <div className="cq-inline-actions"><button type="submit" className="primary-button" disabled={!title.trim()}>{entry?.source === "resume" ? "Save & confirm" : "Save entry"}</button><button type="button" className="text-button" onClick={onCancel}>Cancel edit</button></div>
  </form>;
}

export function EntrySection({ category, entries, onSave, onRemove, limitReached, onEditing }: {
  category: Category; entries: CharacterEntry[]; onSave: (entry: CharacterEntry) => void;
  onRemove: (entry: CharacterEntry) => void; limitReached: boolean; onEditing?: (key: string, editing: boolean) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const edit = (id: string | null) => { setEditing(id); onEditing?.(category, id !== null); };
  const info = categoryInfo[category];
  return <section className="cq-section" aria-labelledby={`section-${category}`}>
    <div className="cq-section-heading"><div><span className="cq-section-index">{info.icon}</span><h2 id={`section-${category}`}>{info.label}</h2><span className="cq-count">{entries.length}</span></div>
      <button type="button" className="cq-add" disabled={!!editing || limitReached} onClick={() => edit("new")}>+ Add {info.singular.toLowerCase()}</button></div>
    <p className="cq-section-hint">{info.hint}</p>
    {!entries.length && !editing && <div className="cq-empty">{category === "experience" ? "No job experience? That’s okay. Start with something you’ve helped with." : "Nothing added yet. Add something if it feels relevant, or leave this for later."}</div>}
    <ul className="cq-entry-list">{entries.map((entry) => <li className={entry.status === "suggested" ? "cq-entry pending" : "cq-entry"} key={entry.id}>
      {editing === entry.id ? <EntryForm category={category} entry={entry} onSave={(updated) => { onSave(updated); edit(null); }} onCancel={() => edit(null)} /> : <>
        <div className="cq-entry-top"><h3>{entry.title}</h3><span className={`cq-badge ${entry.status}`}>{entry.status === "suggested" ? "Needs review" : entry.source === "resume" ? "Reviewed" : "Added by you"}</span></div>
        {entry.details && <p className="cq-entry-details">{entry.details}</p>}
        {entry.evidence && <details className="cq-evidence"><summary>Résumé source</summary><p>{entry.evidence}</p></details>}
        <div className="cq-entry-actions">
          {entry.status === "suggested" && <button type="button" disabled={!!editing} onClick={() => onSave({ ...entry, status: "confirmed" })} aria-label={`Confirm ${entry.title}`}>✓ Confirm</button>}
          <button type="button" disabled={!!editing} onClick={() => edit(entry.id)} aria-label={`Edit ${entry.title}`}>Edit</button>
          <button type="button" className="cq-remove" disabled={!!editing} onClick={() => onRemove(entry)} aria-label={`Remove ${entry.title}`}>Remove</button>
        </div>
      </>}
    </li>)}</ul>
    {editing === "new" && <EntryForm category={category} onSave={(entry) => { onSave(entry); edit(null); }} onCancel={() => edit(null)} />}
  </section>;
}

function CareerSuggestionsPanel({ suggestions }: { suggestions: CareerSuggestions }) {
  const [top, ...others] = suggestions.categories;
  return <section className="cq-career-suggestions" aria-labelledby="cq-career-suggestions-title">
    <h3 id="cq-career-suggestions-title">Where your résumé points</h3>
    {top && <p className="cq-career-guess">Looks like: <strong>{top.label}</strong> <span>({Math.round(top.confidence * 100)}% match{others.length ? `; also ${others.map((item) => item.label).join(", ")}` : ""})</span></p>}
    {suggestions.occupations.length > 0 && <>
      <p className="cq-career-sub">Occupations to explore</p>
      <ul>{suggestions.occupations.map((item) => <li key={item.soc}>{item.title} <small>{item.reason === "resume_category" ? "from your résumé category" : "similar wording"}</small></li>)}</ul>
    </>}
    <p className="cq-career-note">{suggestions.note}</p>
    {suggestions.source && <p className="cq-career-source">{suggestions.source.attribution}</p>}
  </section>;
}

export function CharacterBuilder({ profile, step, resumeFirst, onChange, onStep, onBack, onApprove, onReset }: Props) {
  const [showImport, setShowImport] = useState(resumeFirst);
  const [notice, setNotice] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [careerSuggestions, setCareerSuggestions] = useState<CareerSuggestions | null>(null);
  const [removed, setRemoved] = useState<CharacterEntry | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editing, setEditing] = useState<string[]>([]);
  const lockNavigation = useContext(NavigationLock);
  useEffect(() => { lockNavigation(busy || editing.length > 0); return () => lockNavigation(false); }, [busy, editing.length, lockNavigation]);
  const heading = useRef<HTMLHeadingElement>(null);
  const request = useRef<AbortController | null>(null);
  const latest = useRef(profile); latest.current = profile;
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { heading.current?.focus(); setError(""); }, [step]);
  useEffect(() => { setAcknowledged(false); }, [profile]);
  const pending = profile.entries.filter((entry) => entry.status === "suggested").length;
  const touched = new Set(profile.entries.map((entry) => entry.category)).size;
  const change = (updated: CharacterProfile) => onChange({ ...updated, approval_status: "draft" });
  const save = (entry: CharacterEntry) => change({ ...profile, entries: profile.entries.some((item) => item.id === entry.id)
    ? profile.entries.map((item) => item.id === entry.id ? entry : item) : [...profile.entries, entry] });
  const remove = (entry: CharacterEntry) => { change({ ...profile, entries: profile.entries.filter((item) => item.id !== entry.id) }); setRemoved(entry); };
  const go = (next: number) => {
    if (editing.length) { setError("Save or cancel your open entry before moving on."); return; }
    if (step === 0 && next > 0 && (!profile.name.trim() || !profile.life_stage)) { setError("Add a character name and choose your life stage to continue."); return; }
    onStep(next); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const approve = async () => {
    if (busy) return;
    const issues = approvalIssues(profile);
    if (issues.length || !acknowledged || editing.length) { setError(issues[0] || "Finish editing and confirm you have reviewed your character."); return; }
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError("");
    try { const approved = await approveProfile(profile, controller.signal); if (!controller.signal.aborted) onApprove(approved); }
    catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Please try again."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <main id="main" className="cq-builder">
    <div className="cq-topline"><button className="back-button" type="button" disabled={busy || !!editing.length} onClick={onBack}>← Back to options</button><span className="cq-session"><i /> Private draft · this page only</span></div>
    <div className="cq-layout">
      <aside className="cq-sidebar">
        <p className="kicker">Character creation</p><h2>A little about you.<br /><em>A world to explore.</em></h2>
        <p>You don’t need a perfect résumé—or a plan. Start with what makes you, you.</p>
        <ol className="cq-steps" aria-label="Character building steps">{steps.map((label, index) => <li key={label}><button type="button" disabled={busy || !!editing.length} aria-current={step === index ? "step" : undefined} className={step === index ? "active" : ""} onClick={() => go(index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong>{index < step && <i aria-hidden="true">✓</i>}</button></li>)}</ol>
        <div className="cq-passport"><div className="cq-passport-top"><span>YOUR PATHFINDER</span><span aria-hidden="true">✦</span></div><div className="cq-monogram" aria-hidden="true">{profile.name.trim().slice(0, 1).toUpperCase() || "?"}</div><h3>{profile.name.trim() || "Your story starts here"}</h3><p>{profile.life_stage ? stages[profile.life_stage] : "Every starting point belongs"}</p><div className="cq-passport-stats"><span><b>{profile.entries.length}</b> story pieces</span><span><b>{touched}</b> areas explored</span></div><small>This is a snapshot, not a score.</small></div>
        <p className="cq-privacy-note">Your draft stays in memory while you navigate. Refreshing or closing this page clears it. You can download your confirmed profile at the end.</p>
      </aside>
      <div className="cq-workspace">
        <div className="cq-heading"><p className="kicker">Step {step + 1} of 4 <span>· {step === 0 ? "Start anywhere" : step === 3 ? "You’re in control" : "All sections optional"}</span></p><h1 ref={heading} tabIndex={-1}>{["Meet your next chapter.", "More than a résumé.", "Follow your curiosity.", "Make it yours."][step]}</h1><p>{[
          "Choose a name and your starting point. Add a résumé if you have one, or build your story as you go.",
          "School, work, helping others, and things you’ve made. Every kind of experience has a place here.",
          "What do you enjoy? What have you practiced? You can be curious about something without being good at it yet.",
          "Check your details and review every imported suggestion. Nothing becomes your character until you confirm it.",
        ][step]}</p></div>
        {notice && <div className="cq-notice" role="status">{notice}</div>}
        {removed && <div className="cq-notice" role="status">Removed “{removed.title}”. <button type="button" disabled={profile.entries.length >= 200 || busy} onClick={() => { save(removed); setRemoved(null); }}>Undo</button></div>}
        {error && <div className="cq-error" role="alert">{error}</div>}
        <fieldset className="cq-fields" disabled={busy}>
        {step === 0 && <>
          <section className="cq-section cq-basics"><label htmlFor="cq-name">What should we call your character? <span>Required</span></label><input id="cq-name" autoComplete="nickname" maxLength={80} value={profile.name} placeholder="A first name or nickname is enough" onChange={(event) => change({ ...profile, name: event.target.value })} />
            <fieldset><legend>Where are you right now? <span>Required</span></legend><div className="cq-stage-grid">{Object.entries(stages).map(([value, label]) => <label key={value}><input type="radio" name="life-stage" value={value} checked={profile.life_stage === value} onChange={() => change({ ...profile, life_stage: value as CharacterProfile["life_stage"] })} /><span>{label}</span></label>)}</div></fieldset>
            <label htmlFor="cq-goal">What would you like to figure out? <span>Optional</span></label><textarea id="cq-goal" rows={3} maxLength={500} value={profile.goal} placeholder="e.g. I want to explore careers where I can help people and be creative." onChange={(event) => change({ ...profile, goal: event.target.value })} /><small className="cq-counter">{profile.goal.length}/500</small>
          </section>
          <section className="cq-section cq-import-section"><button type="button" className="cq-import-toggle" aria-expanded={showImport} aria-controls="cq-import-panel" onClick={() => setShowImport(!showImport)}><span><strong>Have a résumé? Get a head start.</strong><small>Optional · adds suggestions without replacing your entries</small></span><b aria-hidden="true">{showImport ? "−" : "+"}</b></button>
            {showImport && <div id="cq-import-panel"><ResumeImport onImport={(imported, messages, suggestions) => { const merged = mergeResume(latest.current, imported); change(merged.profile); setWarnings(messages); setCareerSuggestions(suggestions); setNotice(`${merged.added} new suggestions added. Review them in Your story and What sparks you.${merged.omitted ? ` ${merged.omitted} items did not fit the 200-entry limit.` : ""}`); }} />{warnings.length > 0 && <ul className="cq-import-warnings">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}{careerSuggestions && <CareerSuggestionsPanel suggestions={careerSuggestions} />}</div>}
          </section>
        </>}
        {step === 3 && <>
          <section className="cq-review-identity"><div><span className="cq-badge confirmed">Your starting point</span><h2>{profile.name || "Add your name"}</h2><p>{profile.life_stage ? stages[profile.life_stage] : "Choose your life stage"}</p>{profile.goal && <p className="cq-goal">{profile.goal}</p>}</div><button type="button" className="cq-add" disabled={!!editing.length} onClick={() => go(0)}>Edit basics</button></section>
          {pending > 0 ? <div className="cq-review-callout"><strong>{pending} {pending === 1 ? "suggestion needs" : "suggestions need"} your review</strong><p>Confirm what’s accurate, edit what needs work, and remove anything that doesn’t belong.</p><button type="button" className="text-button" disabled={!!editing.length} onClick={() => change({ ...profile, entries: profile.entries.map((entry) => ({ ...entry, status: "confirmed" })) })}>I’ve checked all remaining suggestions — confirm them</button></div> : <p className="cq-notice">{profile.entries.length ? "All entries are confirmed. You can still edit or add anything." : "A name and starting point are enough. You can add your story later."}</p>}
        </>}
        {stepCategories[step].map((category) => <EntrySection key={`${step}-${category}`} category={category} entries={profile.entries.filter((entry) => entry.category === category)} onSave={save} onRemove={remove} limitReached={profile.entries.length >= 200} onEditing={(key, value) => setEditing((current) => value ? [...current.filter((item) => item !== key), key] : current.filter((item) => item !== key))} />)}
        {profile.entries.length >= 200 && <p className="cq-notice">You’ve reached 200 entries. Edit or remove an entry before adding more.</p>}
        {step === 3 && <label className="cq-checkbox cq-approval"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>I’ve reviewed my character. These details reflect what I want to share, and I can edit them later.</span></label>}
        </fieldset>
        <div className="cq-navigation"><button className="text-button" type="button" disabled={busy || !!editing.length} onClick={() => step === 0 ? onBack() : go(step - 1)}>{step === 0 ? "Back to options" : "← Previous step"}</button>{step < 3 ? <button className="primary-button" type="button" disabled={busy || !!editing.length} onClick={() => go(step + 1)}>{step === 2 ? "Review my character" : "Continue"} <span aria-hidden="true">→</span></button> : <button className="primary-button" type="button" disabled={busy || !!editing.length || !acknowledged || pending > 0} onClick={approve}>{busy ? "Confirming…" : "Confirm my character →"}</button>}</div>
        {busy && <p role="status">Validating your confirmed profile…</p>}
        <div className="cq-reset"><button type="button" disabled={busy || !!editing.length} onClick={() => setResetting(!resetting)}>Clear this draft</button>{resetting && <div role="group" aria-label="Confirm clearing draft"><p>This removes all entries and résumé suggestions from this page. It cannot be undone.</p><button type="button" className="text-button" onClick={() => setResetting(false)}>Keep my draft</button><button type="button" className="cq-danger" onClick={() => { setResetting(false); setRemoved(null); setNotice(""); setWarnings([]); onReset(); }}>Yes, clear everything</button></div>}</div>
      </div>
    </div>
  </main>;
}

export function ProfileSummary({ profile }: { profile: CharacterProfile }) {
  const download = () => {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "careerquest-character.json"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <aside className="resume-highlights cq-confirmed"><p className="panel-eyebrow">Confirmed character</p><h2>{profile.name}</h2><p>{profile.life_stage && stages[profile.life_stage]}</p>{profile.goal && <p>{profile.goal}</p>}
    {categories.map((category) => { const entries = profile.entries.filter((entry) => entry.category === category); return entries.length ? <section key={category}><h3>{categoryInfo[category].label}</h3>{entries.map((entry) => <details key={entry.id}><summary>{entry.title}</summary><p>{entry.details || "No additional details."}</p></details>)}</section> : null; })}
    {!profile.entries.length && <p>Your starting point is enough. Add interests and experiences whenever you’re ready.</p>}
    <button className="text-button" type="button" onClick={download}>Download my profile</button><small>Contains your personal details. Save it somewhere private.</small>
  </aside>;
}
