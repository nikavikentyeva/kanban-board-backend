import { Router } from 'express';
import { run, get, all } from '../database';
import { calculatePosition } from '../utils/position';

const router = Router({ mergeParams: true });

interface TaskRow {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
}

interface ColumnRow {
  id: string;
  boardId: string;
  title: string;
  position: number;
}

// POST /api/columns/:columnId/tasks — создать задачу
router.post('/', async (req, res) => {
  const { columnId } = req.params as { columnId: string };
  const { title, description } = req.body;

  // Проверяем, что колонка существует
  const column = await get<ColumnRow>('SELECT * FROM columns WHERE id = ?', [columnId]);
  if (!column) {
    res.status(404).json({ error: 'Column not found' });
    return;
  }

  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  // Определяем position: максимальный + 1, или 0 если задач ещё нет
  const maxResult = await get<{ maxPos: number | null }>(
    'SELECT MAX(position) as maxPos FROM tasks WHERE columnId = ?',
    [columnId]
  );
  const position = (maxResult?.maxPos ?? 0) + 1000;

  const id = crypto.randomUUID();
  const desc = typeof description === 'string' ? description.trim() || null : null;

  await run(
    'INSERT INTO tasks (id, columnId, title, description, position) VALUES (?, ?, ?, ?, ?)',
    [id, columnId, title.trim(), desc, position]
  );

  const task = await get<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
  res.status(201).json(task);
});

// GET /api/tasks/:id — получить задачу
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const task = await get<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  res.json(task);
});

// PATCH /api/tasks/:id — обновить title и/или description
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;

  const task = await get<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'Title must be a non-empty string' });
      return;
    }
    updates.push('title = ?');
    values.push(title.trim());
  }

  if (description !== undefined) {
    updates.push('description = ?');
    values.push(typeof description === 'string' ? description.trim() || null : null);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  values.push(id);
  await run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);

  const updated = await get<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
  res.json(updated);
});

// DELETE /api/tasks/:id — удалить задачу
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const task = await get<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  await run('DELETE FROM tasks WHERE id = ?', [id]);
  res.status(204).send();
});

// PATCH /api/tasks/:id/move — переместить задачу
router.patch('/:id/move', async (req, res) => {
  const { id } = req.params;
  const { columnId, targetIndex } = req.body;

  const task = await get<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (typeof targetIndex !== 'number' || !Number.isInteger(targetIndex)) {
    res.status(400).json({ error: 'targetIndex must be an integer' });
    return;
  }

  const targetColumnId = typeof columnId === 'string' ? columnId : task.columnId;

  // Если колонка меняется, проверяем что она существует
  if (columnId !== undefined && columnId !== task.columnId) {
    const column = await get<ColumnRow>('SELECT * FROM columns WHERE id = ?', [targetColumnId]);
    if (!column) {
      res.status(404).json({ error: 'Column not found' });
      return;
    }
  }

  const position = await calculatePosition(targetColumnId, targetIndex, 'tasks', 'columnId', id);

  await run('UPDATE tasks SET columnId = ?, position = ? WHERE id = ?', [
    targetColumnId,
    position,
    id,
  ]);

  const updated = await get<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
  res.json(updated);
});

export default router;
