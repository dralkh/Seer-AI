/**
 * Advanced Search Utilities for Tables Tab
 *
 * Provides accurate text search with:
 * - Multi-token AND matching (all terms must match)
 * - Case-insensitive comparison
 * - Simple substring matching for reliability
 */

/**
 * Normalize a string for comparison - lowercase and trim whitespace
 */
function normalize(str: string): string {
    return (str || "").toLowerCase().trim();
}

/**
 * Check if a query term matches a target string using simple substring matching.
 *
 * @param term - The search term (already normalized to lowercase)
 * @param target - The target string to search within
 * @returns true if the term is found in the target
 */
function simpleMatch(term: string, target: string): boolean {
    if (!target || !term) return false;
    return normalize(target).includes(term);
}

/**
 * Check if a single query term matches any of the target strings.
 */
function matchTermInAny(term: string, targets: string[]): boolean {
    for (const target of targets) {
        if (simpleMatch(term, target)) {
            return true;
        }
    }
    return false;
}

/**
 * Perform multi-token AND matching.
 * Each space-separated term in the query must match at least one target field.
 *
 * @param query - Search query (may contain multiple space-separated terms)
 * @param targets - Array of strings to search within
 * @returns true if ALL terms match at least one target
 */
export function multiTokenMatch(query: string, targets: string[]): boolean {
    const terms = normalize(query)
        .split(/\s+/)
        .filter((t) => t.length > 0);

    if (terms.length === 0) return true;

    for (const term of terms) {
        if (!matchTermInAny(term, targets)) {
            return false;
        }
    }
    return true;
}

/**
 * Advanced search function for table filtering.
 * All search terms must match at least one target field.
 * Uses simple case-insensitive substring matching for reliability.
 *
 * @param query - Search query string
 * @param searchTargets - Array of strings to search within
 * @returns Object with matches boolean and score (always 1 if matched)
 */
export function advancedSearch(
    query: string,
    searchTargets: string[],
): { matches: boolean; score: number } {
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
        return { matches: true, score: 1 };
    }

    const terms = normalizedQuery.split(/\s+/).filter((t) => t.length > 0);

    if (terms.length === 0) {
        return { matches: true, score: 1 };
    }

    // Filter out empty/null targets
    const validTargets = searchTargets.filter(
        (t) => t !== null && t !== undefined && String(t).trim() !== "",
    );

    // Helper to create smart regex for a term
    const createSmartRegex = (term: string): RegExp => {
        // Escape special regex characters
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        // Smart Boundaries:
        // Only enforce word boundary if the edge character is alphanumeric (word character)
        // This allows "NO" -> "\bNO\b" (matches "no", not "technology")
        // But "**Verdict:**" -> "**Verdict:**" (matches substring with symbols)

        const startBoundary = /^\w/.test(term) ? "\\b" : "";
        const endBoundary = /\w$/.test(term) ? "\\b" : "";

        return new RegExp(`${startBoundary}${escaped}${endBoundary}`, "i");
    };

    // Check if a regex matches any of the targets
    const matchRegexInAny = (regex: RegExp, targets: string[]): boolean => {
        for (const target of targets) {
            if (regex.test(target)) return true;
        }
        return false;
    };

    // Each term must match at least one target (AND logic)
    for (const term of terms) {
        const regex = createSmartRegex(term);
        if (!matchRegexInAny(regex, validTargets)) {
            return { matches: false, score: 0 };
        }
    }

    return { matches: true, score: 1 };
}

/**
 * Calculate a fuzzy match score between a query term and a target string.
 * @returns Score from 0 (no match) to 1 (match found)
 */
export function fuzzyScore(query: string, target: string): number {
    return simpleMatch(normalize(query), target) ? 1 : 0;
}
