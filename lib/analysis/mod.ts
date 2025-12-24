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
