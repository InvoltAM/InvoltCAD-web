import { Plan } from '../model/Plan';

const CURRENT_VERSION = 1;

export interface SerializedPlan {
  version: number;
  plan: object;
}

/**
 * JSON сериализация / десериализация плана с версионированием.
 */
export class PlanSerializer {
  static serialize(plan: Plan): string {
    const data: SerializedPlan = {
      version: CURRENT_VERSION,
      plan: plan.toJSON(),
    };
    return JSON.stringify(data, null, 2);
  }

  static deserialize(json: string): Plan {
    try {
      const data = JSON.parse(json) as SerializedPlan;
      return Plan.fromJSON(data.plan);
    } catch (e) {
      console.error('Ошибка десериализации плана:', e);
      return new Plan();
    }
  }
}
