export {
  countSyllables,
  countTotalSyllables,
  extractWords,
  countSentences,
  averageSentenceLength,
  averageSyllablesPerWord,
  extractKeywords,
  calculateKeywordDensity,
  generateTextFingerprint,
  countComplexWords,
  extractParagraphs,
  DEFAULT_STOP_WORDS,
} from './text';

export {
  fleschReadingEase,
  fleschKincaidGrade,
  gunningFog,
  smogIndex,
  automatedReadabilityIndex,
  interpretFleschScore,
  calculateReadabilityScores,
  scoreTitleTag,
  scoreMetaDescription,
  scoreContentLength,
  calculateSEOScore,
} from './scoring';

export type { ReadabilityScores, SEOScore, SEOScoreDetails } from './scoring';

export {
  analyzeMarkdownContent,
  generateContentInstructions,
  calculateCategoryScores,
  parseMarkdownLines,
  extractFrontmatter,
  stripMarkdown,
  extractMarkdownHeadings,
  findLongSentences,
  findLongParagraphs,
  detectPassiveVoice,
} from './content-analyzer';

export {
  EXTENDED_SCHEMA_TYPES,
  getSchemaType,
  hasProperty,
  analyzeSchema,
  analyzeGraph,
  calculateSchemaScore,
  suggestMissingSchemas,
} from './jsonld';
