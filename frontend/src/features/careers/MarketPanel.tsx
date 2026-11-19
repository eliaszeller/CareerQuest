import { useEffect, useState } from "react";
import { CareerDataUnavailable, formatSalary, loadMarketCheck, skillsToBuild, type MarketCheck } from "./api";
import { Explanation } from "./Explanation";
import "./careers.css";

type State = { status: "loading" } | { status: "unavailable" } | { status: "error" } | { status: "ready"; data: MarketCheck };

export function MarketPanel({ role, skills, goal, onSalaryRange }: { role: string; skills: string[]; goal?: string; onSalaryRange?: (range: string | null) => void }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const skillKey = skills.join("|");
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    loadMarketCheck(role, skillKey ? skillKey.split("|") : [], controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", data });
        const salary = data?.detail.market?.salary;
        onSalaryRange?.(salary ? `${formatSalary(salary.p25)}–${formatSalary(salary.p75)}` : null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({ status: error instanceof CareerDataUnavailable ? "unavailable" : "error" });
        onSalaryRange?.(null);
      });
    return () => controller.abort();
  }, [role, skillKey, onSalaryRange]);

  if (state.status === "loading") return <section className="cq-market" aria-busy="true" aria-label="Real-world check"><p>Checking O*NET and job postings for {role}…</p></section>;
  if (state.status === "unavailable") return <section className="cq-market muted" aria-label="Real-world check"><p>Real-world data isn’t built yet, so the figures below are illustrative. See data/README.md to add O*NET and job postings.</p></section>;
  if (state.status === "error") return <section className="cq-market muted" aria-label="Real-world check"><p>Real-world data couldn’t be loaded right now. The figures below are illustrative.</p></section>;
  if (!state.data) return <section className="cq-market muted" aria-label="Real-world check"><p>No O*NET occupation matched “{role}”. Try a more common job title.</p></section>;

  const { detail, gap } = state.data;
  const market = detail.market;
  const zone = detail.job_zone?.name ? ` · ${detail.job_zone.name.split(": ").pop()}` : "";
  const have = gap.items.filter((item) => item.have);
  const missing = skillsToBuild(gap);
  return <section className="cq-market" aria-labelledby="cq-market-title">
    <div className="cq-market-head">
      <h2 id="cq-market-title">Real-world check: {detail.title}</h2>
      <span>O*NET {detail.soc}{zone}</span>
    </div>
    <dl className="cq-market-stats">
      <div><dt>Postings analyzed</dt><dd>{market ? market.postings.toLocaleString() : "Not built"}</dd></div>
      <div><dt>Typical pay (middle half)</dt><dd>{market?.salary ? `${formatSalary(market.salary.p25)}–${formatSalary(market.salary.p75)}` : "Not enough data"}</dd></div>
      <div><dt>Skill match</dt><dd>{gap.coverage === null ? "—" : `${Math.round(gap.coverage * 100)}%`}</dd></div>
    </dl>
    <div className="cq-market-columns">
      <div><h3>You already show</h3>{have.length ? <ul>{have.map((item) => <li key={`${item.kind}-${item.name}`}>{item.name}</li>)}</ul> : <p>No listed skills matched yet.</p>}</div>
      <div><h3>Skills to build</h3>{missing.length ? <ul>{missing.map((item) => <li key={`${item.kind}-${item.name}`}>{item.name} <small>{item.kind}{item.detail ? `, ${item.detail}` : ""}</small></li>)}</ul> : <p>Nothing major missing from the lists we checked.</p>}</div>
    </div>
    <Explanation soc={detail.soc} skills={skills} goal={goal} />
    {market && market.sample_postings.length > 0 && <div className="cq-market-postings"><h3>Example postings</h3><ul>{market.sample_postings.map((posting) => <li key={posting.job_id}>
      {posting.url ? <a href={posting.url} target="_blank" rel="noreferrer">{posting.title}</a> : posting.title}
      <small>{[posting.company, posting.location, posting.salary_annual ? formatSalary(posting.salary_annual) : null, posting.listed_date].filter(Boolean).join(" · ")}</small>
    </li>)}</ul></div>}
    <p className="cq-market-note">{gap.note}</p>
    {gap.sources.map((source) => <p className="cq-market-source" key={source.name}>{source.attribution}</p>)}
  </section>;
}
