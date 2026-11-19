import { useEffect, useRef, useState } from "react";
import catalog from "./catalog.json";
import type { SurveyResult } from "./contract";
import john from "../../assets/john-business.png";
import "./survey.css";

export type SurveyState = { answers: Record<string, number | null>; step: number; result: SurveyResult | null };
export const emptySurvey = (): SurveyState => ({ answers: {}, step: 0, result: null });
const choices = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree", "Not sure yet"];

export function JohnBusiness({ children }: { children: React.ReactNode }) {
  return <aside className="john-coach"><div className="john-portrait"><img src={john} alt="John Business, CareerQuest’s pixel-art mascot wearing sunglasses and a suit" /></div><div><p className="kicker">Meet your guide · John Business</p><p>{children}</p></div></aside>;
}

export function Survey({ state, onChange, onExit, onChoose }: { state: SurveyState; onChange: (state: SurveyState) => void; onExit: () => void; onChoose: (career: string) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { heading.current?.focus(); }, [state.step, state.result]);
  const section = catalog.sections[state.step];
  const questions = catalog.questions.filter(q => q.section === section.id);
  const complete = questions.every(q => Object.hasOwn(state.answers, q.id));
  const advance = async () => {
    if (!complete) { setError("Choose a response for each statement. Not sure yet is always an option."); return; }
    setError("");
    if (state.step < 5) { onChange({ ...state, step: state.step + 1 }); return; }
    const request = new AbortController(); controller.current = request;
    const timeout = window.setTimeout(() => request.abort(), 20000);
    setBusy(true);
    try {
      const response = await fetch("/api/v1/survey/results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: catalog.version, answers: state.answers }), signal: request.signal, cache: "no-store" });
      if (!response.ok) throw new Error("request failed");
      const result: SurveyResult = await response.json();
      if (result.version !== catalog.version || !Array.isArray(result.careers) || result.careers.length !== 7) throw new Error("invalid result");
      onChange({ ...state, result });
    } catch { if (controller.current === request) setError("We couldn’t load your results. Your answers are still here. Check the connection and try again."); }
    finally { window.clearTimeout(timeout); setBusy(false); }
  };
  const download = () => {
    const blob = new Blob([JSON.stringify({ version: catalog.version, answers: state.answers, result: state.result }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "careerquest-survey.json"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <main id="main" className="survey-page">
    <button className="back-button" onClick={onExit} disabled={busy}>← Return to my journey</button>
    <div className="survey-heading"><p className="kicker">Career compass · 30 statements · About 7 minutes</p><h1 ref={heading} tabIndex={-1}>{state.result ? "Your next directions." : "Find your direction."}</h1><p>An exploration of what you enjoy, how you work, and where you want to go. No résumé or work experience required.</p></div>
    <JohnBusiness>{state.result ? "A direction is a starting point. Try one small activity, see how it feels, and keep your options open." : "Think about school, hobbies, projects, work, or everyday life. Answer for who you are today. You don’t need your whole future figured out."}</JohnBusiness>
    {state.result ? <>
      <section className="survey-summary"><h2>{state.result.has_direction ? "Start exploring these possibilities" : "Keep exploring: no clear direction yet"}</h2><p>{state.result.has_direction ? "Categories appear in order of your current interest signals. Equal signals share the same standing. These are suggestions, not predictions of success." : "Your answers are broad or still developing. We’ve listed all seven categories alphabetically, without choosing a winner."}</p><p>{state.result.answered_count} rated · {state.result.not_sure_count} marked not sure</p><button className="text-button" onClick={() => onChange({ ...state, step: 0, result: null })}>Review my answers</button><button className="text-button" onClick={download}>Download my survey</button></section>
      <div className="survey-careers">{state.result.careers.map(career => { const info = catalog.careers.find(item => item.id === career.category)!; return <section className="survey-career" key={career.category}><p className="kicker">{state.result!.has_direction && career.score === state.result!.careers[0].score ? "Strongest current signal" : "Open to explore"}</p><h2>{career.category}</h2><p>{info.description}</p><p><strong>Example areas:</strong> {info.examples.join(" · ")}</p>{career.reasons.length > 0 ? <details><summary>What in my answers connects?</summary><ul>{career.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></details> : <p>No strong positive signal yet. You can still explore this field.</p>}<p><strong>Try this:</strong> {info.next_step}</p><button className="primary-button" onClick={() => onChoose(career.category)}>Explore {career.category} →</button></section>; })}</div>
      <section className="survey-preferences"><h2>Make the path work for you</h2><p>These preferences guide how and where you explore. They do not remove career options or assign you a fixed learning type.</p>{(["learning", "location"] as const).map(kind => <div key={kind}><h3>{kind === "learning" ? "Learning preferences" : "Location preferences"}</h3><ul>{state.result![kind].map(item => <li key={item.question_id}><span>{item.text}</span><strong>{item.response === null ? "Not sure yet" : choices[item.response - 1]}</strong></li>)}</ul></div>)}</section>
    </> : <>
      <div className="survey-progress"><span>Section {state.step + 1} of 6</span><span>{Object.keys(state.answers).length} of 30 responses</span><progress max={30} value={Object.keys(state.answers).length} aria-label="Survey responses" /></div>
      <nav className="survey-sections" aria-label="Survey sections">{catalog.sections.map((item, index) => <span key={item.id} aria-current={index === state.step ? "step" : undefined}>{index + 1}. {item.domain}</span>)}</nav>
      <form onSubmit={event => { event.preventDefault(); void advance(); }}><div className="survey-section-title"><p className="kicker">{section.domain}</p><h2>{section.title}</h2><p>{section.description}</p><p>Choose how much you agree. “Not sure yet” is different from neutral.</p></div>
        {questions.map(q => <fieldset className="survey-question" key={q.id} disabled={busy}><legend><span>{Number(q.id.slice(1))}.</span> {q.text}</legend><div className="survey-options">{choices.map((label, index) => { const value = index === 5 ? null : index + 1; return <label key={label} className={Object.hasOwn(state.answers, q.id) && state.answers[q.id] === value ? "chosen" : ""}><input type="radio" name={q.id} checked={Object.hasOwn(state.answers, q.id) && state.answers[q.id] === value} onChange={() => { setError(""); onChange({ ...state, answers: { ...state.answers, [q.id]: value }, result: null }); }} /><span>{label}</span></label>; })}</div></fieldset>)}
        {error && <p role="alert" className="survey-error">{error}</p>}<div className="survey-actions"><button type="button" className="text-button" disabled={state.step === 0 || busy} onClick={() => { setError(""); onChange({ ...state, step: state.step - 1 }); }}>← Previous section</button><button className="primary-button" disabled={busy} type="submit">{busy ? "Finding your directions…" : state.step === 5 ? "See my directions →" : "Next section →"}</button></div>
      </form>
    </>}
    <details className="survey-method"><summary>How this survey works & your privacy</summary><p>These are original CareerQuest questions, not the Myers-Briggs or O*NET assessment. Responses describe interests and self-reported skills, not demonstrated ability. Version 1 uses experimental, explicit question weights; it has not been validated as a psychological test.</p><p>The first 20 responses contribute to career signals. Learning and location responses stay separate. Unknown answers are excluded. Broad, neutral, or sparse answers do not produce a top match. Results never determine eligibility or exclude a career.</p><p>Answers stay in this page’s memory and are sent to the local CareerQuest server to calculate results. They are not sent to an AI provider or saved by this survey. Refreshing clears them; download a copy if you want to keep them.</p></details>
  </main>;
}
