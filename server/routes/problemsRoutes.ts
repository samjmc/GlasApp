import { Router, Request, Response } from 'express';
import { db } from '../db';
import { problems, solutions, problemVotes, solutionVotes, users } from '../../shared/schema';
import { eq, desc, sql, and } from 'drizzle-orm';

const router = Router();

// Get problems by category with their solutions
router.get('/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const userId = (req.session as any)?.user?.id;

    // Get problems with vote counts and user's vote status
    const problemsWithVotes = await db
      .select({
        id: problems.id,
        title: problems.title,
        description: problems.description,
        category: problems.category,
        author: problems.author,
        isOfficial: problems.isOfficial,
        isAdminOnly: problems.isAdminOnly,
        tags: problems.tags,
        status: problems.status,
        upvotes: problems.upvotes,
        downvotes: problems.downvotes,
        voteScore: problems.voteScore,
        createdAt: problems.createdAt,
        userVoteType: userId ? sql<string>`(SELECT vote_type FROM ${problemVotes} WHERE ${problemVotes.problemId} = ${problems.id} AND ${problemVotes.userId} = ${userId} LIMIT 1)` : sql<string>`NULL`,
      })
      .from(problems)
      .where(and(
        eq(problems.category, category),
        eq(problems.status, 'active')
      ))
      .orderBy(desc(problems.voteScore));

    // Get solutions for each problem
    const problemsWithSolutions = await Promise.all(
      problemsWithVotes.map(async (problem) => {
        const solutionsWithVotes = await db
          .select({
            id: solutions.id,
            problemId: solutions.problemId,
            title: solutions.title,
            description: solutions.description,
            fullDescription: solutions.fullDescription,
            author: solutions.author,
            isOfficial: solutions.isOfficial,
            tags: solutions.tags,
            upvotes: solutions.upvotes,
            downvotes: solutions.downvotes,
            voteScore: solutions.voteScore,
            createdAt: solutions.createdAt,
            userVoteType: userId ? sql<string>`(SELECT vote_type FROM ${solutionVotes} WHERE ${solutionVotes.solutionId} = ${solutions.id} AND ${solutionVotes.userId} = ${userId} LIMIT 1)` : sql<string>`NULL`,
          })
          .from(solutions)
          .where(and(
            eq(solutions.problemId, problem.id),
            eq(solutions.status, 'active')
          ))
          .orderBy(desc(solutions.voteScore));

        return {
          ...problem,
          isNew: problem.createdAt ? new Date(problem.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000 : false,
          isTrending: (problem.voteScore || 0) > 10,
          tags: problem.tags ? JSON.parse(problem.tags) : [],
          solutions: solutionsWithVotes.map(solution => ({
            ...solution,
            isNew: solution.createdAt ? new Date(solution.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000 : false,
            isTrending: (solution.voteScore || 0) > 5,
            tags: solution.tags ? JSON.parse(solution.tags) : [],
          }))
        };
      })
    );

    res.json(problemsWithSolutions);
  } catch (error) {
    console.error('Error fetching problems:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch problems' });
  }
});

// Vote on a problem
router.post('/vote/problem', async (req: Request, res: Response) => {
  try {
    const { problemId, voteType } = req.body;
    const userId = (req.session as any)?.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!problemId || !['up', 'down'].includes(voteType)) {
      return res.status(400).json({ success: false, message: 'Invalid vote data' });
    }

    // Check if user has already voted on this problem
    const existingVote = await db
      .select()
      .from(problemVotes)
      .where(and(
        eq(problemVotes.problemId, problemId),
        eq(problemVotes.userId, userId)
      ))
      .limit(1);

    let oldVoteType = null;
    if (existingVote.length > 0) {
      oldVoteType = existingVote[0].voteType;
      await db
        .update(problemVotes)
        .set({ voteType })
        .where(and(
          eq(problemVotes.problemId, problemId),
          eq(problemVotes.userId, userId)
        ));
    } else {
      await db
        .insert(problemVotes)
        .values({
          problemId,
          userId,
          voteType
        });
    }

    // Update vote counts in problems table
    const currentProblem = await db
      .select()
      .from(problems)
      .where(eq(problems.id, problemId))
      .limit(1);

    if (currentProblem.length > 0) {
      let upvotes = currentProblem[0].upvotes || 0;
      let downvotes = currentProblem[0].downvotes || 0;

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
        .update(problems)
        .set({ upvotes, downvotes, voteScore })
        .where(eq(problems.id, problemId));
    }

    res.json({ success: true, message: 'Vote recorded successfully' });
  } catch (error) {
    console.error('Error recording problem vote:', error);
    res.status(500).json({ success: false, message: 'Failed to record vote' });
  }
});

// Vote on a solution
router.post('/vote/solution', async (req: Request, res: Response) => {
  try {
    const { solutionId, voteType } = req.body;
    const userId = (req.session as any)?.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!solutionId || !['up', 'down'].includes(voteType)) {
      return res.status(400).json({ success: false, message: 'Invalid vote data' });
    }

    // Check if user has already voted on this solution
    const existingVote = await db
      .select()
      .from(solutionVotes)
      .where(and(
        eq(solutionVotes.solutionId, solutionId),
        eq(solutionVotes.userId, userId)
      ))
      .limit(1);

    let oldVoteType = null;
    if (existingVote.length > 0) {
      oldVoteType = existingVote[0].voteType;
      await db
        .update(solutionVotes)
        .set({ voteType })
        .where(and(
          eq(solutionVotes.solutionId, solutionId),
          eq(solutionVotes.userId, userId)
        ));
    } else {
      await db
        .insert(solutionVotes)
        .values({
          solutionId,
          userId,
          voteType
        });
    }

    // Update vote counts in solutions table
    const currentSolution = await db
      .select()
      .from(solutions)
      .where(eq(solutions.id, solutionId))
      .limit(1);

    if (currentSolution.length > 0) {
      let upvotes = currentSolution[0].upvotes || 0;
      let downvotes = currentSolution[0].downvotes || 0;

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
        .update(solutions)
        .set({ upvotes, downvotes, voteScore })
        .where(eq(solutions.id, solutionId));
    }

    res.json({ success: true, message: 'Vote recorded successfully' });
  } catch (error) {
    console.error('Error recording solution vote:', error);
    res.status(500).json({ success: false, message: 'Failed to record vote' });
  }
});

export default router;