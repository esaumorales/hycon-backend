import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Orders routes working' });
});

export { router as orderRoutes };
