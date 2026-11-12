import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export type LocalResumeDraft = {
  name: string | null;
  education: string[];
  experience: string[];
  skills: string[];
  certifications: string[];
  projects: string[];
};

export type LocalResumeResult = {
  filename: string;
  character_count: number;
  draft: LocalResumeDraft;
  message: string;
};

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_CHARACTERS = 100_000;
const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "txt"]);

const SECTION_ALIASES: Record<string, keyof Omit<LocalResumeDraft, "name"> | "other"> = {
  education: "education",
  "academic background": "education",
  "academic experience": "education",
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  "relevant experience": "experience",
  "employment history": "experience",
  "work history": "experience",
  "career history": "experience",
  "volunteer experience": "experience",
  skills: "skills",
  "technical skills": "skills",
  "core competencies": "skills",
  certifications: "certifications",
  "licenses and certifications": "certifications",
  projects: "projects",
  "selected projects": "projects",
  "academic projects": "projects",
  summary: "other",
  "professional summary": "other",
  objective: "other",
  awards: "other",
  activities: "other",
};

const KNOWN_SKILLS = [
  "Python", "JavaScript", "TypeScript", "React", "SQL", "Excel", "Tableau",
  "Power BI", "FastAPI", "Leadership", "Communication", "Project Management",
  "Data Analysis", "Customer Service", "Marketing", "Sales", "Research",
];

function headingFor(line: string) {
  const normalized = line.toLowerCase().replace(/[^a-z& ]/g, "").replace(/&/g, "and").replace(/\s+/g, " ").trim();
  if (SECTION_ALIASES[normalized]) return SECTION_ALIASES[normalized];
  const words = normalized.split(" ");
  const letters = [...line].filter((character) => /[a-z]/i.test(character));
  const uppercaseRatio = letters.filter((character) => character === character.toUpperCase()).length / Math.max(letters.length, 1);
  if (words.length <= 6 && uppercaseRatio >= 0.75) {
    if (words.includes("experience")) return "experience";
    if (words.includes("education")) return "education";
    if (words.includes("skills")) return "skills";
    if (words.includes("projects")) return "projects";
    if (words.some((word) => word.startsWith("certif"))) return "certifications";
  }
  return null;
}

function normalizeLines(text: string) {
  return text.replace(/\uf0b7/g, "•").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    if (/^[•*]/.test(line)) return `• ${line.replace(/^[•*\s]+/, "")}`;
    return line.replace(/^-\s+/, "");
  });
}

function extractSections(lines: string[]) {
  const sections = { education: [] as string[], experience: [] as string[], skills: [] as string[], certifications: [] as string[], projects: [] as string[] };
  let active: keyof typeof sections | null = null;
  for (const line of lines) {
    const heading = headingFor(line.replace(/:$/, ""));
    if (heading) {
      active = heading === "other" ? null : heading;
    } else if (active && sections[active].length < 60) {
      sections[active].push(line.slice(0, 300));
    }
  }
  return sections;
}

function extractName(lines: string[]) {
  for (const line of lines.slice(0, 10)) {
    if (headingFor(line.replace(/:$/, ""))) break;
    const candidate = line.replace(/^[ |,]+|[ |,]+$/g, "");
    if (candidate.includes("@") || /https?:\/\//.test(candidate) || /\d/.test(candidate)) continue;
    const words = candidate.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && words.every((word) => /^[A-Za-z][A-Za-z'.-]*$/.test(word))) {
      return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
    }
  }
  return null;
}

function extractCertifications(text: string) {
  const patterns: Array<[RegExp, string | null]> = [
    [/Lean Six Sigma White(?:,| and)? Yellow(?:,? and)? Green Belts?/i, "Lean Six Sigma White, Yellow, and Green Belts"],
    [/Lean Six Sigma (?:White|Yellow|Green|Black) Belt/i, null], [/\bNREMT\b/i, "NREMT"],
    [/\bHIPAA(?: training| certification)?\b/i, "HIPAA"], [/\bBLS\b/i, "BLS"], [/\bCPR\b/i, "CPR"],
    [/\bAED\b/i, "AED"], [/\bFirst Aid\b/i, "First Aid"], [/\bPMP\b/i, "PMP"],
    [/\bCertified ScrumMaster\b|\bCSM\b/i, "Certified ScrumMaster (CSM)"],
    [/\bCompTIA (?:A\+|Network\+|Security\+)\b/i, null], [/\bAWS Certified [A-Za-z -]+/i, null],
    [/\bMicrosoft Certified: [A-Za-z0-9 &-]+/i, null],
    [/\bGoogle (?:Data Analytics|Project Management|Cybersecurity) Professional Certificate\b/i, null],
  ];
  const found: string[] = [];
  for (const [pattern, canonical] of patterns) {
    const match = text.match(pattern);
    const value = canonical ?? match?.[0].replace(/^[ ,;•]+|[ ,;•]+$/g, "");
    if (value && !found.includes(value)) found.push(value);
  }
  return found;
}

function extractSkills(text: string, skillLines: string[]) {
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    let skill = raw.replace(/^[•*\-\s.]+|[•*\-\s.]+$/g, "");
    const tool = skill.match(/^(Excel|Python)\s*\([^)]*\)$/i);
    if (tool) skill = tool[1][0].toUpperCase() + tool[1].slice(1).toLowerCase();
    const key = skill.toLowerCase();
    if (skill && skill.length <= 80 && !seen.has(key)) { found.push(skill); seen.add(key); }
  };
  for (const line of skillLines) {
    let value = line.replace(/^[•*\-\s]+/, "").trim();
    const colon = value.indexOf(":");
    if (colon > -1 && value.slice(0, colon).trim().split(/\s+/).length <= 5) value = value.slice(colon + 1).trim();
    value.split(/[;|]|,(?![^()]*\))/).forEach(add);
  }
  [...KNOWN_SKILLS].sort().forEach((term) => {
    if (!found.some((skill) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(skill)) && new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) add(term);
  });
  return found;
}

function rankSkills(skills: string[], educationLines: string[]) {
  const education = educationLines.join(" ").toLowerCase();
  const priorities: string[] = [];
  if (/(analytics|data science|statistics)/.test(education)) priorities.push("python", "sql", "excel", "data analysis", "data analytics", "machine learning", "nlp", "data quality", "data validation", "visualization", "tableau", "power bi", "predictive", "modeling", "automation", "rest api", "javascript");
  if (/(healthcare|health care|clinical)/.test(education)) priorities.push("healthcare informatics", "clinical", "healthcare", "hipaa", "nlp", "data quality");
  if (/(business|marketing|management)/.test(education)) priorities.push("business", "marketing", "stakeholder", "communication", "process", "project management", "operational");
  if (!priorities.length) return skills.slice(0, 10);
  return skills.map((skill, index) => ({ skill, index, score: Math.max(0, ...priorities.map((word, rank) => skill.toLowerCase().includes(word) ? 30 - rank : 0)) })).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 10).map(({ skill }) => skill);
}

export function buildLocalDraft(text: string): LocalResumeDraft {
  const lines = normalizeLines(text);
  const sections = extractSections(lines);
  return {
    name: extractName(lines),
    education: sections.education,
    experience: sections.experience,
    skills: rankSkills(extractSkills(text, sections.skills), sections.education),
    certifications: extractCertifications(text),
    projects: sections.projects,
  };
}

type PdfTextFragment = { str: string; transform: number[]; hasEOL?: boolean };

export function pdfTextToLines(items: PdfTextFragment[]) {
  const lines: string[] = [];
  let current: PdfTextFragment[] = [];
  let currentY: number | null = null;

  const flush = () => {
    const line = current
      .sort((left, right) => left.transform[4] - right.transform[4])
      .map((item) => item.str.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) lines.push(line);
    current = [];
    currentY = null;
  };

  for (const item of items) {
    const y = item.transform[5];
    if (currentY !== null && Math.abs(y - currentY) > 2) flush();
    current.push(item);
    currentY = currentY === null ? y : (currentY + y) / 2;
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}

async function extractPdf(buffer: ArrayBuffer) {
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const content = await (await document.getPage(pageNumber)).getTextContent();
    const fragments = content.items.filter((item): item is typeof item & PdfTextFragment => "str" in item && "transform" in item);
    pages.push(pdfTextToLines(fragments).join("\n"));
  }
  return pages.join("\n");
}

export async function processResumeLocally(file: File): Promise<LocalResumeResult> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error("Upload a PDF, DOCX, or TXT résumé.");
  if (file.size > MAX_BYTES) throw new Error("The file is larger than the 5 MB limit.");
  if (!file.size) throw new Error("The uploaded file is empty.");
  const buffer = await file.arrayBuffer();
  let text: string;
  try {
    if (extension === "pdf") text = await extractPdf(buffer);
    else if (extension === "docx") text = (await mammoth.extractRawText({ arrayBuffer: buffer })).value;
    else text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new Error(`This ${extension.toUpperCase()} could not be read. Try exporting it again or enter details manually.`);
  }
  const normalized = text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").replace(/\uf0b7/g, "•").trim().slice(0, MAX_CHARACTERS);
  if (!normalized) throw new Error("No readable text was found. Try another file or enter details manually.");
  return {
    filename: file.name,
    character_count: normalized.length,
    draft: buildLocalDraft(normalized),
    message: "Your résumé was processed privately in this browser and was not uploaded.",
  };
}
