/**
 * Pagination Utilities
 * Helper functions for formatting paginated responses and managing cursor-based pagination
 */

export interface PaginationMetadata {
  limit: number;
  offset?: number;
  total?: number;
  hasMore?: boolean;
  cursor?: string | null;
  nextCursor?: string | null;
}

export interface PaginatedResponseEnvelope<T> {
  data: T[];
  meta: {
    pagination: PaginationMetadata;
  };
}

/**
 * Format a paginated response with consistent structure
 * Used across all routes to maintain API consistency
 *
 * @param results - Array of data items
 * @param metadata - Pagination metadata
 * @returns Formatted paginated response envelope
 *
 * @example
 * const response = formatPaginatedResponse(articles, {
 *   limit: 20,
 *   offset: 0,
 *   total: 150,
 *   hasMore: true,
 *   cursor: 'abc123'
 * });
 * // Returns: { data: [...], meta: { pagination: {...} } }
 */
export function formatPaginatedResponse<T>(
  results: T[],
  metadata: PaginationMetadata
): PaginatedResponseEnvelope<T> {
  return {
    data: results,
    meta: {
      pagination: {
        limit: metadata.limit,
        offset: metadata.offset,
        total: metadata.total,
        hasMore: metadata.hasMore,
        cursor: metadata.cursor,
        nextCursor: metadata.nextCursor,
      },
    },
  };
}

/**
 * Build a cursor from a record ID
 * Encodes the ID as base64 for use in cursor-based pagination
 *
 * @param id - The record ID
 * @returns Base64-encoded cursor string
 *
 * @example
 * const cursor = buildCursorFromId(123);
 * // Returns: "MTIz" (base64 of "123")
 */
export function buildCursorFromId(id: string | number): string {
  const idString = String(id);
  return Buffer.from(idString).toString('base64');
}

/**
 * Decode a cursor back to a record ID
 * Decodes base64 cursor to retrieve the original ID
 *
 * @param cursor - The base64-encoded cursor string
 * @returns Decoded ID string, or null if cursor is invalid
 *
 * @example
 * const id = decodeCursor('MTIz');
 * // Returns: "123"
 */
export function decodeCursor(cursor: string): string | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    if (decoded && decoded.trim()) {
      return decoded;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Calculate hasMore flag for pagination
 * When fetching limit+1 items, use this to determine if there are more pages
 *
 * @param totalFetched - Number of items actually fetched from database
 * @param requestedLimit - Number of items requested by client
 * @returns Boolean indicating whether more items exist
 *
 * @example
 * const { data: items } = await db.query().limit(21); // limit+1
 * const hasMore = calculateHasMore(items.length, 20);
 * // If items.length > 20, hasMore = true
 */
export function calculateHasMore(totalFetched: number, requestedLimit: number): boolean {
  return totalFetched > requestedLimit;
}

/**
 * Extract page count from total and limit
 * Useful for calculating total pages in offset-based pagination
 *
 * @param total - Total number of records
 * @param limit - Records per page
 * @returns Number of pages
 *
 * @example
 * const totalPages = calculateTotalPages(150, 20);
 * // Returns: 8 (7 full pages + 1 partial)
 */
export function calculateTotalPages(total: number, limit: number): number {
  if (total === 0 || limit === 0) return 0;
  return Math.ceil(total / limit);
}

/**
 * Calculate offset from page number
 * Converts page number to offset for database queries
 *
 * @param pageNumber - Page number (1-indexed)
 * @param limit - Records per page
 * @returns Offset for database query
 *
 * @example
 * const offset = calculateOffset(3, 20);
 * // Returns: 40 (skip first 40 records for page 3)
 */
export function calculateOffset(pageNumber: number, limit: number): number {
  if (pageNumber < 1) return 0;
  return (pageNumber - 1) * limit;
}

/**
 * Generate pagination links for API responses
 * Useful for clients that need explicit next/prev URLs
 *
 * @param baseUrl - Base URL of the API endpoint
 * @param offset - Current offset
 * @param limit - Current limit
 * @param total - Total records available
 * @returns Object with next and prev URLs
 *
 * @example
 * const links = generatePaginationLinks('/api/items', 20, 20, 100);
 * // Returns: {
 * //   next: '/api/items?offset=40&limit=20',
 * //   prev: '/api/items?offset=0&limit=20'
 * // }
 */
export interface PaginationLinks {
  next: string | null;
  prev: string | null;
  first: string;
  last: string;
}

export function generatePaginationLinks(
  baseUrl: string,
  offset: number,
  limit: number,
  total: number
): PaginationLinks {
  const totalPages = calculateTotalPages(total, limit);
  const currentPage = Math.floor(offset / limit);

  const nextOffset = offset + limit;
  const prevOffset = Math.max(0, offset - limit);
  const lastOffset = Math.max(0, (totalPages - 1) * limit);

  const params = (o: number) => `?offset=${o}&limit=${limit}`;

  return {
    next: nextOffset < total ? `${baseUrl}${params(nextOffset)}` : null,
    prev: offset > 0 ? `${baseUrl}${params(prevOffset)}` : null,
    first: `${baseUrl}${params(0)}`,
    last: `${baseUrl}${params(lastOffset)}`,
  };
}
