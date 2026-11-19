import { describe, expect, it } from 'vitest';
import { buildMilestones } from './model';
import { emptyProfile } from '../character/model';
const plan = { goal: 'Enter a career', role: 'Teacher', priorities: ['Stability'], horizon: '3–5 yrs', budget: '<$1K' };
describe('roadmap actions', () => {
  it('gives students supervised exploration and explicit deliverables', () => {
    const phases = buildMilestones(plan, 'direct', { ...emptyProfile(), life_stage: 'high_school' });
    expect(phases.flatMap(p => p.items)).toHaveLength(12);
    expect(phases[2].items[0].title).toContain('school counselor');
    expect(phases[0].items[0].title).toContain('Teacher');
    expect(phases[0].items[2].proof).toContain('<$1K');
    expect(phases.every(p => p.items.every(i => i.proof.length > 60))).toBe(true);
  });
  it('changes concrete work for learning, promotion, and business routes', () => {
    expect(buildMilestones(plan, 'skills', emptyProfile())[1].items[1].title).toContain('learning options');
    expect(buildMilestones({ ...plan, goal: 'Earn a promotion' }, 'direct', emptyProfile())[2].items[1].title).toContain('3 examples');
    expect(buildMilestones({ ...plan, goal: 'Start a business' }, 'direct', emptyProfile())[1].items[0].title).toContain('5 potential customers');
  });
  it('targets real skill gaps when they are known', () => {
    const phases = buildMilestones(plan, 'direct', emptyProfile(), ['Mathematics', 'SQL']);
    expect(phases[1].items[0].title).toBe('Build evidence for Mathematics');
    expect(phases[1].items[0].proof).toContain('Mathematics, SQL');
    expect(phases[0].items[0].proof).toContain('Mathematics, SQL');
    expect(buildMilestones(plan, 'direct', emptyProfile())[1].items[0].title).toContain('Choose one documented skill gap');
  });
});
