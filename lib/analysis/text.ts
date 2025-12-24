/**
 * Text analysis utilities for SEO content analysis
 */

/**
 * Count syllables in a word using a heuristic approach
 */
export const countSyllables = (word: string): number => {
  word = word.toLowerCase().trim();
  if (word.length <= 3) return 1;

  // Remove common suffixes that don't add syllables
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');

  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
};

/**
 * Count total syllables in text
 */
export const countTotalSyllables = (text: string): number => {
  const words = extractWords(text);
  return words.reduce((total, word) => total + countSyllables(word), 0);
};

/**
 * Extract words from text
 */
export const extractWords = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0);
};

/**
 * Count sentences in text
 */
export const countSentences = (text: string): number => {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return Math.max(sentences.length, 1);
};

/**
 * Calculate average sentence length
 */
export const averageSentenceLength = (text: string): number => {
  const words = extractWords(text);
  const sentences = countSentences(text);
  return words.length / sentences;
};

/**
 * Calculate average syllables per word
 */
export const averageSyllablesPerWord = (text: string): number => {
  const words = extractWords(text);
  if (words.length === 0) return 0;
  const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  return totalSyllables / words.length;
};

/**
 * Extract keywords with their frequency
 */
export const extractKeywords = (text: string, stopWords: Set<string> = DEFAULT_STOP_WORDS): Map<string, number> => {
  const words = extractWords(text);
  const frequency = new Map<string, number>();

  for (const word of words) {
    if (word.length < 3 || stopWords.has(word)) continue;
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  return new Map([...frequency.entries()].sort((a, b) => b[1] - a[1]));
};

/**
 * Calculate keyword density (percentage)
 */
export const calculateKeywordDensity = (text: string, keyword: string): number => {
  const words = extractWords(text);
  if (words.length === 0) return 0;

  const keywordLower = keyword.toLowerCase();
  const keywordCount = words.filter(w => w === keywordLower).length;

  return (keywordCount / words.length) * 100;
};

/**
 * Generate text fingerprint for duplicate detection
 * Uses simhash-like approach
 */
export const generateTextFingerprint = (text: string): string => {
  const words = extractWords(text);
  const ngrams: string[] = [];

  // Generate 3-grams
  for (let i = 0; i < words.length - 2; i++) {
    ngrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }

  // Simple hash function
  const hashNgram = (s: string): number => {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  };

  // Create fingerprint from top ngrams
  const ngramHashes = ngrams.map(hashNgram).sort((a, b) => a - b).slice(0, 10);
  return ngramHashes.map(h => h.toString(16)).join('-');
};

/**
 * Count complex words (3+ syllables)
 */
export const countComplexWords = (text: string): number => {
  const words = extractWords(text);
  return words.filter(word => countSyllables(word) >= 3).length;
};

/**
 * Extract paragraphs from HTML-stripped text
 */
export const extractParagraphs = (text: string): string[] => {
  return text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
};

/**
 * Default English stop words
 */
export const DEFAULT_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'the', 'this', 'but', 'they',
  'have', 'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 'can', 'just', 'should', 'now', 'also', 'into', 'our', 'your',
  'their', 'would', 'could', 'may', 'might', 'must', 'shall', 'about',
  'after', 'before', 'between', 'under', 'over', 'through', 'during',
]);
