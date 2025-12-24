/**
 * URL structure suggestions generator
 */

export interface UrlAnalysis {
  url: string;
  issues: string[];
  recommendations: string[];
  structure: UrlStructure;
}

export interface UrlStructure {
  protocol: string;
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
  depth: number;
  hasTrailingSlash: boolean;
  hasWww: boolean;
  isHttps: boolean;
  segments: string[];
}

/**
 * Parse URL into structure
 */
export const parseUrlStructure = (url: string): UrlStructure => {
  const parsed = new URL(url);
  const segments = parsed.pathname.split('/').filter(s => s.length > 0);

  return {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    depth: segments.length,
    hasTrailingSlash: parsed.pathname.endsWith('/') && parsed.pathname !== '/',
    hasWww: parsed.hostname.startsWith('www.'),
    isHttps: parsed.protocol === 'https:',
    segments,
  };
};

/**
 * Analyze URL and provide suggestions
 */
export const analyzeUrl = (
  url: string,
  canonical?: string | null,
  targetKeyword?: string
): UrlAnalysis => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  let structure: UrlStructure;
  try {
    structure = parseUrlStructure(url);
  } catch {
    return {
      url,
      issues: ['Invalid URL format'],
      recommendations: ['Ensure URL is properly formatted'],
      structure: {
        protocol: '',
        hostname: '',
        pathname: '',
        search: '',
        hash: '',
        depth: 0,
        hasTrailingSlash: false,
        hasWww: false,
        isHttps: false,
        segments: [],
      },
    };
  }

  // HTTPS check
  if (!structure.isHttps) {
    issues.push('URL uses HTTP instead of HTTPS - security and ranking issue');
    recommendations.push('Migrate to HTTPS for security and SEO benefits');
  }

  // Length check
  if (url.length > 100) {
    issues.push(`URL is too long (${url.length} characters)`);
    recommendations.push('Keep URLs under 100 characters for better usability');
  }

  // Depth check
  if (structure.depth > 4) {
    issues.push(`URL is too deep (${structure.depth} levels)`);
    recommendations.push('Flatten URL structure - keep important pages within 3-4 clicks from home');
  }

  // Special characters
  if (structure.pathname.match(/[A-Z]/)) {
    recommendations.push('Use lowercase letters in URLs for consistency');
  }

  if (structure.pathname.includes('_')) {
    recommendations.push('Use hyphens (-) instead of underscores (_) in URLs');
  }

  if (structure.pathname.match(/%[0-9A-F]{2}/i)) {
    recommendations.push('Avoid encoded characters in URLs - use simple, readable words');
  }

  // Query parameters
  if (structure.search.length > 0) {
    const params = new URLSearchParams(structure.search);
    const paramCount = Array.from(params.keys()).length;

    if (paramCount > 3) {
      issues.push(`Too many query parameters (${paramCount})`);
      recommendations.push('Minimize query parameters - consider URL rewriting');
    }

    // Session IDs and tracking
    const trackingParams = ['sid', 'sessionid', 'utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];
    for (const param of trackingParams) {
      if (params.has(param)) {
        recommendations.push(`Consider excluding "${param}" parameter from indexed URL`);
        break;
      }
    }
  }

  // Keyword presence
  if (targetKeyword) {
    const keywordSlug = targetKeyword.toLowerCase().replace(/\s+/g, '-');
    const pathLower = structure.pathname.toLowerCase();

    if (!pathLower.includes(keywordSlug) && !pathLower.includes(targetKeyword.toLowerCase().replace(/\s+/g, ''))) {
      recommendations.push(`Consider including target keyword "${targetKeyword}" in URL path`);
    }
  }

  // Canonical consistency
  if (canonical) {
    try {
      const canonicalStructure = parseUrlStructure(canonical);

      if (structure.hasWww !== canonicalStructure.hasWww) {
        recommendations.push('Ensure www/non-www consistency between URL and canonical');
      }

      if (structure.hasTrailingSlash !== canonicalStructure.hasTrailingSlash) {
        recommendations.push('Ensure trailing slash consistency between URL and canonical');
      }
    } catch {
      // Invalid canonical URL
    }
  }

  // Common issues
  const problematicPatterns = [
    { pattern: /\/page\/\d+/, message: 'Pagination URLs may cause duplicate content - use rel="next/prev"' },
    { pattern: /\/tag\//, message: 'Tag pages often create thin content - consider noindexing or consolidating' },
    { pattern: /\/category\//, message: 'Ensure category pages add value - not just listing pages' },
    { pattern: /\.html$/, message: 'Consider removing .html extension for cleaner URLs' },
    { pattern: /\.php$/, message: 'Consider removing .php extension for cleaner URLs' },
    { pattern: /\/\d{4}\/\d{2}\//, message: 'Date-based URLs may appear outdated - consider removing dates' },
  ];

  for (const { pattern, message } of problematicPatterns) {
    if (pattern.test(structure.pathname)) {
      recommendations.push(message);
    }
  }

  // Segment analysis
  for (const segment of structure.segments) {
    if (segment.length > 30) {
      recommendations.push(`URL segment "${segment.substring(0, 20)}..." is too long`);
    }

    if (/^\d+$/.test(segment) && segment.length > 4) {
      recommendations.push('Avoid long numeric IDs in URLs - use slugs instead');
    }
  }

  return { url, issues, recommendations, structure };
};
