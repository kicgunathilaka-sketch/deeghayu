import { Router, Request, Response } from 'express';
import { pool } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { config } from '../../config';

const router = Router();
router.use(authenticate);

// Return VAPID public key so the browser can subscribe
router.get('/vapid-public-key', (_req: Request, res: Response) => {
  res.json({ success: true, data: { publicKey: config.vapid.publicKey } });
});

// Save a new push subscription
router.post('/', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { endpoint, keys } = req.body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ success: false, message: 'Invalid subscription data' });
    return;
  }

  await pool.query(
    `INSERT INTO push_subscriptions (id, "userId", endpoint, p256dh, auth)
     VALUES (gen_random_uuid(), $1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET "userId" = $1, p256dh = $3, auth = $4`,
    [userId, endpoint, keys.p256dh, keys.auth]
  );

  res.json({ success: true });
});

// Remove a push subscription
router.delete('/', async (req: Request, res: Response) => {
  const { endpoint } = req.body as { endpoint: string };
  if (!endpoint) { res.status(400).json({ success: false, message: 'Missing endpoint' }); return; }

  await pool.query(
    `DELETE FROM push_subscriptions WHERE endpoint = $1 AND "userId" = $2`,
    [endpoint, req.user!.id]
  );
  res.json({ success: true });
});

export default router;
