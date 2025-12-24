/**
 * SEO scoring algorithms and readability formulas
 */

import {
  extractWords,
  countSentences,
  countSyllables,
  countComplexWords,
} from './text';

export interface ReadabilityScores {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  gunningFog: number;
  smogIndex: number;
  automatedReadabilityIndex: number;
  interpretation: string;
}

export interface SEOScore {
  overall: number;
  content: number;
  technical: number;
  onPage: number;
  details: SEOScoreDetails;
}

export interface SEOScoreDetails {
  titleScore: number;
  descriptionScore: number;
  headingsScore: number;
  imagesScore: number;
  linksScore: number;
  contentLengthScore: number;
  keywordScore: number;
}

/**
 * Calculate Flesch Reading Ease score
 * Higher = easier to read (60-70 is ideal for web)
 */
export const fleschReadingEase = (text: string): number => {
  const words = extractWords(text);
  const sentences = countSentences(text);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);

  if (words.length === 0 || sentences === 0) return 0;

  const asl = words.length / sentences; // Average sentence length
  const asw = syllables / words.length; // Average syllables per word

  return 206.835 - (1.015 * asl) - (84.6 * asw);
};

/**
 * Calculate Flesch-Kincaid Grade Level
 * Returns US grade level (8-10 is ideal for web)
 */
export const fleschKincaidGrade = (text: string): number => {
  const words = extractWords(text);
  const sentences = countSentences(text);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);

  if (words.length === 0 || sentences === 0) return 0;

  const asl = words.length / sentences;
  const asw = syllables / words.length;

  return (0.39 * asl) + (11.8 * asw) - 15.59;
};

/**
 * Calculate Gunning Fog Index
 * Returns years of education needed (8-12 is ideal)
 */
export const gunningFog = (text: string): number => {
  const words = extractWords(text);
  const sentences = countSentences(text);
  const complexWords = countComplexWords(text);

  if (words.length === 0 || sentences === 0) return 0;

  const asl = words.length / sentences;
  const phw = (complexWords / words.length) * 100; // Percentage of hard words

  return 0.4 * (asl + phw);
};

/**
 * Calculate SMOG Index
 * Returns years of education needed
 */
export const smogIndex = (text: string): number => {
  const sentences = countSentences(text);
  const complexWords = countComplexWords(text);

  if (sentences < 30) {
    // Adjusted formula for shorter texts
    return 1.0430 * Math.sqrt(complexWords * (30 / sentences)) + 3.1291;
  }

  return 1.0430 * Math.sqrt(complexWords) + 3.1291;
};

/**
 * Calculate Automated Readability Index
 */
export const automatedReadabilityIndex = (text: string): number => {
  const words = extractWords(text);
  const sentences = countSentences(text);
  const characters = words.join('').length;

  if (words.length === 0 || sentences === 0) return 0;

  return (4.71 * (characters / words.length)) + (0.5 * (words.length / sentences)) - 21.43;
};

/**
 * Get interpretation of Flesch Reading Ease score
 */
export const interpretFleschScore = (score: number): string => {
  if (score >= 90) return 'Very Easy (5th grade)';
  if (score >= 80) return 'Easy (6th grade)';
  if (score >= 70) return 'Fairly Easy (7th grade)';
  if (score >= 60) return 'Standard (8th-9th grade) - Ideal for web';
  if (score >= 50) return 'Fairly Difficult (10th-12th grade)';
  if (score >= 30) return 'Difficult (College level)';
  return 'Very Difficult (Professional level)';
};

/**
 * Calculate all readability scores
 */
export const calculateReadabilityScores = (text: string): ReadabilityScores => {
  const fre = fleschReadingEase(text);

  return {
    fleschReadingEase: Math.round(fre * 10) / 10,
    fleschKincaidGrade: Math.round(fleschKincaidGrade(text) * 10) / 10,
    gunningFog: Math.round(gunningFog(text) * 10) / 10,
    smogIndex: Math.round(smogIndex(text) * 10) / 10,
    automatedReadabilityIndex: Math.round(automatedReadabilityIndex(text) * 10) / 10,
    interpretation: interpretFleschScore(fre),
  };
};

/**
 * Score title tag (0-100)
 */
export const scoreTitleTag = (title: string | null | undefined, targetKeyword?: string): number => {
  if (!title) return 0;

  let score = 0;
  const length = title.length;

  // Length scoring (optimal: 50-60 chars)
  if (length >= 50 && length <= 60) score += 40;
  else if (length >= 40 && length <= 70) score += 30;
  else if (length >= 30 && length <= 80) score += 20;
  else if (length > 0) score += 10;

  // Keyword presence
  if (targetKeyword && title.toLowerCase().includes(targetKeyword.toLowerCase())) {
    score += 30;
    // Bonus for keyword at start
    if (title.toLowerCase().startsWith(targetKeyword.toLowerCase())) {
      score += 10;
    }
  } else {
    score += 15; // Default if no keyword specified
  }

  // Not too short
  if (length >= 30) score += 10;

  // Contains action words or value proposition
  const actionWords = ['how', 'guide', 'best', 'top', 'ultimate', 'complete', 'free', 'new'];
  if (actionWords.some(word => title.toLowerCase().includes(word))) {
    score += 10;
  }

  return Math.min(100, score);
};

/**
 * Score meta description (0-100)
 */
export const scoreMetaDescription = (description: string | null | undefined, targetKeyword?: string): number => {
  if (!description) return 0;

  let score = 0;
  const length = description.length;

  // Length scoring (optimal: 150-160 chars)
  if (length >= 150 && length <= 160) score += 40;
  else if (length >= 120 && length <= 180) score += 30;
  else if (length >= 80 && length <= 200) score += 20;
  else if (length > 0) score += 10;

  // Keyword presence
  if (targetKeyword && description.toLowerCase().includes(targetKeyword.toLowerCase())) {
    score += 25;
  } else {
    score += 10;
  }

  // Contains call to action
  const ctaWords = ['learn', 'discover', 'find', 'get', 'try', 'start', 'read', 'click', 'see', 'explore'];
  if (ctaWords.some(word => description.toLowerCase().includes(word))) {
    score += 15;
  }

  // Not truncated (ends properly)
  if (description.match(/[.!?]$/)) {
    score += 10;
  }

  // Uses active voice indicators
  if (!description.toLowerCase().includes('is a') && !description.toLowerCase().includes('are a')) {
    score += 10;
  }

  return Math.min(100, score);
};

/**
 * Score content length (0-100)
 */
export const scoreContentLength = (wordCount: number, pageType: 'blog' | 'product' | 'landing' = 'blog'): number => {
  const optimalRanges = {
    blog: { min: 1000, max: 2500, ideal: 1500 },
    product: { min: 300, max: 1000, ideal: 500 },
    landing: { min: 500, max: 1500, ideal: 800 },
  };

  const range = optimalRanges[pageType];

  if (wordCount >= range.min && wordCount <= range.max) {
    // Calculate how close to ideal
    const distanceFromIdeal = Math.abs(wordCount - range.ideal);
    const maxDistance = Math.max(range.ideal - range.min, range.max - range.ideal);
    return 70 + Math.round((1 - distanceFromIdeal / maxDistance) * 30);
  }

  if (wordCount < range.min) {
    return Math.round((wordCount / range.min) * 50);
  }

  // Over max
  const overRatio = wordCount / range.max;
  if (overRatio <= 1.5) return 60;
  if (overRatio <= 2) return 50;
  return 40;
};

/**
 * Calculate overall SEO score
 */
export const calculateSEOScore = (
  title: string | null,
  description: string | null,
  wordCount: number,
  h1Count: number,
  imageCount: number,
  imagesWithAlt: number,
  internalLinks: number,
  externalLinks: number,
  targetKeyword?: string
): SEOScore => {
  const titleScore = scoreTitleTag(title, targetKeyword);
  const descriptionScore = scoreMetaDescription(description, targetKeyword);
  const contentLengthScore = scoreContentLength(wordCount);

  // Heading score
  let headingsScore = 0;
  if (h1Count === 1) headingsScore = 100;
  else if (h1Count === 0) headingsScore = 20;
  else headingsScore = 50; // Multiple H1s

  // Image score
  let imagesScore = 0;
  if (imageCount === 0) imagesScore = 50; // No images isn't great but not terrible
  else imagesScore = Math.round((imagesWithAlt / imageCount) * 100);

  // Links score
  let linksScore = 50;
  if (internalLinks >= 3) linksScore += 25;
  if (externalLinks >= 1) linksScore += 25;

  // Keyword score (simplified)
  let keywordScore = 50;
  if (targetKeyword) {
    const titleHasKeyword = title?.toLowerCase().includes(targetKeyword.toLowerCase());
    const descHasKeyword = description?.toLowerCase().includes(targetKeyword.toLowerCase());
    if (titleHasKeyword) keywordScore += 25;
    if (descHasKeyword) keywordScore += 25;
  }

  const details: SEOScoreDetails = {
    titleScore,
    descriptionScore,
    headingsScore,
    imagesScore,
    linksScore,
    contentLengthScore,
    keywordScore,
  };

  // Calculate category scores
  const onPage = Math.round((titleScore + descriptionScore + headingsScore) / 3);
  const content = Math.round((contentLengthScore + keywordScore) / 2);
  const technical = Math.round((imagesScore + linksScore) / 2);

  // Overall weighted score
  const overall = Math.round(onPage * 0.4 + content * 0.35 + technical * 0.25);

  return { overall, content, technical, onPage, details };
};
