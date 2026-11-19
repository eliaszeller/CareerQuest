import { useEffect, useState } from "react";
import { loadExplanation } from "./api";
import type { CareerExplanation } from "./contract";

export function Explanation({ soc, skills, goal }: { soc: string; skills: string[]; goal?: string }) {
  const [explanation, setExplanation] = useState<CareerExplanation | null>(null);
  const [failed, setFailed] = useState(false);
  const skillKey = skills.join("|");
  useEffect(() => {
    const controller = new AbortController();
    setExplanation(null);
    setFailed(false);
    loadExplanation(soc, skillKey ? skillKey.split("|") : [], goal, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setExplanation(data); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [soc, skillKey, goal]);

  if (failed) return null;
  if (!explanation) return <div className="cq-explain" aria-busy="true"><h3>Why this could fit</h3><p>Putting the facts together…</p></div>;
  const facts = new Map(explanation.facts.map((fact) => [fact.id, fact]));
  return <div className="cq-explain">
    <h3>Why this could fit</h3>
    <p>{explanation.summary}</p>
    <ul>{explanation.points.map((point) => <li key={point.text}>{point.text}{" "}
      {point.facts.map((id) => <a key={id} className="cq-cite" href={`#fact-${soc}-${id}`} title={facts.get(id)?.text}>{id}</a>)}
    </li>)}</ul>
    <details>
      <summary>Facts used ({explanation.generated_by === "model" ? `written by ${explanation.model ?? "the local model"}` : "standard summary"})</summary>
      <ol className="cq-facts">{explanation.facts.map((fact) => <li key={fact.id} id={`fact-${soc}-${fact.id}`}><b>{fact.id}</b> {fact.text} <small>{fact.source}</small></li>)}</ol>
      <p className="cq-market-note">{explanation.note}</p>
    </details>
  </div>;
}
