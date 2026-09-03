import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'ERGO Web routes working' });
});

export { router as ergoRoutes };
