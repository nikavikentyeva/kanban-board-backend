import { Router } from 'express';
import { run, get, all } from '../database';

const router = Router();

interface BoardRow {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ColumnRow {
  id: string;
  boardId: string;
  title: string;
  position: number;
}

interface TaskRow {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
}

// GET /api/boards
router.get('/', async (_req, res) => {
  const boards = await all<BoardRow>('SELECT * FROM boards ORDER BY updatedAt DESC');
  res.json(boards);
});

// POST /api/boards
router.post('/', async (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await run('INSERT INTO boards (id, title, createdAt, updatedAt) VALUES (?, ?, ?, ?)', [
    id,
    title.trim(),
    now,
    now,
  ]);

  const board = await get<BoardRow>('SELECT * FROM boards WHERE id = ?', [id]);
  res.status(201).json(board);
});

// GET /api/boards/:boardId/search?q=term
router.get('/:boardId/search', async (req, res) => {
  const { boardId } = req.params;
  const { q } = req.query;

  const board = await get<BoardRow>('SELECT * FROM boards WHERE id = ?', [boardId]);
  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    res.status(400).json({ error: 'Query parameter q is required' });
    return;
  }

  const searchTerm = q.trim().toLowerCase();
  const allTasks = await all<TaskRow>(
    `SELECT tasks.* FROM tasks
     JOIN columns ON tasks.columnId = columns.id
     WHERE columns.boardId = ?
     ORDER BY tasks.position ASC`,
    [boardId]
  );

  const tasks = allTasks.filter((task) => {
    const title = (task.title || '').toLowerCase();
    const description = (task.description || '').toLowerCase();
    return title.includes(searchTerm) || description.includes(searchTerm);
  });

  res.json(tasks);
});

// GET /api/boards/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const board = await get<BoardRow>('SELECT * FROM boards WHERE id = ?', [id]);
  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  const columns = await all<ColumnRow>(
    'SELECT * FROM columns WHERE boardId = ? ORDER BY position ASC',
    [id]
  );

  const columnIds = columns.map((c) => c.id);
  let tasks: TaskRow[] = [];
  if (columnIds.length > 0) {
    const placeholders = columnIds.map(() => '?').join(',');
    tasks = await all<TaskRow>(
      `SELECT * FROM tasks WHERE columnId IN (${placeholders}) ORDER BY position ASC`,
      columnIds
    );
  }

  const columnsWithTasks = columns.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.columnId === col.id),
  }));

  res.json({
    ...board,
    columns: columnsWithTasks,
  });
});

// PATCH /api/boards/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  const board = await get<BoardRow>('SELECT * FROM boards WHERE id = ?', [id]);
  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const now = new Date().toISOString();
  await run('UPDATE boards SET title = ?, updatedAt = ? WHERE id = ?', [title.trim(), now, id]);

  const updated = await get<BoardRow>('SELECT * FROM boards WHERE id = ?', [id]);
  res.json(updated);
});

// DELETE /api/boards/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const board = await get<BoardRow>('SELECT * FROM boards WHERE id = ?', [id]);
  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  await run('DELETE FROM boards WHERE id = ?', [id]);
  res.status(204).send();
});

export default router;
