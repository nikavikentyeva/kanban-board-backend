import { all, run } from '../database';

const STEP = 1000;

export async function calculatePosition(
  parentId: string,
  targetIndex: number,
  table: 'tasks' | 'columns',
  parentField: 'columnId' | 'boardId',
  excludeId?: string
): Promise<number> {
  const items = await all<{ id: string; position: number }>(
    `SELECT id, position FROM ${table} WHERE ${parentField} = ? ORDER BY position ASC`,
    [parentId]
  );

  // Исключаем перемещаемый элемент из списка
  const filtered = excludeId ? items.filter((item) => item.id !== excludeId) : items;

  // Вставка в пустую колонку/доску
  if (filtered.length === 0) {
    return STEP;
  }

  // Вставка в начало
  if (targetIndex <= 0) {
    const firstPos = filtered[0]!.position;
    const newPos = Math.floor(firstPos / 2);
    if (newPos >= 1) {
      return newPos;
    }
    await rebalance(table, parentField, parentId, excludeId);
    return calculatePosition(parentId, targetIndex, table, parentField, excludeId);
  }

  // Вставка в конец
  if (targetIndex >= filtered.length) {
    const lastPos = filtered[filtered.length - 1]!.position;
    return lastPos + STEP;
  }

  // Вставка между двумя элементами
  const prevPos = filtered[targetIndex - 1]!.position;
  const nextPos = filtered[targetIndex]!.position;
  const newPos = Math.floor((prevPos + nextPos) / 2);

  if (newPos > prevPos && newPos < nextPos) {
    return newPos;
  }

  // Нет свободного места — ребалансируем
  await rebalance(table, parentField, parentId, excludeId);
  return calculatePosition(parentId, targetIndex, table, parentField, excludeId);
}

async function rebalance(
  table: 'tasks' | 'columns',
  parentField: 'columnId' | 'boardId',
  parentId: string,
  excludeId?: string
): Promise<void> {
  const items = await all<{ id: string }>(
    `SELECT id FROM ${table} WHERE ${parentField} = ? ORDER BY position ASC`,
    [parentId]
  );

  const filtered = excludeId ? items.filter((item) => item.id !== excludeId) : items;

  for (let i = 0; i < filtered.length; i++) {
    const newPos = (i + 1) * STEP;
    await run(`UPDATE ${table} SET position = ? WHERE id = ?`, [newPos, filtered[i]!.id]);
  }
}
