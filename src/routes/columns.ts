import { Router } from 'express';
import { run, get, all } from '../database';
import { calculatePosition } from '../utils/position';

const router = Router({ mergeParams: true });

interface ColumnRow {
  id: string;
  boardId: string;
  title: string;
  position: number;
}

interface BoardRow {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// POST /api/boards/:boardId/columns — создать колонку
router.post('/', async (req, res) => {
  const { boardId } = req.params as { boardId: string };
  const { title } = req.body;

  // Проверяем, что доска существует
  const board = await get<BoardRow>('SELECT * FROM boards WHERE id = ?', [boardId]);
  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  // Определяем position: максимальный + 1, или 0 если колонок ещё нет
  const maxResult = await get<{ maxPos: number | null }>(
    'SELECT MAX(position) as maxPos FROM columns WHERE boardId = ?',
    [boardId]
  );
  const position = (maxResult?.maxPos ?? 0) + 1000;

  const id = crypto.randomUUID();

  await run('INSERT INTO columns (id, boardId, title, position) VALUES (?, ?, ?, ?)', [
    id,
    boardId,
    title.trim(),
    position,
  ]);

  const column = await get<ColumnRow>('SELECT * FROM columns WHERE id = ?', [id]);
  res.status(201).json(column);
});

// PATCH /api/columns/:id — переименовать колонку
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  const column = await get<ColumnRow>('SELECT * FROM columns WHERE id = ?', [id]);
  if (!column) {
    res.status(404).json({ error: 'Column not found' });
    return;
  }

  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  await run('UPDATE columns SET title = ? WHERE id = ?', [title.trim(), id]);

  const updated = await get<ColumnRow>('SELECT * FROM columns WHERE id = ?', [id]);
  res.json(updated);
});

// DELETE /api/columns/:id — удалить колонку
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const column = await get<ColumnRow>('SELECT * FROM columns WHERE id = ?', [id]);
  if (!column) {
    res.status(404).json({ error: 'Column not found' });
    return;
  }

  await run('DELETE FROM columns WHERE id = ?', [id]);
  res.status(204).send();
});

// PATCH /api/columns/:id/move — переместить колонку
router.patch('/:id/move', async (req, res) => {
  const { id } = req.params;
  const { targetIndex } = req.body;

  const column = await get<ColumnRow>('SELECT * FROM columns WHERE id = ?', [id]);
  if (!column) {
    res.status(404).json({ error: 'Column not found' });
    return;
  }

  if (typeof targetIndex !== 'number' || !Number.isInteger(targetIndex)) {
    res.status(400).json({ error: 'targetIndex must be an integer' });
    return;
  }

  const position = await calculatePosition(column.boardId, targetIndex, 'columns', 'boardId', id);
  await run('UPDATE columns SET position = ? WHERE id = ?', [position, id]);

  const updated = await get<ColumnRow>('SELECT * FROM columns WHERE id = ?', [id]);
  res.json(updated);
});

export default router;
