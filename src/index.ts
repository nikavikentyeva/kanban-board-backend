import express from 'express';
import cors from 'cors';
import { initDatabase } from './database';
import boardsRouter from './routes/boards';
import columnsRouter from './routes/columns';
import tasksRouter from './routes/tasks';

const app = express();

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || '*';

app.use(cors({ origin: CLIENT_URL }));
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

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
