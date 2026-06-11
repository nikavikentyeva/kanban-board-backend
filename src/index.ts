import express from 'express';
import cors from 'cors';
import { initDatabase } from './database';
import boardsRouter from './routes/boards';
import columnsRouter from './routes/columns';
import tasksRouter from './routes/tasks';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/boards', boardsRouter);
app.use('/api/boards/:boardId/columns', columnsRouter);
app.use('/api/columns', columnsRouter);
app.use('/api/columns/:columnId/tasks', tasksRouter);
app.use('/api/tasks', tasksRouter);

async function main() {
  await initDatabase();

  app.listen(3001, () => {
    console.log('Server running on http://localhost:3001');
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
