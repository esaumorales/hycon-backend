import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Cart routes working' });
});

export { router as cartRoutes };
