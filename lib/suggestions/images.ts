/**
 * Image SEO suggestions generator
 */

import type { ImageInfo } from '../types/mod';

export interface ImageSuggestion {
  src: string;
  issues: string[];
  suggestedAlt: string | null;
  recommendations: string[];
}

export interface ImageAnalysisResult {
  totalImages: number;
  imagesWithAlt: number;
  imagesWithoutAlt: number;
  imageSuggestions: ImageSuggestion[];
  generalRecommendations: string[];
}

/**
 * Extract meaningful words from image filename
 */
const extractWordsFromFilename = (src: string): string[] => {
  // Get filename without extension and path
  const filename = src.split('/').pop()?.split('.')[0] ?? '';

  // Split on common separators and filter
  return filename
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !['img', 'image', 'photo', 'pic', 'screenshot', 'screen'].includes(word));
};

/**
 * Generate alt text suggestion from filename and context
 */
export const generateAltSuggestion = (
  src: string,
  nearbyText?: string
): string | null => {
  const words = extractWordsFromFilename(src);

  if (words.length === 0) {
    // Try to extract from nearby text
    if (nearbyText) {
      const cleaned = nearbyText.replace(/<[^>]*>/g, '').trim();
      if (cleaned.length > 0 && cleaned.length < 100) {
        return cleaned;
      }
    }
    return null;
  }

  // Capitalize first letter and create sentence
  const suggestion = words.join(' ');
  return suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
};

/**
 * Analyze image and provide suggestions
 */
export const analyzeImage = (image: ImageInfo): ImageSuggestion => {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let suggestedAlt: string | null = null;

  // Check alt text
  if (!image.alt || image.alt.trim() === '') {
    issues.push('Missing alt text');
    suggestedAlt = generateAltSuggestion(image.src);

    if (suggestedAlt) {
      recommendations.push(`Suggested alt text: "${suggestedAlt}"`);
    } else {
      recommendations.push('Add descriptive alt text that explains the image content');
    }
  } else {
    // Analyze existing alt text quality
    const alt = image.alt.trim();

    if (alt.length < 10) {
      issues.push('Alt text too short - provide more description');
    }

    if (alt.length > 125) {
      issues.push('Alt text too long - keep under 125 characters');
    }

    // Check for problematic alt text
    const badPhrases = ['image of', 'picture of', 'photo of', 'graphic of'];
    if (badPhrases.some(phrase => alt.toLowerCase().startsWith(phrase))) {
      recommendations.push('Remove redundant phrases like "image of" - screen readers already announce it as an image');
    }

    // Check for filename in alt
    if (alt.match(/\.(jpg|jpeg|png|gif|webp|svg)/i)) {
      issues.push('Alt text contains filename - use descriptive text instead');
    }

    // Check for keyword stuffing
    const words = alt.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    if (words.length > 5 && uniqueWords.size < words.length * 0.5) {
      recommendations.push('Avoid keyword stuffing in alt text - keep it natural');
    }
  }

  // Check dimensions
  if (!image.width || !image.height) {
    recommendations.push('Add explicit width and height attributes to prevent layout shift');
  }

  // Check src
  if (!image.src || image.src === '') {
    issues.push('Missing image source');
  } else {
    // Check for absolute vs relative URLs
    if (image.src.startsWith('//')) {
      recommendations.push('Use explicit protocol (https://) instead of protocol-relative URL');
    }

    // Check file extension
    const extension = image.src.split('.').pop()?.toLowerCase();
    if (extension && !['webp', 'avif'].includes(extension)) {
      recommendations.push(`Consider using WebP or AVIF format for better compression (current: ${extension})`);
    }
  }

  return {
    src: image.src,
    issues,
    suggestedAlt,
    recommendations,
  };
};

/**
 * Analyze all images on a page
 */
export const analyzeImages = (images: ImageInfo[]): ImageAnalysisResult => {
  const imageSuggestions = images.map(img => analyzeImage(img));
  const imagesWithoutAlt = imageSuggestions.filter(s => s.issues.includes('Missing alt text')).length;

  const generalRecommendations: string[] = [];

  // Overall image recommendations
  if (images.length === 0) {
    generalRecommendations.push('Consider adding relevant images to improve engagement and SEO');
  }

  if (imagesWithoutAlt > 0) {
    const percentage = Math.round((imagesWithoutAlt / images.length) * 100);
    generalRecommendations.push(`${percentage}% of images are missing alt text - accessibility and SEO issue`);
  }

  if (images.length > 20) {
    generalRecommendations.push('Page has many images - ensure lazy loading is implemented');
  }

  // Check for hero image
  const hasLargeImage = images.some(img => {
    const width = parseInt(img.width ?? '0', 10);
    const height = parseInt(img.height ?? '0', 10);
    return width > 800 || height > 600;
  });

  if (!hasLargeImage && images.length > 0) {
    generalRecommendations.push('Consider adding a prominent hero image above the fold');
  }

  return {
    totalImages: images.length,
    imagesWithAlt: images.length - imagesWithoutAlt,
    imagesWithoutAlt,
    imageSuggestions,
    generalRecommendations,
  };
};
