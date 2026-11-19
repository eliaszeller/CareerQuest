import type { CharacterProfile } from "../character/model";

export type RoadmapPlan = { goal: string; role: string; priorities: string[]; horizon: string; budget: string };
/** `gaps` are skills O*NET and job postings list for the role that the profile doesn't show yet. */
export function buildMilestones(plan: RoadmapPlan, route: string, profile: CharacterProfile, gaps: string[] = []) {
  const student = profile.life_stage === "high_school";
  const learning = route === "skills" || plan.goal === "More education";
  const promotion = plan.goal === "Earn a promotion";
  const business = plan.goal === "Start a business";
  const priorities = plan.priorities.join(", ") || "your chosen priorities";
  const gapList = gaps.slice(0, 3).join(", ");
  const gapCheck = gaps.length ? ` Check how often they ask for ${gapList}, which your profile doesn’t show yet.` : "";
  return [
    { phase: "Days 1–7", title: "Verify the requirements", reward: "Research brief", items: [
      { title: `Compare 3 real ${plan.role} opportunities`, proof: `Save the source links and dates. Record required education, experience, location, and recurring skills in a comparison table.${gapCheck}` },
      { title: "Confirm the entry requirements", proof: "Check an official employer, training provider, or licensing authority. Write down prerequisites, minimum age where relevant, application dates, and any required credential. Mark anything still unverified." },
      { title: "Set a workable time and cost limit", proof: `Create a weekly schedule with two study or exploration sessions. List fees, materials, and travel against your ${plan.budget} budget; identify a free alternative before paying.` },
    ] },
    { phase: "Days 8–30", title: business ? "Test the customer problem" : "Produce evidence of a skill", reward: "Reviewed work sample", items: [
      { title: business ? "Interview 5 potential customers" : gaps.length ? `Build evidence for ${gaps[0]}` : `Choose one documented skill gap for ${plan.role}`, proof: business ? "Ask about the problem and current alternatives. Keep anonymized notes and summarize which needs recur; do not treat compliments as demand." : gaps.length ? `O*NET and job postings for ${plan.role} list ${gapList}, and your profile doesn’t show ${gaps.length > 1 ? "them" : "it"} yet. Start with ${gaps[0]}: define a small practice task and a three-point checklist for assessing it, then confirm it against your comparison table.` : "Use your comparison table to select one recurring requirement. Define a small practice task and a three-point checklist for assessing it." },
      { title: learning ? "Compare 3 learning options and finish a trial lesson" : "Complete one safe, relevant practice project", proof: learning ? "Record prerequisites, total cost, weekly workload, and the credential awarded. Complete a free lesson or sample assignment before enrolling." : "Spend 4–6 scheduled sessions on a sample, such as a lesson outline, spreadsheet analysis, policy brief, or supervised practical exercise. Use public or fictional data; regulated work requires proper supervision." },
      { title: "Get specific feedback and revise once", proof: "Ask a teacher, supervisor, advisor, or practitioner to assess the sample against your checklist. Save the feedback, one revised version, and a short explanation of what changed." },
    ] },
    { phase: "Days 31–60", title: student ? "Test the path with support" : promotion ? "Build a promotion case" : "Test a realistic next step", reward: "Opportunity tracker", items: [
      { title: student ? "Meet a school counselor or trusted advisor" : "Complete 2 career conversations", proof: student ? "Bring your requirements table and work sample. Agree on one age-appropriate course, club, supervised placement, or training route and record its prerequisites." : "Prepare five questions about daily tasks, entry routes, costs, and working conditions. Record what each conversation confirmed or contradicted." },
      { title: promotion ? "Document 3 examples of impact" : business ? "Run one small demand test" : "Prepare one targeted application package", proof: promotion ? "For each example, record the situation, your action, and a verifiable outcome. Map the evidence to written expectations for the next level and ask your manager about gaps." : business ? "Define the offer, expected cost, success metric, and a spending cap before testing. Record actual responses and costs without assuming future sales." : "Draft a résumé or student activity summary, a short statement of interest, and your work sample. Ask someone to review accuracy and relevance before submitting." },
      { title: student ? "Request 2 suitable exploration opportunities" : learning ? "Check eligibility for 2 training pathways" : "Pursue 3 opportunities you qualify for", proof: "Track the organization, source link, eligibility, deadline, action taken, and follow-up date. A course, apprenticeship inquiry, internal assignment, or supervised experience can count; do not apply where prerequisites are unmet." },
    ] },
    { phase: "Days 61–90", title: "Make an evidence-based decision", reward: "Next-quarter plan", items: [
      { title: "Review the results of your outreach", proof: "Count responses, feedback received, and remaining requirements. Follow up once where appropriate. If you received no replies, ask an advisor to review the approach before increasing volume." },
      { title: "Compare 2 feasible next steps", proof: `Write a decision table covering verified eligibility, total cost, weekly time, location, and ${priorities}. Separate sourced facts from estimates and unknowns.` },
      { title: "Commit to one next step and a review date", proof: `Choose a course, project, application, or further exploration toward ${plan.role}. Record the first action, due date, cost ceiling, backup option, and a check-in 30 days later. Your ${plan.horizon} horizon may extend beyond this plan.` },
    ] },
  ];
}
