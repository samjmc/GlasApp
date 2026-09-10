# Using Phase 1 Foundation in Route Consolidation (Phase 2+)

This guide shows how to use the Phase 1 foundation middleware and utilities when consolidating routes in Phase 2 and beyond.

---

## Quick Start: Converting an Existing Route

### Before (Current - Inconsistent)

```typescript
// server/routes/newsFeedRoutes.ts
import { Router } from 'express';
import { supabaseDb } from '../db';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    
    const { data: articles, count, error } = await supabaseDb
      .from('news_articles')
      .select('*')
      .limit(limit)
      .offset(offset);

    if (error) throw error;

    res.json({
      success: true,
      articles: articles || [],
      total: count || 0,
      limit,
      offset,
      // No standardized pagination format
    });
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch articles',
      error: error.message,
      // No standardized error format
    });
  }
});

export default router;
```

**Problems:**
- Pagination extraction duplicated in every route
- Response format inconsistent
- No error handling standardization
- Manual error logging
- No validation of pagination parameters

### After (Phase 2 - Using Foundation)

```typescript
// server/routes/newsFeedRoutes.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { supabaseDb } from '../db';
import { asyncHandler } from '../middleware/errorHandler';
import { extractPagination } from '../middleware/paginationMiddleware';
import { formatPaginatedSuccess, formatError, ErrorCodes } from '../utils/responseFormatters';
import { NotFoundError } from '../utils/errors';

const router = Router();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  // Extract and validate pagination automatically
  const { limit, offset } = extractPagination(req.query, { maxLimit: 100 });

  const { data: articles, count, error } = await supabaseDb
    .from('news_articles')
    .select('*')
    .order('published_date', { ascending: false })
    .limit(limit)
    .offset(offset);

  if (error) throw error;

  // Use standardized response format with pagination
  res.json(
    formatPaginatedSuccess(articles || [], {
      limit,
      offset,
      total: count || 0,
      hasMore: (offset + (articles?.length || 0)) < (count || 0),
    })
  );
}));

export default router;
```

**Benefits:**
- ✓ Automatic pagination parameter extraction
- ✓ Automatic parameter validation (maxLimit constraint)
- ✓ Consistent response format
- ✓ Automatic error handling via asyncHandler
- ✓ Standardized error responses
- ✓ Less boilerplate code

---

## Pattern 1: Simple List with Pagination

**Scenario:** Fetch a list of items with offset-based pagination

```typescript
router.get('/items', asyncHandler(async (req, res) => {
  // 1. Extract pagination
  const { limit, offset } = extractPagination(req.query, { maxLimit: 100 });

  // 2. Query database
  const { data: items, count, error } = await supabaseDb
    .from('items')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  // 3. Format and respond
  res.json(
    formatPaginatedSuccess(items || [], {
      limit,
      offset,
      total: count,
      hasMore: (offset + (items?.length || 0)) < (count || 0),
    })
  );
}));
```

---

## Pattern 2: Cursor-Based Pagination (Infinite Scroll)

**Scenario:** Fetch items for infinite scroll using cursor pagination

```typescript
router.get('/feed', asyncHandler(async (req, res) => {
  // 1. Extract cursor-based pagination
  const { limit, cursor } = extractPagination(req.query, {
    maxLimit: 50,
    allowOffset: false, // Only allow cursor
  });

  // 2. Decode cursor if provided
  let query = supabaseDb
    .from('articles')
    .select('*')
    .order('published_date', { ascending: false });

  if (cursor) {
    const { decodeCursor } = await import('../utils/paginationUtils');
    const lastId = decodeCursor(cursor);
    if (lastId) {
      query = query.lt('published_date', new Date(lastId).toISOString());
    }
  }

  // Fetch limit+1 to determine if there are more items
  const { data: articles, error } = await query.limit(limit + 1);

  if (error) throw error;

  // 3. Calculate hasMore and nextCursor
  const hasMore = (articles?.length || 0) > limit;
  const paginatedArticles = articles?.slice(0, limit) || [];
  
  let nextCursor = null;
  if (hasMore && paginatedArticles.length > 0) {
    const { buildCursorFromId } = await import('../utils/paginationUtils');
    const lastArticle = paginatedArticles[paginatedArticles.length - 1];
    nextCursor = buildCursorFromId(lastArticle.id);
  }

  // 4. Format and respond
  res.json(
    formatPaginatedSuccess(paginatedArticles, {
      limit,
      cursor,
      hasMore,
      nextCursor,
    })
  );
}));
```

---

## Pattern 3: Paginated List with Search/Filters

**Scenario:** Fetch items with pagination, search query, and filters

```typescript
router.get('/articles', asyncHandler(async (req, res) => {
  // 1. Extract pagination
  const { limit, offset } = extractPagination(req.query, { maxLimit: 100 });

  // 2. Extract search and filters from query
  const search = req.query.q as string || '';
  const status = req.query.status as string || 'published';

  // 3. Build query with filters
  let query = supabaseDb
    .from('articles')
    .select('*')
    .eq('status', status);

  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  }

  // 4. Apply pagination
  const { data: articles, count, error } = await query
    .order('published_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  // 5. Format and respond
  res.json(
    formatPaginatedSuccess(articles || [], {
      limit,
      offset,
      total: count,
      hasMore: (offset + (articles?.length || 0)) < (count || 0),
    })
  );
}));
```

---

## Pattern 4: Single Resource with Error Handling

**Scenario:** Fetch a single resource, return error if not found

```typescript
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: article, error } = await supabaseDb
    .from('articles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !article) {
    throw new NotFoundError(`Article ${id}`);
    // asyncHandler catches and passes to errorHandler
    // errorHandler automatically formats response
  }

  // Simple success response (no pagination)
  res.json(formatSuccess(article));
}));
```

---

## Pattern 5: Custom Error Responses

**Scenario:** Handle specific error cases with custom messages and details

```typescript
router.post('/articles', asyncHandler(async (req, res) => {
  const { title, content, authorId } = req.body;

  // Validation errors
  if (!title || !content) {
    return res.status(400).json(
      formatError('VALIDATION_ERROR', 'Title and content are required', {
        missingFields: {
          title: !title,
          content: !content,
        },
      })
    );
  }

  // Check if author exists
  const { data: author, error: authorError } = await supabaseDb
    .from('users')
    .select('id')
    .eq('id', authorId)
    .single();

  if (authorError || !author) {
    return res.status(400).json(
      formatError('INVALID_REFERENCE', 'Author does not exist', {
        authorId,
      })
    );
  }

  // Create article
  const { data: newArticle, error } = await supabaseDb
    .from('articles')
    .insert([{ title, content, author_id: authorId }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json(
        formatError('DUPLICATE_RESOURCE', 'Article with this title already exists')
      );
    }
    throw error;
  }

  res.status(201).json(formatSuccess(newArticle));
}));
```

---

## Pattern 6: Chaining Middleware

**Scenario:** Use pagination middleware globally for all routes

```typescript
// server/index.ts
import { paginationMiddleware } from './middleware/paginationMiddleware';

// Apply pagination middleware to all API routes
app.use('/api', paginationMiddleware({ maxLimit: 100, defaultLimit: 20 }));

// Then in routes, access via req.pagination
router.get('/articles', asyncHandler(async (req, res) => {
  const { limit, offset } = req.pagination; // Already extracted
  
  const { data: articles, count } = await db.getArticles({ limit, offset });
  
  res.json(
    formatPaginatedSuccess(articles, {
      limit,
      offset,
      total: count,
      hasMore: (offset + articles.length) < count,
    })
  );
}));
```

---

## Response Format Examples

### Success Response (Simple)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Article Title",
    "content": "..."
  }
}
```

### Success Response (Paginated)
```json
{
  "success": true,
  "data": [
    { "id": 1, "title": "Article 1" },
    { "id": 2, "title": "Article 2" }
  ],
  "meta": {
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 150,
      "hasMore": true
    }
  }
}
```

### Success Response (Cursor-Based)
```json
{
  "success": true,
  "data": [
    { "id": 1, "title": "Article 1" },
    { "id": 2, "title": "Article 2" }
  ],
  "meta": {
    "pagination": {
      "limit": 20,
      "cursor": "abc123",
      "hasMore": true,
      "nextCursor": "def456"
    }
  }
}
```

### Error Response (Basic)
```json
{
  "success": false,
  "error": {
    "message": "Article not found",
    "code": "NOT_FOUND"
  }
}
```

### Error Response (With Details)
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  }
}
```

---

## Testing Consolidated Routes

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server/index';

describe('News Feed Routes (Phase 2)', () => {
  it('should return paginated articles with new format', async () => {
    const response = await request(app)
      .get('/api/news-feed')
      .query({ limit: 20, offset: 0 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.meta.pagination).toEqual({
      limit: 20,
      offset: 0,
      total: expect.any(Number),
      hasMore: expect.any(Boolean),
    });
  });

  it('should respect maxLimit constraint', async () => {
    const response = await request(app)
      .get('/api/news-feed')
      .query({ limit: 500 }); // Request 500, should be clamped

    expect(response.body.meta.pagination.limit).toBeLessThanOrEqual(100);
  });

  it('should handle cursor pagination', async () => {
    const response = await request(app)
      .get('/api/news-feed')
      .query({ cursor: 'abc123' });

    expect(response.body.meta.pagination.cursor).toBe('abc123');
  });

  it('should return 404 for non-existent article', async () => {
    const response = await request(app)
      .get('/api/articles/99999');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
```

---

## Integration Checklist for Phase 2 Routes

When consolidating a route group, use this checklist:

- [ ] Import `asyncHandler` from `../middleware/errorHandler`
- [ ] Import `extractPagination` from `../middleware/paginationMiddleware`
- [ ] Import `formatSuccess`, `formatError`, `formatPaginatedSuccess` from `../utils/responseFormatters`
- [ ] Import error classes from `../utils/errors`
- [ ] Wrap all route handlers with `asyncHandler()`
- [ ] Replace manual pagination extraction with `extractPagination()`
- [ ] Replace custom response formatting with `formatSuccess()` / `formatPaginatedSuccess()`
- [ ] Replace try/catch blocks with error throwing (caught by asyncHandler)
- [ ] Update response format in tests and documentation
- [ ] Verify TypeScript compiles without errors
- [ ] Run unit tests for pagination and error cases
- [ ] Manual integration test with curl/Postman

---

## Common Mistakes to Avoid

1. **Forgetting asyncHandler wrapper**
   ```typescript
   // ❌ Wrong: Errors won't be caught
   router.get('/items', async (req, res) => { ... });

   // ✓ Right: asyncHandler catches errors
   router.get('/items', asyncHandler(async (req, res) => { ... }));
   ```

2. **Manual error handling inside asyncHandler routes**
   ```typescript
   // ❌ Wrong: Catch blocks won't be needed
   router.get('/item/:id', asyncHandler(async (req, res) => {
     try {
       const item = await db.get(id);
       res.json(formatSuccess(item));
     } catch (error) {
       res.status(500).json(formatError(...)); // Won't reach here
     }
   }));

   // ✓ Right: Let asyncHandler/errorHandler deal with errors
   router.get('/item/:id', asyncHandler(async (req, res) => {
     const item = await db.get(id);
     if (!item) throw new NotFoundError('Item');
     res.json(formatSuccess(item));
   }));
   ```

3. **Not using maxLimit to prevent abuse**
   ```typescript
   // ❌ Wrong: Client can request huge limit
   const { limit } = extractPagination(req.query);

   // ✓ Right: Constrain with maxLimit
   const { limit } = extractPagination(req.query, { maxLimit: 100 });
   ```

4. **Mixing pagination formats**
   ```typescript
   // ❌ Wrong: Inconsistent pagination in response
   res.json({ data: items, limit, offset }); // Old format

   // ✓ Right: Use standard format
   res.json(formatPaginatedSuccess(items, { limit, offset, total }));
   ```

---

## Need Help?

- See `/docs/PHASE_1_FOUNDATION_IMPLEMENTATION.md` for complete API reference
- Check `/test/unit/middleware/paginationMiddleware.test.ts` for edge cases
- Check `/test/unit/utils/responseFormatters.test.ts` for formatting examples
- Look at existing Phase 2 routes for working examples
