/**
 * Meta tag suggestions generator
 */

export interface TitleSuggestion {
  current: string | null;
  issues: string[];
  suggestions: string[];
  recommendations: string[];
}

export interface DescriptionSuggestion {
  current: string | null;
  issues: string[];
  suggestions: string[];
  recommendations: string[];
}

/**
 * Generate title tag suggestions
 */
export const suggestTitleImprovements = (
  title: string | null | undefined,
  targetKeyword?: string,
  siteName?: string
): TitleSuggestion => {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const recommendations: string[] = [];

  if (!title) {
    issues.push('Missing title tag - critical for SEO');
    recommendations.push('Add a descriptive title tag that includes your primary keyword');
    return { current: null, issues, suggestions, recommendations };
  }

  const length = title.length;

  // Length issues
  if (length < 30) {
    issues.push(`Title too short (${length} chars). Optimal: 50-60 characters`);
    recommendations.push('Expand title to include more descriptive keywords');
  } else if (length > 60) {
    issues.push(`Title too long (${length} chars). May be truncated in search results`);
    recommendations.push('Shorten title to under 60 characters');
  }

  // Keyword presence
  if (targetKeyword && !title.toLowerCase().includes(targetKeyword.toLowerCase())) {
    issues.push(`Target keyword "${targetKeyword}" not found in title`);
    recommendations.push(`Include "${targetKeyword}" near the beginning of the title`);
  }

  // Generate suggestions
  if (targetKeyword) {
    const baseTitle = title.replace(/\s*[-|]\s*.+$/, '').trim();

    suggestions.push(`${targetKeyword} - ${baseTitle}`);
    suggestions.push(`${baseTitle}: ${targetKeyword} Guide`);

    if (siteName) {
      suggestions.push(`${targetKeyword} | ${siteName}`);
    }
  }

  // Best practices
  if (!title.match(/^[A-Z]/)) {
    recommendations.push('Start title with a capital letter');
  }

  if (title.includes('  ')) {
    recommendations.push('Remove double spaces in title');
  }

  if (title.toLowerCase().includes('untitled') || title.toLowerCase().includes('home')) {
    recommendations.push('Use a more descriptive, keyword-rich title instead of generic terms');
  }

  return { current: title, issues, suggestions, recommendations };
};

/**
 * Generate meta description suggestions
 */
export const suggestDescriptionImprovements = (
  description: string | null | undefined,
  targetKeyword?: string,
  pageContent?: string
): DescriptionSuggestion => {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const recommendations: string[] = [];

  if (!description) {
    issues.push('Missing meta description - important for click-through rates');
    recommendations.push('Add a compelling meta description that summarizes page content');

    // Generate from content if available
    if (pageContent) {
      const firstSentences = pageContent
        .replace(/<[^>]*>/g, '')
        .split(/[.!?]/)
        .slice(0, 2)
        .join('. ')
        .trim();

      if (firstSentences.length > 0) {
        const suggested = firstSentences.substring(0, 155) + (firstSentences.length > 155 ? '...' : '');
        suggestions.push(suggested);
      }
    }

    return { current: null, issues, suggestions, recommendations };
  }

  const length = description.length;

  // Length issues
  if (length < 120) {
    issues.push(`Description too short (${length} chars). Optimal: 150-160 characters`);
    recommendations.push('Expand description to provide more context for searchers');
  } else if (length > 160) {
    issues.push(`Description too long (${length} chars). Will be truncated in search results`);
    recommendations.push('Shorten to 160 characters to prevent truncation');
  }

  // Keyword presence
  if (targetKeyword && !description.toLowerCase().includes(targetKeyword.toLowerCase())) {
    issues.push(`Target keyword "${targetKeyword}" not found in description`);
    recommendations.push(`Include "${targetKeyword}" naturally in the description`);
  }

  // Call to action
  const ctaWords = ['learn', 'discover', 'find', 'get', 'try', 'start', 'read', 'click', 'see', 'explore', 'join'];
  if (!ctaWords.some(word => description.toLowerCase().includes(word))) {
    recommendations.push('Add a call-to-action (e.g., "Learn more", "Discover how", "Get started")');
  }

  // Truncation check
  if (!description.match(/[.!?]$/)) {
    recommendations.push('End description with proper punctuation');
  }

  // Duplicate content check
  if (description.toLowerCase().includes('welcome to')) {
    recommendations.push('Avoid generic phrases like "Welcome to" - be specific and unique');
  }

  return { current: description, issues, suggestions, recommendations };
};

/**
 * Generate canonical URL suggestions
 */
export const suggestCanonicalUrl = (
  currentUrl: string,
  canonical: string | null | undefined,
  hasWww: boolean,
  hasTrailingSlash: boolean
): string[] => {
  const issues: string[] = [];

  if (!canonical) {
    issues.push('Missing canonical URL - add one to prevent duplicate content issues');
  } else if (canonical !== currentUrl) {
    issues.push(`Canonical URL differs from current URL. Ensure this is intentional.`);
  }

  // URL consistency recommendations
  if (hasWww) {
    issues.push('Consider using non-www version for consistency (or vice versa)');
  }

  if (hasTrailingSlash) {
    issues.push('Ensure trailing slash usage is consistent across the site');
  }

  return issues;
};
