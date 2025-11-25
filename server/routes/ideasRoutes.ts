import { Router, Request, Response } from 'express';
import { db } from '../db';
import { ideas, ideaVotes, users } from '../../shared/schema';
import { eq, desc, sql, and } from 'drizzle-orm';

const router = Router();

// Get ideas by category
router.get('/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const userId = (req.session as any)?.user?.id;

    // Get ideas with vote counts and user's vote status
    const ideasWithVotes = await db
      .select({
        id: ideas.id,
        title: ideas.title,
        description: ideas.description,
        fullDescription: ideas.fullDescription,
        category: ideas.category,
        author: ideas.author,
        isOfficial: ideas.isOfficial,
        isAdminOnly: ideas.isAdminOnly,
        tags: ideas.tags,
        status: ideas.status,
        upvotes: ideas.upvotes,
        downvotes: ideas.downvotes,
        voteScore: ideas.voteScore,
        createdAt: ideas.createdAt,
        userVoteType: userId ? sql<string>`(SELECT vote_type FROM ${ideaVotes} WHERE ${ideaVotes.ideaId} = ${ideas.id} AND ${ideaVotes.userId} = ${userId} LIMIT 1)` : sql<string>`NULL`,
      })
      .from(ideas)
      .where(and(
        eq(ideas.category, category),
        eq(ideas.status, 'active')
      ))
      .orderBy(desc(ideas.voteScore));

    // Format results with additional metadata
    const formattedIdeas = ideasWithVotes.map(idea => ({
      ...idea,
      isNew: idea.createdAt ? new Date(idea.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000 : false, // 7 days
      isTrending: (idea.voteScore || 0) > 10, // Simple trending logic
      tags: idea.tags ? JSON.parse(idea.tags) : [],
      votes: idea.voteScore || 0, // For compatibility
    }));

    res.json(formattedIdeas);
  } catch (error) {
    console.error('Error fetching ideas:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ideas' });
  }
});

// Vote on an idea
router.post('/vote', async (req: Request, res: Response) => {
  try {
    const { ideaId, voteType } = req.body;
    const userId = (req.session as any)?.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!ideaId || !['up', 'down'].includes(voteType)) {
      return res.status(400).json({ success: false, message: 'Invalid vote data' });
    }

    // Check if user has already voted on this idea
    const existingVote = await db
      .select()
      .from(ideaVotes)
      .where(and(
        eq(ideaVotes.ideaId, ideaId),
        eq(ideaVotes.userId, userId)
      ))
      .limit(1);

    let oldVoteType = null;
    if (existingVote.length > 0) {
      oldVoteType = existingVote[0].voteType;
      // Update existing vote
      await db
        .update(ideaVotes)
        .set({ voteType })
        .where(and(
          eq(ideaVotes.ideaId, ideaId),
          eq(ideaVotes.userId, userId)
        ));
    } else {
      // Create new vote
      await db
        .insert(ideaVotes)
        .values({
          ideaId,
          userId,
          voteType
        });
    }

    // Update vote counts in ideas table
    const currentIdea = await db
      .select()
      .from(ideas)
      .where(eq(ideas.id, ideaId))
      .limit(1);

    if (currentIdea.length > 0) {
      let upvotes = currentIdea[0].upvotes || 0;
      let downvotes = currentIdea[0].downvotes || 0;

      // Adjust counts based on vote changes
      if (oldVoteType === 'up' && voteType === 'down') {
        upvotes--;
        downvotes++;
      } else if (oldVoteType === 'down' && voteType === 'up') {
        downvotes--;
        upvotes++;
      } else if (!oldVoteType && voteType === 'up') {
        upvotes++;
      } else if (!oldVoteType && voteType === 'down') {
        downvotes++;
      }

      const voteScore = upvotes - downvotes;

      await db
        .update(ideas)
        .set({ upvotes, downvotes, voteScore })
        .where(eq(ideas.id, ideaId));
    }

    res.json({ success: true, message: 'Vote recorded successfully' });
  } catch (error) {
    console.error('Error recording vote:', error);
    res.status(500).json({ success: false, message: 'Failed to record vote' });
  }
});

// Submit a new idea (Admin only)
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const { title, description, fullDescription, category, tags, isAdminSubmission } = req.body;
    const userId = (req.session as any)?.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Restrict to admin-only submissions
    if (!isAdminSubmission) {
      return res.status(403).json({ success: false, message: 'Ideas can only be submitted by administrators. Please contact support to suggest new ideas.' });
    }

    if (!title || !description || !category) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Get user info for author name
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const author = user[0].firstName && user[0].lastName 
      ? `${user[0].firstName} ${user[0].lastName}`
      : user[0].username || 'AI Assistant';

    // Insert new idea
    const newIdea = await db
      .insert(ideas)
      .values({
        title,
        description,
        fullDescription,
        category,
        userId,
        author,
        isOfficial: true,
        isAdminOnly: true,
        tags: tags ? JSON.stringify(tags) : null,
        status: 'active',
        upvotes: 0,
        downvotes: 0,
        voteScore: 0
      })
      .returning();

    res.json({ success: true, data: newIdea[0] });
  } catch (error) {
    console.error('Error submitting idea:', error);
    res.status(500).json({ success: false, message: 'Failed to submit idea' });
  }
});

// Get idea categories with counts
router.get('/categories/stats', async (req: Request, res: Response) => {
  try {
    const categoryStats = await db
      .select({
        category: ideas.category,
        count: sql<number>`COUNT(*)`,
        recentCount: sql<number>`COUNT(CASE WHEN ${ideas.createdAt} > NOW() - INTERVAL '7 days' THEN 1 END)`
      })
      .from(ideas)
      .where(eq(ideas.status, 'active'))
      .groupBy(ideas.category);

    res.json({ success: true, data: categoryStats });
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch category stats' });
  }
});

export default router;