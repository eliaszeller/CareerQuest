import "./careers.css";

const SOURCES = [
  {
    name: "O*NET 31.0 Database",
    by: "U.S. Department of Labor, Employment and Training Administration (USDOL/ETA)",
    url: "https://www.onetcenter.org/database.html",
    license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    use: "Occupations, alternate job titles, required and transferable skills, knowledge, software, job zones and related careers.",
    credit: "This page includes information from the O*NET 31.0 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA. CareerQuest has modified all or some of this information. USDOL/ETA has not approved, endorsed, or tested these modifications.",
  },
  {
    name: "LinkedIn Job Postings (2023 - 2024)",
    by: "arshkon, on Kaggle",
    url: "https://www.kaggle.com/datasets/arshkon/linkedin-job-postings",
    license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    use: "Posted salary ranges, the tools employers name most, and example postings. Titles were mapped to O*NET occupations.",
    credit: "Job posting statistics derived from “LinkedIn Job Postings (2023 - 2024)” by arshkon on Kaggle, used under CC BY-SA 4.0. CareerQuest mapped titles to O*NET occupations and summarized salaries and skills; derived data is shared under the same license.",
  },
  {
    name: "Text-based Resume Filtering Tool",
    by: "Nivetha Thangaraj, Hasan Zafar and Arian Riyahivafa, on Kaggle",
    url: "https://www.kaggle.com/code/hasanz9/text-based-resume-filtering-tool",
    license: "Apache 2.0", licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    use: "The TF-IDF résumé matching approach, adapted for the résumé category model and occupation matching.",
    credit: "Résumé matching adapted from “Text-based Resume Filtering Tool” by Nivetha Thangaraj, Hasan Zafar and Arian Riyahivafa, under the Apache License 2.0.",
  },
  {
    name: "Resume Dataset (2,484 résumés, 24 categories)",
    by: "Public Kaggle dataset used by the notebook above",
    url: "https://www.kaggle.com/code/hasanz9/text-based-resume-filtering-tool",
    license: "License not stated", licenseUrl: "",
    use: "Training the résumé category model for this class project. The data and trained model are not redistributed.",
    credit: "Résumé categories learned from the public Kaggle Resume Dataset, credited to its Kaggle publisher.",
  },
];

export function Sources({ onBack }: { onBack: () => void }) {
  return <main id="main" className="cq-sources">
    <button className="back-button" type="button" onClick={onBack}>← Back</button>
    <h1>Data sources and credits</h1>
    <p>CareerQuest grounds its career facts in the public data below. Explanations are written by a model running on this computer from those facts only, and each point links to the facts it uses. Your résumé text is never stored.</p>
    {SOURCES.map((source) => <section key={source.name} aria-labelledby={`src-${source.name}`}>
      <h2 id={`src-${source.name}`}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a></h2>
      <p className="cq-sources-meta">{source.by} · {source.licenseUrl ? <a href={source.licenseUrl} target="_blank" rel="noreferrer">{source.license}</a> : source.license}</p>
      <p><strong>Used for:</strong> {source.use}</p>
      <blockquote>{source.credit}</blockquote>
    </section>)}
    <p className="cq-market-note">Educational guidance, not a guarantee of career outcomes. Pay figures describe posted salaries, not offers.</p>
  </main>;
}
