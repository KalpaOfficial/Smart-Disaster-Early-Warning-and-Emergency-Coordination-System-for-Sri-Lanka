import express, { Express } from 'express';
import cors from 'cors';
import reportRouter from './routes/reportRoutes';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Register UC04 Report Routes
  app.use('/api/reports', reportRouter);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'disaster-warning-backend' });
  });

  return app;
}

const app = createApp();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[SERVER] Disaster Warning Backend listening on port ${PORT}`);
  });
}

export default app;
