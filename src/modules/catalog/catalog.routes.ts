import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Catalog routes working' });
});

export { router as catalogRoutes };
