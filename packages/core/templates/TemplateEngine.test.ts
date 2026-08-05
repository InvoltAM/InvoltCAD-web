import { describe, it, expect } from 'vitest';
import { Plan } from '../model/Plan';
import { Vector2 } from '../geometry/Vector2';
import {
  createTemplateFromPlan,
  applyTemplateToPlan,
  exportTemplateToJson,
  importTemplateFromJson,
  builtinTemplates,
  ProjectTemplateData,
} from './TemplateEngine';

describe('TemplateEngine', () => {
  function samplePlan(): Plan {
    const plan = new Plan();
    plan.addWall(new Vector2(0, 0), new Vector2(3000, 0), 200);
    plan.addWall(new Vector2(3000, 0), new Vector2(3000, 2000), 200);
    plan.addWall(new Vector2(3000, 2000), new Vector2(0, 2000), 200);
    plan.addWall(new Vector2(0, 2000), new Vector2(0, 0), 200);
    plan.addDevice(plan.walls[0].id, 'socket', 0.5, 0, 1, 'Розетка');
    return plan;
  }

  it('creates template from plan', () => {
    const plan = samplePlan();
    const template = createTemplateFromPlan(plan, 'project', 'Тест', 'описание', 'apartment');
    expect(template.name).toBe('Тест');
    expect(template.templateType).toBe('project');
    expect(template.data.version).toBe(1);
    expect(template.data.plan.walls).toHaveLength(4);
    expect(template.data.plan.devices).toHaveLength(1);
  });

  it('applies template in replace mode', () => {
    const plan = new Plan();
    plan.addWall(new Vector2(0, 0), new Vector2(1000, 0), 200);

    const source = samplePlan();
    const template = createTemplateFromPlan(source, 'project', 'Источник');
    applyTemplateToPlan(plan, template, { mode: 'replace' });

    expect(plan.walls).toHaveLength(4);
    expect(plan.devices).toHaveLength(1);
    expect(plan.walls[0].a.x).toBe(0);
    expect(plan.walls[0].a.y).toBe(0);
  });

  it('applies template with offset in merge mode', () => {
    const plan = samplePlan();
    const source = samplePlan();
    const template = createTemplateFromPlan(source, 'project', 'Источник');

    applyTemplateToPlan(plan, template, { mode: 'merge', offsetMm: { x: 5000, y: 0 } });

    expect(plan.walls.length).toBeGreaterThan(4);
    const shiftedWall = plan.walls.find((w) => w.a.x === 5000 && w.a.y === 0);
    expect(shiftedWall).toBeDefined();
  });

  it('exports and imports template JSON', () => {
    const source = samplePlan();
    const template = createTemplateFromPlan(source, 'room', 'Комната');
    const json = exportTemplateToJson(template);
    const restored = importTemplateFromJson(json);
    expect(restored.name).toBe('Комната');
    expect(restored.data.plan.walls).toHaveLength(4);
  });

  it('provides builtin templates', () => {
    const templates = builtinTemplates();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((t) => t.isBuiltin)).toBe(true);
    expect(templates.some((t) => t.templateType === 'room')).toBe(true);
  });

  it('throws on invalid template data', () => {
    const broken = { id: 'x', name: 'x', templateType: 'project', isBuiltin: false, data: {} } as unknown as ProjectTemplateData;
    expect(() => applyTemplateToPlan(new Plan(), broken)).toThrow('Некорректный формат шаблона');
  });
});
