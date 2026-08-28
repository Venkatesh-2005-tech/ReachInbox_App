import { Router } from 'express';
import { getSenders, createSender, deleteSender } from '../controllers/senderController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', getSenders);
router.post('/', createSender);
router.delete('/:id', deleteSender);

export default router;
