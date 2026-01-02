/**
 * Social media meta tag analysis and suggestions
 */

import type {
  OpenGraphData,
  TwitterCardData,
  FacebookData,
  SocialPreview,
  ImageValidation,
  SocialMetaScore,
} from '../types/mod';

export interface SocialMetaSuggestion {
  issues: string[];
  suggestions: string[];
}

// Platform-specific character limits
const LIMITS = {
  facebook: { title: 60, description: 300 },
  twitter: { title: 70, description: 200 },
  linkedin: { title: 200, description: 256 },
};

// Minimum recommended image sizes
const IMAGE_SIZES = {
  og: { width: 1200, height: 630 },
  twitterLarge: { width: 300, height: 157 },
  twitterSummary: { width: 144, height: 144 },
};

export const analyzeOpenGraph = (
  og: OpenGraphData,
  pageTitle?: string,
  pageDescription?: string
): SocialMetaSuggestion => {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Required properties
  if (!og.title) {
    issues.push('Missing og:title');
    if (pageTitle) {
      suggestions.push(`Add og:title - suggest using page title: "${pageTitle.substring(0, 60)}"`);
    } else {
      suggestions.push('Add og:title meta tag');
    }
  } else if (og.title.length > 60) {
    suggestions.push(`og:title is ${og.title.length} chars - consider shortening to under 60 for optimal display`);
  }

  if (!og.description) {
    issues.push('Missing og:description');
    if (pageDescription) {
      suggestions.push(`Add og:description - suggest using meta description`);
    } else {
      suggestions.push('Add og:description meta tag');
    }
  } else if (og.description.length > 300) {
    suggestions.push('og:description exceeds 300 chars - may be truncated on Facebook');
  }

  if (!og.image) {
    issues.push('Missing og:image - social shares will lack visual appeal');
    suggestions.push('Add og:image with minimum 1200x630px dimensions');
  } else {
    if (!og.image.startsWith('https://')) {
      issues.push('og:image should use HTTPS URL');
    }
    if (!og.imageWidth || !og.imageHeight) {
      suggestions.push('Add og:image:width and og:image:height for faster rendering');
    }
    if (!og.imageAlt) {
      suggestions.push('Add og:image:alt for accessibility');
    }
  }

  if (!og.url) {
    suggestions.push('Add og:url to specify the canonical URL for sharing');
  }

  if (!og.type) {
    suggestions.push('Add og:type (e.g., "website", "article") for better categorization');
  }

  if (!og.siteName) {
    suggestions.push('Add og:site_name to display your brand name');
  }

  if (!og.locale) {
    suggestions.push('Add og:locale to specify content language (e.g., "en_US")');
  }

  return { issues, suggestions };
};

export const analyzeTwitterCard = (
  twitter: TwitterCardData,
  og: OpenGraphData
): SocialMetaSuggestion => {
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (!twitter.card) {
    if (og.image) {
      suggestions.push('Add twitter:card="summary_large_image" to display large image preview');
    } else {
      suggestions.push('Add twitter:card="summary" for Twitter card support');
    }
  }

  // Twitter can fall back to OG, but explicit is better
  if (!twitter.title && !og.title) {
    issues.push('Missing twitter:title (and no og:title fallback)');
  } else if (!twitter.title && og.title) {
    // This is fine - Twitter falls back to OG
  }

  if (!twitter.description && !og.description) {
    issues.push('Missing twitter:description (and no og:description fallback)');
  }

  if (!twitter.image && !og.image) {
    issues.push('Missing twitter:image (and no og:image fallback)');
  } else if (!twitter.image && og.image) {
    // This is fine - Twitter falls back to OG
  }

  if (!twitter.site) {
    suggestions.push('Add twitter:site with your Twitter @username for attribution');
  }

  if (!twitter.creator && twitter.site) {
    suggestions.push('Consider adding twitter:creator for author attribution');
  }

  if (twitter.card === 'player' && (!twitter.player || !twitter.playerWidth || !twitter.playerHeight)) {
    issues.push('twitter:card="player" requires player, player:width, and player:height');
  }

  return { issues, suggestions };
};

export const analyzeFacebook = (fb: FacebookData): SocialMetaSuggestion => {
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (!fb.appId) {
    suggestions.push('Consider adding fb:app_id for Facebook Insights and moderation');
  }

  return { issues, suggestions };
};

export const generateSocialPreview = (
  platform: 'facebook' | 'twitter' | 'linkedin',
  og: OpenGraphData,
  twitter: TwitterCardData,
  url: string
): SocialPreview => {
  const limits = LIMITS[platform];

  // Determine title
  let title = '';
  if (platform === 'twitter' && twitter.title) {
    title = twitter.title;
  } else if (og.title) {
    title = og.title;
  }

  // Determine description
  let description = '';
  if (platform === 'twitter' && twitter.description) {
    description = twitter.description;
  } else if (og.description) {
    description = og.description;
  }

  // Determine image
  let image: string | null = null;
  if (platform === 'twitter' && twitter.image) {
    image = twitter.image;
  } else if (og.image) {
    image = og.image;
  }

  // Generate display URL
  let displayUrl = url;
  try {
    const parsed = new URL(url);
    displayUrl = parsed.hostname + parsed.pathname;
    if (displayUrl.length > 40) {
      displayUrl = displayUrl.substring(0, 37) + '...';
    }
  } catch {
    // Keep original
  }

  // Check truncation
  const truncations = {
    title: title.length > limits.title,
    description: description.length > limits.description,
  };

  // Truncate for preview
  const previewTitle = title.length > limits.title
    ? title.substring(0, limits.title - 3) + '...'
    : title;
  const previewDesc = description.length > limits.description
    ? description.substring(0, limits.description - 3) + '...'
    : description;

  return {
    platform,
    title: previewTitle,
    description: previewDesc,
    image,
    url,
    displayUrl,
    truncations,
  };
};

export const validateSocialImage = (
  imageUrl: string | null,
  imageWidth: number | null,
  imageHeight: number | null,
  twitterCard: string | null
): ImageValidation => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!imageUrl) {
    return {
      url: null,
      isAbsolute: false,
      meetsMinimumSize: false,
      width: null,
      height: null,
      aspectRatio: null,
      issues: ['No image URL provided'],
      recommendations: ['Add an og:image with minimum 1200x630px'],
    };
  }

  const isAbsolute = imageUrl.startsWith('http://') || imageUrl.startsWith('https://');
  if (!isAbsolute) {
    issues.push('Image URL should be absolute (start with https://)');
  }

  if (!imageUrl.startsWith('https://')) {
    recommendations.push('Use HTTPS for image URL');
  }

  let meetsMinimumSize = false;
  let aspectRatio: string | null = null;

  if (imageWidth && imageHeight) {
    aspectRatio = `${imageWidth}:${imageHeight}`;

    // Check OG requirements
    if (imageWidth >= IMAGE_SIZES.og.width && imageHeight >= IMAGE_SIZES.og.height) {
      meetsMinimumSize = true;
    } else {
      issues.push(`Image is ${imageWidth}x${imageHeight} - recommend minimum ${IMAGE_SIZES.og.width}x${IMAGE_SIZES.og.height}`);
    }

    // Check aspect ratio (1.91:1 is optimal for Facebook)
    const ratio = imageWidth / imageHeight;
    if (ratio < 1.5 || ratio > 2.1) {
      recommendations.push('Optimal aspect ratio is 1.91:1 (e.g., 1200x630)');
    }
  } else {
    recommendations.push('Add og:image:width and og:image:height for dimension validation');
  }

  return {
    url: imageUrl,
    isAbsolute,
    meetsMinimumSize,
    width: imageWidth,
    height: imageHeight,
    aspectRatio,
    issues,
    recommendations,
  };
};

export const calculateSocialMetaScore = (
  og: OpenGraphData,
  twitter: TwitterCardData,
  fb: FacebookData,
  imageValidation: ImageValidation | null
): SocialMetaScore => {
  // Open Graph score (50 points max)
  let ogScore = 0;
  if (og.title) ogScore += 15;
  if (og.description) ogScore += 10;
  if (og.image) ogScore += 15;
  if (og.url) ogScore += 5;
  if (og.type) ogScore += 3;
  if (og.imageWidth && og.imageHeight) ogScore += 2;

  // Twitter score (35 points max)
  let twitterScore = 0;
  if (twitter.card) twitterScore += 15;
  if (twitter.title || og.title) twitterScore += 10;
  if (twitter.description || og.description) twitterScore += 5;
  if (twitter.image || og.image) twitterScore += 5;

  // Bonus score (15 points max)
  let bonus = 0;
  if (imageValidation?.meetsMinimumSize) bonus += 10;
  if (twitter.site) bonus += 3;
  if (og.locale) bonus += 2;

  const overall = ogScore + twitterScore + bonus;

  return {
    openGraph: ogScore,
    twitter: twitterScore,
    bonus,
    overall,
  };
};
