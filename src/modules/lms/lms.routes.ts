import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'LMS routes working' });
});

export { router as lmsRoutes };
