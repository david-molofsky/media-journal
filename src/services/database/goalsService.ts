import { db } from './db';

/** `{ [year]: { [mediaTypeId]: target } }` */
type GoalsData = Record<string, Record<string, number>>;

async function loadGoalsData(): Promise<GoalsData> {
  const record = await db.appSettings.get('yearly_goals');
  return (record?.value as GoalsData) ?? {};
}

async function saveGoalsData(data: GoalsData): Promise<void> {
  await db.appSettings.put({ key: 'yearly_goals', value: data });
}

/** Returns the target count for every media type in `year` that has
 * one set. Types without a goal are absent from the returned object. */
export async function getGoals(year: number): Promise<Record<string, number>> {
  const data = await loadGoalsData();
  return data[String(year)] ?? {};
}

/** Sets (or clears, when `target` is `undefined`) a single goal. */
export async function setGoal(
  year: number,
  mediaTypeId: string,
  target: number | undefined,
): Promise<void> {
  const data = await loadGoalsData();
  const yearKey = String(year);
  const yearGoals = { ...(data[yearKey] ?? {}) };

  if (target === undefined || target <= 0) {
    delete yearGoals[mediaTypeId];
  } else {
    yearGoals[mediaTypeId] = target;
  }

  await saveGoalsData({ ...data, [yearKey]: yearGoals });
}
