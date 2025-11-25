import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// ULTRA-SIMPLE test version - just returns static data
router.get('/', (req: Request, res: Response) => {
  console.log('📰 News feed request received');
  
  res.json({
    success: true,
    articles: [
      {
        id: 1,
        title: 'Test Article 1',
        source: 'Test Source',
        publishedDate: new Date().toISOString(),
        imageUrl: '/news-images/article_0_5748.png',
        aiSummary: 'This is a test article',
        url: 'https://example.com',
        politicianName: 'Test TD',
        impactScore: 85,
        storyType: 'policy_work',
        sentiment: 'positive',
        likes: 0,
        commentCount: 0,
        comments: []
      }
    ],
    total: 1,
    has_more: false,
    last_updated: new Date().toISOString(),
    source: 'Simple Test Mode',
    sort: 'recent'
  });
});

router.post('/save', (req: Request, res: Response) => {
  res.status(201).json({ success: true, message: 'Test mode - not saved' });
});

router.get('/td/:name', (req: Request, res: Response) => {
  res.json({ success: true, articles: [], count: 0 });
});

export default router;























