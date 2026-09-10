# Phase 1: API Route Consolidation - Foundation Implementation

**Status:** Implemented  
**Date:** 2026-09-10  
**Goal:** Build the foundation for API consolidation by extracting middleware and utilities that all routes will depend on.

---

## What Was Implemented

This phase establishes the reusable foundation for all subsequent route consolidation work. All components are built, tested, and ready for integration with routes.

### 1. Pagination Middleware (`server/middleware/paginationMiddleware.ts`)

**Purpose:** Extract and validate pagination parameters from request query strings.

**Features:**
- Supports both offset-based pagination (`limit`, `offset`)
- Supports cursor-based pagination (encoded record IDs)
- Automatic parameter validation and constraint enforcement
- Highly configurable via options

**Key Functions:**

```typescript
// Extract pagination from query string
const paged = extractPagination(req.query, { maxLimit: 50 });
// Returns: { limit: 20, offset: 0, cursor: null }

// Build cursor from record ID
const cursor = buildCursorFromId(123);
// Returns: "MTIz" (base64 of "123")

// Decode cursor back to ID
const id = decodeCursor('MTIz');
// Returns: "123"
```

**Configuration Options:**
```typescript
interface PaginationOptions {
  maxLimit?: number;          // Max allowed limit (default: 100)
  defaultLimit?: number;      // Default limit per page (default: 20)
  allowCursor?: boolean;      // Enable cursor pagination (default: true)
  allowOffset?: boolean;      // Enable offset pagination (default: true)
}
```

**Usage in Routes:**
```typescript
// Option 1: Use extractPagination directly
router.get('/articles', asyncHandler(async (req, res) => {
  const { limit, offset, cursor } = extractPagination(req.query, { maxLimit: 50 });
  const articles = await db.articles.get({ limit, offset });
  res.json(formatPaginatedSuccess(articles, { limit, offset, total }));
}));

// Option 2: Use middleware (for global pagination config)
app.use(paginationMiddleware({ maxLimit: 100 }));
router.get('/articles', asyncHandler(async (req, res) => {
  const { limit, offset } = req.pagination;
  // ... rest of handler
}));
```

---

### 2. Pagination Utilities (`server/utils/paginationUtils.ts`)

**Purpose:** Helper functions for formatting paginated responses and calculating pagination metadata.

**Key Functions:**

```typescript
// Format paginated response with consistent structure
const response = formatPaginatedResponse(articles, {
  limit: 20,
  offset: 0,
  total: 150,
  hasMore: true,
  cursor: 'abc123'
});
// Returns: { data: [...], meta: { pagination: {...} } }

// Build cursor from ID
const cursor = buildCursorFromId(123);

// Decode cursor to ID
const id = decodeCursor(cursor);

// Calculate if more pages exist
const hasMore = calculateHasMore(21, 20); // true (fetched 21, requested 20)

// Calculate total pages
const pages = calculateTotalPages(150, 20); // 8 pages

// Calculate offset from page number
const offset = calculateOffset(3, 20); // 40

// Generate pagination links for API responses
const links = generatePaginationLinks('/api/items', 20, 20, 100);
// Returns: { next, prev, first, last URLs }
```

**Response Format:**
```typescript
{
  data: T[],
  meta: {
    pagination: {
      limit: number,
      offset?: number,
      total?: number,
      hasMore?: boolean,
      cursor?: string | null,
      nextCursor?: string | null
    }
  }
}
```

---

### 3. Response Formatters (`server/utils/responseFormatters.ts`)

**Purpose:** Standardized response formatting for success and error responses across all routes.

**Replaces:** 3+ inconsistent response patterns found in existing routes.

**Key Functions:**

```typescript
// Format success response
return formatSuccess(user);
// Returns: { success: true, data: user }

// Format success with metadata
return formatSuccess(articles, {
  pagination: { limit: 20, offset: 0, total: 150, hasMore: true }
});

// Format error response
return formatError('NOT_FOUND', 'Article not found');
// Returns: { success: false, error: { message: '...', code: 'NOT_FOUND' } }

// Format error with details
return formatError('VALIDATION_ERROR', 'Validation failed', {
  field: 'email',
  reason: 'Invalid format'
});

// Format paginated success (convenience function)
return formatPaginatedSuccess(articles, {
  limit: 20,
  offset: 0,
  total: 150,
  hasMore: true
});
```

**Standardized Error Codes:**
```typescript
ErrorCodes = {
  // Validation (400)
  VALIDATION_ERROR,
  INVALID_INPUT,
  MISSING_REQUIRED_FIELD,

  // Authentication (401)
  UNAUTHORIZED,
  INVALID_CREDENTIALS,
  SESSION_EXPIRED,
  TOKEN_INVALID,

  // Authorization (403)
  FORBIDDEN,
  INSUFFICIENT_PERMISSIONS,

  // Not found (404)
  NOT_FOUND,
  ENTITY_NOT_FOUND,

  // Conflict (409)
  CONFLICT,
  DUPLICATE_RESOURCE,
  STATE_CONFLICT,

  // Rate limit (429)
  RATE_LIMITED,

  // Server (500)
  INTERNAL_ERROR,
  DATABASE_ERROR,
  EXTERNAL_SERVICE_ERROR,
  OPERATION_FAILED
}
```

---

### 4. Enhanced Error Middleware (`server/middleware/errorHandler.ts`)

**Purpose:** Centralized error handling that catches async route errors and returns standardized responses.

**Improvements:**
- Added `asyncHandler` wrapper for async route handlers
- Enhanced error formatting using `formatError()`
- Type-safe route handler definitions
- Better error logging

**Usage:**

```typescript
// Wrap async route handlers to catch errors
router.get('/articles/:id', asyncHandler(async (req, res) => {
  const article = await db.articles.findById(req.params.id);
  if (!article) throw new NotFoundError('Article');
  
  res.json(formatSuccess(article));
}));

// asyncHandler automatically catches promise rejections
// and passes them to the centralized errorHandler middleware
```

**Error Flow:**
```
Route Handler
    ↓
Promise rejection/throw
    ↓
asyncHandler catches
    ↓
errorHandler middleware
    ↓
formatError() standardizes response
    ↓
res.json(formattedError)
```

---

### 5. Type Definitions (`shared/types.ts`)

**Updated types:**

```typescript
// Pagination metadata
interface PaginationMetadata {
  limit: number;
  offset?: number;
  total?: number;
  hasMore?: boolean;
  cursor?: string | null;
  nextCursor?: string | null;
}

// Standardized paginated response
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    pagination: PaginationMetadata;
  };
}

// Success response
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

// Error response
interface ErrorApiResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
}
```

---

## Test Coverage

### Unit Tests

**`test/unit/middleware/paginationMiddleware.test.ts`** - 50+ tests covering:
- Offset-based pagination extraction
- Cursor-based pagination extraction
- Edge cases (negative values, invalid inputs, array params)
- Cursor encoding/decoding round-trips
- Configuration options
- Real-world scenarios (news feed, debates, search)

**`test/unit/utils/responseFormatters.test.ts`** - 40+ tests covering:
- Success response formatting (simple and with metadata)
- Error response formatting (basic and with details)
- Paginated response formatting
- Error codes and status mappings
- Type safety
- Real-world scenarios (news feed, quiz, auth errors)

### Manual Integration Testing

**Manual test for news feed route with new middleware:**

1. **Setup pagination in route handler:**
   ```typescript
   router.get('/news-feed', asyncHandler(async (req, res) => {
     const { limit, offset, cursor } = extractPagination(req.query, { maxLimit: 50 });
     
     const { data: articles, count } = await db.query()
       .limit(limit)
       .offset(offset);
     
     res.json(formatPaginatedSuccess(articles, {
       limit,
       offset,
       total: count,
       hasMore: offset + articles.length < count
     }));
   }));
   ```

2. **Test pagination parameters:**
   ```bash
   # Default pagination
   curl http://localhost:5000/api/news-feed
   # Expected: { success: true, data: [...], meta: { pagination: { limit: 20, offset: 0 } } }

   # Custom limit
   curl http://localhost:5000/api/news-feed?limit=50
   # Expected: { success: true, data: [...], meta: { pagination: { limit: 50, offset: 0 } } }

   # Offset pagination
   curl http://localhost:5000/api/news-feed?limit=20&offset=40
   # Expected: { success: true, data: [...], meta: { pagination: { limit: 20, offset: 40 } } }

   # Cursor pagination
   curl http://localhost:5000/api/news-feed?cursor=MTIz
   # Expected: { success: true, data: [...], meta: { pagination: { limit: 20, cursor: 'MTIz' } } }
   ```

3. **Test error handling:**
   ```bash
   # Non-existent route
   curl http://localhost:5000/api/articles/99999
   # Expected: { success: false, error: { message: 'Article not found', code: 'NOT_FOUND' } }

   # Invalid pagination
   curl http://localhost:5000/api/news-feed?limit=-10
   # Expected: Falls back to default limit (20)

   # Huge limit (clamped to maxLimit)
   curl http://localhost:5000/api/news-feed?limit=500
   # Expected: { success: true, data: [...], meta: { pagination: { limit: 50 } } }
   ```

4. **Verify response format consistency:**
   - All success responses have `success: true`
   - All error responses have `success: false`
   - All pagination responses include `meta.pagination`
   - Error codes are consistent and documented

---

## How Routes Will Use This Foundation (Phase 2+)

### Before (Current - Inconsistent)
```typescript
// newsFeeds: uses custom pagination
router.get('/news-feed', async (req, res) => {
  const limit = Number(req.query.limit) || 10;
  const offset = Number(req.query.offset) || 0;
  res.json({ success: true, articles: [...] }); // No pagination meta
});

// debates: different pagination pattern
router.get('/debates', async (req, res) => {
  const pageSize = Number(req.query.pageSize) || 20;
  const page = Number(req.query.page) || 1;
  res.json({ success: true, data: [...], page, pageSize }); // Different shape
});

// quiz: no pagination at all
router.get('/quiz/results', async (req, res) => {
  res.json({ success: true, results: [...] }); // No pagination info
});
```

### After (Phase 2 - Consistent via Foundation)
```typescript
// newsFeeds: uses extractPagination + formatPaginatedSuccess
router.get('/news-feed', asyncHandler(async (req, res) => {
  const { limit, offset } = extractPagination(req.query, { maxLimit: 50 });
  const articles = await db.getArticles({ limit, offset });
  res.json(formatPaginatedSuccess(articles, { limit, offset, total }));
}));

// debates: uses same foundation
router.get('/debates', asyncHandler(async (req, res) => {
  const { limit, offset } = extractPagination(req.query);
  const debates = await db.getDebates({ limit, offset });
  res.json(formatPaginatedSuccess(debates, { limit, offset, total }));
}));

// quiz: now with pagination for large result sets
router.get('/quiz/results', asyncHandler(async (req, res) => {
  const { limit, offset } = extractPagination(req.query);
  const results = await db.getQuizResults({ limit, offset });
  res.json(formatPaginatedSuccess(results, { limit, offset, total }));
}));

// All three now have:
// - Consistent pagination parameter names
// - Consistent response structure
// - Automatic validation of pagination params
// - Automatic error handling via asyncHandler
```

---

## Success Criteria - All Met ✓

- ✓ All 5 files created with proper implementations
- ✓ Pagination extracted and working correctly (not copy-pasted)
- ✓ Response formatters standardize success/error responses
- ✓ Error middleware wraps async handlers safely
- ✓ No runtime behavior changed from existing routes
- ✓ TypeScript compilation passes with no errors
- ✓ 90+ unit tests with comprehensive coverage
- ✓ Can be imported and used by subsequent consolidation PRs
- ✓ Full documentation with examples and integration guide

---

## Next Steps (Phase 2)

With this foundation in place, Phase 2 can now:

1. **Consolidate news feed routes** - Extract common patterns, apply pagination/response formatters
2. **Consolidate debate routes** - Apply foundation to debate-related endpoints
3. **Consolidate TD scoring routes** - Standardize all TD-related pagination and responses
4. **Consolidate quiz routes** - Apply error handling and response formatting
5. **Consolidate remaining routes** - Apply foundation systematically to all 40+ routes

Each phase 2 PR will:
- Wrap routes with `asyncHandler()`
- Use `extractPagination()` for pagination
- Use `formatSuccess()` / `formatError()` for responses
- Import types from shared/types.ts
- Include tests validating the new format

---

## Files Created

1. `/server/middleware/paginationMiddleware.ts` - Pagination extraction and validation
2. `/server/utils/paginationUtils.ts` - Pagination response formatting and helpers
3. `/server/utils/responseFormatters.ts` - Success/error response formatting
4. `/server/middleware/errorHandler.ts` - Enhanced with formatError integration
5. `/shared/types.ts` - Updated with standardized API response types
6. `/test/unit/middleware/paginationMiddleware.test.ts` - 50+ pagination tests
7. `/test/unit/utils/responseFormatters.test.ts` - 40+ response formatter tests
8. `/docs/PHASE_1_FOUNDATION_IMPLEMENTATION.md` - This documentation

---

## Backward Compatibility

These changes maintain full backward compatibility:

- No existing routes are modified
- New middleware and utilities are opt-in
- Error handler is enhanced but still catches all error types
- Existing response formats continue to work
- Phase 2 routes can migrate gradually to new patterns

---

## Quality Notes

- All code is TypeScript with full type safety
- Pagination handles edge cases (negative values, huge numbers, invalid cursors)
- Response formatting works with generics for type preservation
- Error codes are standardized and documented
- Comprehensive test coverage for edge cases and real-world scenarios
- No external dependencies added (uses only Express, Node.js built-ins)
