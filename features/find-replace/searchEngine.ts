export interface SearchMatch {
  id: string;
  pageIndex: number;
  markId?: string;
  editableTextId?: string;
  editableText?: any;
  splitEditableTexts?: any[];
  sourceText: string;
  matchStart: number;
  matchLength: number;
  matchedSubstring: string;
  bounds?: { x: number; y: number; w: number; h: number };
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  scope?: "all" | "current" | "custom";
  pageScope?: number[];
}

/**
 * Normalizes text for Turkish-aware case-insensitive comparison
 */
export function normalizeTurkish(text: string, caseSensitive: boolean): string {
  if (caseSensitive) return text;
  return text.toLocaleLowerCase("tr-TR");
}

/**
 * Finds all occurrences of query in a given text
 */
export function findInString(
  text: string,
  query: string,
  options: SearchOptions
): { start: number; length: number; matched: string }[] {
  if (!query || !text) return [];

  const matches: { start: number; length: number; matched: string }[] = [];
  const normalizedQuery = normalizeTurkish(query, options.caseSensitive);
  const normalizedText = normalizeTurkish(text, options.caseSensitive);

  if (options.wholeWord) {
    const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<=^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "gu");

    let m: RegExpExecArray | null;
    while ((m = pattern.exec(normalizedText)) !== null) {
      matches.push({
        start: m.index,
        length: m[0].length,
        matched: text.substring(m.index, m.index + m[0].length)
      });
    }
    return matches;
  }

  let index = 0;
  while ((index = normalizedText.indexOf(normalizedQuery, index)) !== -1) {
    matches.push({
      start: index,
      length: query.length,
      matched: text.substring(index, index + query.length)
    });
    index += Math.max(1, query.length);
  }

  return matches;
}

/**
 * Scans both marks and original PDF text items across pages
 */
export function searchInDocument(
  marks: any[] = [],
  originalTexts: any[] = [],
  query: string,
  options: SearchOptions
): SearchMatch[] {
  if (!query.trim()) return [];

  const results: SearchMatch[] = [];
  const targetPages = options.pageScope && options.pageScope.length > 0 ? new Set(options.pageScope) : null;

  // 1. Search in user marks
  for (const mark of marks) {
    if (mark.kind !== "text" || !mark.text) continue;
    if (targetPages && !targetPages.has(mark.page)) continue;

    const hits = findInString(mark.text, query, options);
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      results.push({
        id: `match_${mark.id}_${hit.start}_${i}`,
        pageIndex: mark.page,
        markId: mark.id,
        sourceText: mark.text,
        matchStart: hit.start,
        matchLength: hit.length,
        matchedSubstring: hit.matched,
        bounds: {
          x: mark.x,
          y: mark.y,
          w: mark.w || 100,
          h: mark.h || 20
        }
      });
    }
  }

  // 2. Search in original PDF text items
  const pageGroups = new Map<number, any[]>();
  for (const item of originalTexts) {
    if (!item.text) continue;
    if (targetPages && !targetPages.has(item.page)) continue;

    if (!pageGroups.has(item.page)) pageGroups.set(item.page, []);
    pageGroups.get(item.page)!.push(item);

    const hits = findInString(item.text, query, options);
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      results.push({
        id: `match_orig_${item.id}_${hit.start}_${i}`,
        pageIndex: item.page,
        editableTextId: item.id,
        editableText: item,
        sourceText: item.text,
        matchStart: hit.start,
        matchLength: hit.length,
        matchedSubstring: hit.matched,
        bounds: {
          x: item.x,
          y: item.y,
          w: item.w || 100,
          h: item.h || 20
        }
      });
    }
  }

  // 3. Search split text items across adjacent chunks on the same page
  const normQuery = normalizeTurkish(query.trim(), options.caseSensitive);
  for (const [pageIdx, items] of pageGroups.entries()) {
    const sorted = [...items].sort((a, b) => {
      const dy = (a.y || 0) - (b.y || 0);
      if (Math.abs(dy) > 4) return dy;
      return (a.x || 0) - (b.x || 0);
    });

    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (Math.abs((a.y || 0) - (b.y || 0)) <= 6 && (b.x || 0) >= (a.x || 0) - 2) {
        const combined = `${a.text}${b.text}`;
        const combinedWithSpace = `${a.text} ${b.text}`;

        const isMatchNoSpace = options.caseSensitive
          ? combined.includes(query)
          : normalizeTurkish(combined, false).includes(normQuery);

        const isMatchSpace = options.caseSensitive
          ? combinedWithSpace.includes(query)
          : normalizeTurkish(combinedWithSpace, false).includes(normQuery);

        if (isMatchNoSpace || isMatchSpace) {
          const alreadyMatched = results.some(
            (r) => r.pageIndex === pageIdx && (r.editableTextId === a.id || r.editableTextId === b.id)
          );
          if (!alreadyMatched) {
            const minX = Math.min(a.x, b.x);
            const minY = Math.min(a.y, b.y);
            const maxX = Math.max(a.x + (a.w || 50), b.x + (b.w || 50));
            const maxH = Math.max(a.h || 16, b.h || 16);

            results.push({
              id: `match_split_${a.id}_${b.id}`,
              pageIndex: pageIdx,
              splitEditableTexts: [a, b],
              sourceText: isMatchNoSpace ? combined : combinedWithSpace,
              matchStart: 0,
              matchLength: query.length,
              matchedSubstring: isMatchNoSpace ? combined : combinedWithSpace,
              bounds: {
                x: minX,
                y: minY,
                w: maxX - minX,
                h: maxH
              }
            });
          }
        }
      }
    }
  }

  // Sort matches by page then vertical position
  results.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    return (a.bounds?.y || 0) - (b.bounds?.y || 0);
  });

  return results;
}

export function searchInMarks(
  marks: any[],
  query: string,
  options: SearchOptions
): SearchMatch[] {
  return searchInDocument(marks, [], query, options);
}

/**
 * Replaces a single match in the source string
 */
export function replaceMatchInText(
  source: string,
  start: number,
  length: number,
  replacement: string
): string {
  return source.substring(0, start) + replacement + source.substring(start + length);
}
