/**
 * Tests for Pagination Middleware
 * Tests offset-based and cursor-based pagination extraction and validation
 */

import { extractPagination, buildCursorFromId, decodeCursor } from '../../../server/middleware/paginationMiddleware';

describe('Pagination Middleware', () => {
  describe('extractPagination', () => {
    describe('basic offset-based pagination', () => {
      it('should return defaults when no query params', () => {
        const result = extractPagination({});
        expect(result.limit).toBe(20);
        expect(result.offset).toBe(0);
        expect(result.cursor).toBeNull();
      });

      it('should extract valid limit parameter', () => {
        const result = extractPagination({ limit: '50' });
        expect(result.limit).toBe(50);
        expect(result.offset).toBe(0);
      });

      it('should extract valid offset parameter', () => {
        const result = extractPagination({ limit: '20', offset: '40' });
        expect(result.limit).toBe(20);
        expect(result.offset).toBe(40);
      });

      it('should respect maxLimit constraint', () => {
        const result = extractPagination(
          { limit: '500' },
          { maxLimit: 100 }
        );
        expect(result.limit).toBe(100);
      });

      it('should use custom defaultLimit', () => {
        const result = extractPagination(
          {},
          { defaultLimit: 50 }
        );
        expect(result.limit).toBe(50);
      });

      it('should use custom defaultLimit with custom maxLimit', () => {
        const result = extractPagination(
          { limit: '200' },
          { defaultLimit: 50, maxLimit: 150 }
        );
        expect(result.limit).toBe(150);
      });
    });

    describe('edge cases for offset-based pagination', () => {
      it('should handle negative limit by using default', () => {
        const result = extractPagination({ limit: '-10' });
        expect(result.limit).toBeGreaterThan(0);
      });

      it('should handle negative offset by using 0', () => {
        const result = extractPagination({ offset: '-5' });
        expect(result.offset).toBe(0);
      });

      it('should handle invalid limit as non-numeric', () => {
        const result = extractPagination({ limit: 'abc' });
        expect(result.limit).toBe(20);
      });

      it('should handle invalid offset as non-numeric', () => {
        const result = extractPagination({ offset: 'xyz' });
        expect(result.offset).toBe(0);
      });

      it('should handle very large offset values', () => {
        const result = extractPagination({ offset: '999999999' });
        expect(result.offset).toBe(999999999);
      });

      it('should handle zero limit by clamping to 1', () => {
        const result = extractPagination({ limit: '0' });
        expect(result.limit).toBeGreaterThan(0);
      });

      it('should handle array query params (takes first element)', () => {
        const result = extractPagination({ limit: ['30', '40'] as any });
        expect(result.limit).toBe(30);
      });
    });

    describe('cursor-based pagination', () => {
      it('should extract cursor parameter when provided', () => {
        const result = extractPagination({ cursor: 'abc123' });
        expect(result.cursor).toBe('abc123');
      });

      it('should ignore empty cursor string', () => {
        const result = extractPagination({ cursor: '' });
        expect(result.cursor).toBeNull();
      });

      it('should ignore whitespace-only cursor', () => {
        const result = extractPagination({ cursor: '   ' });
        expect(result.cursor).toBeNull();
      });

      it('should allow disabling cursor pagination', () => {
        const result = extractPagination(
          { cursor: 'abc123' },
          { allowCursor: false }
        );
        expect(result.cursor).toBeNull();
      });

      it('should handle array cursor param (takes first element)', () => {
        const result = extractPagination({ cursor: ['cursor1', 'cursor2'] as any });
        expect(result.cursor).toBe('cursor1');
      });
    });

    describe('mixed pagination strategies', () => {
      it('should allow cursor and offset together', () => {
        const result = extractPagination({
          limit: '25',
          offset: '50',
          cursor: 'xyz789'
        });
        expect(result.limit).toBe(25);
        expect(result.offset).toBe(50);
        expect(result.cursor).toBe('xyz789');
      });

      it('should allow disabling offset pagination', () => {
        const result = extractPagination(
          { limit: '30', offset: '60' },
          { allowOffset: false }
        );
        expect(result.limit).toBe(30);
        expect(result.offset).toBe(0); // Not extracted
        expect(result.cursor).toBeNull();
      });

      it('should allow disabling both offset and cursor', () => {
        const result = extractPagination(
          { limit: '30', offset: '60', cursor: 'abc' },
          { allowOffset: false, allowCursor: false }
        );
        expect(result.limit).toBe(30);
        expect(result.offset).toBe(0);
        expect(result.cursor).toBeNull();
      });
    });

    describe('real-world scenarios', () => {
      it('news feed: pagination with default limit', () => {
        const result = extractPagination({ sort: 'trending' });
        expect(result.limit).toBe(20);
        expect(result.offset).toBe(0);
      });

      it('news feed: cursor-based pagination for infinite scroll', () => {
        const result = extractPagination(
          { cursor: 'MTIzNDU2Nzg5' }, // base64 cursor
          { allowCursor: true }
        );
        expect(result.cursor).toBe('MTIzNDU2Nzg5');
      });

      it('articles list: custom page size', () => {
        const result = extractPagination(
          { limit: '50', offset: '100' },
          { maxLimit: 100 }
        );
        expect(result.limit).toBe(50);
        expect(result.offset).toBe(100);
      });

      it('debates list: very conservative limit for large dataset', () => {
        const result = extractPagination(
          { limit: '200' },
          { maxLimit: 50, defaultLimit: 20 }
        );
        expect(result.limit).toBe(50); // Clamped
      });
    });
  });

  describe('buildCursorFromId', () => {
    it('should encode numeric ID to base64', () => {
      const cursor = buildCursorFromId(123);
      expect(cursor).toBe('MTIz');
      expect(Buffer.from(cursor, 'base64').toString()).toBe('123');
    });

    it('should encode string ID to base64', () => {
      const cursor = buildCursorFromId('article-456');
      expect(cursor).toBe('YXJ0aWNsZS00NTY=');
      expect(Buffer.from(cursor, 'base64').toString()).toBe('article-456');
    });

    it('should encode UUID to base64', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const cursor = buildCursorFromId(uuid);
      expect(Buffer.from(cursor, 'base64').toString()).toBe(uuid);
    });

    it('should handle zero ID', () => {
      const cursor = buildCursorFromId(0);
      expect(cursor).toBe('MA==');
    });

    it('should handle large ID numbers', () => {
      const cursor = buildCursorFromId(9007199254740991); // Max safe integer
      expect(Buffer.from(cursor, 'base64').toString()).toBe('9007199254740991');
    });
  });

  describe('decodeCursor', () => {
    it('should decode base64 cursor to ID', () => {
      const id = decodeCursor('MTIz');
      expect(id).toBe('123');
    });

    it('should decode cursor with special characters', () => {
      const id = decodeCursor('YXJ0aWNsZS00NTY=');
      expect(id).toBe('article-456');
    });

    it('should decode UUID cursor', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const encoded = Buffer.from(uuid).toString('base64');
      const decoded = decodeCursor(encoded);
      expect(decoded).toBe(uuid);
    });

    it('should return null for invalid base64', () => {
      const id = decodeCursor('!!!invalid!!!');
      expect(id).toBeNull();
    });

    it('should return null for empty cursor', () => {
      const id = decodeCursor('');
      expect(id).toBeNull();
    });

    it('should return null for whitespace-only cursor', () => {
      const id = decodeCursor('   ');
      expect(id).toBeNull();
    });

    it('should preserve empty decoded content as null', () => {
      // This would only happen if someone encodes empty string
      const emptyEncoded = Buffer.from('').toString('base64'); // ''
      const id = decodeCursor(emptyEncoded);
      expect(id).toBeNull();
    });
  });

  describe('cursor round-trip', () => {
    it('should round-trip numeric ID: ID -> cursor -> ID', () => {
      const originalId = 12345;
      const cursor = buildCursorFromId(originalId);
      const decoded = decodeCursor(cursor);
      expect(decoded).toBe(String(originalId));
    });

    it('should round-trip string ID: ID -> cursor -> ID', () => {
      const originalId = 'article-uuid-12345';
      const cursor = buildCursorFromId(originalId);
      const decoded = decodeCursor(cursor);
      expect(decoded).toBe(originalId);
    });

    it('should work for news feed pagination flow', () => {
      // Simulate: fetch article, use last article ID for next cursor
      const lastArticleId = 789;
      const nextCursor = buildCursorFromId(lastArticleId);

      // On next request: decode cursor and query from that point
      const decodedId = decodeCursor(nextCursor);
      expect(decodedId).toBe('789');
    });
  });

  describe('integration scenarios', () => {
    it('should handle pagination with search results', () => {
      const result = extractPagination({
        q: 'climate change',
        limit: '50',
        offset: '100'
      });
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(100);
    });

    it('should handle pagination with filters', () => {
      const result = extractPagination({
        status: 'published',
        limit: '20',
        cursor: 'cursorData'
      });
      expect(result.limit).toBe(20);
      expect(result.cursor).toBe('cursorData');
    });

    it('should maintain pagination across sorting', () => {
      const result = extractPagination({
        sort: 'published_date',
        order: 'desc',
        limit: '15',
        offset: '30'
      });
      expect(result.limit).toBe(15);
      expect(result.offset).toBe(30);
    });
  });
});
