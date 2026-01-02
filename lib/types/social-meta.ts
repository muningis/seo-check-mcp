/**
 * Types for social media meta tag analysis
 */

export interface OpenGraphData {
  title: string | null;
  description: string | null;
  image: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  imageAlt: string | null;
  url: string | null;
  type: string | null;
  siteName: string | null;
  locale: string | null;
  localeAlternates: string[];
  video: string | null;
  audio: string | null;
}

export type TwitterCardType = 'summary' | 'summary_large_image' | 'app' | 'player';

export interface TwitterCardData {
  card: TwitterCardType | null;
  title: string | null;
  description: string | null;
  image: string | null;
  imageAlt: string | null;
  site: string | null;
  siteId: string | null;
  creator: string | null;
  creatorId: string | null;
  player: string | null;
  playerWidth: number | null;
  playerHeight: number | null;
}

export interface FacebookData {
  appId: string | null;
  pages: string | null;
  admins: string | null;
}

export interface SocialPreview {
  platform: 'facebook' | 'twitter' | 'linkedin';
  title: string;
  description: string;
  image: string | null;
  url: string;
  displayUrl: string;
  truncations: {
    title: boolean;
    description: boolean;
  };
}

export interface ImageValidation {
  url: string | null;
  isAbsolute: boolean;
  meetsMinimumSize: boolean;
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
  issues: string[];
  recommendations: string[];
}

export interface SocialMetaScore {
  openGraph: number;
  twitter: number;
  bonus: number;
  overall: number;
}

export interface PlatformAnalysis<T> {
  data: T;
  issues: string[];
  suggestions: string[];
  score: number;
  preview: SocialPreview;
}

export interface SocialMetaAnalysisResult {
  url: string;
  openGraph: PlatformAnalysis<OpenGraphData>;
  twitter: PlatformAnalysis<TwitterCardData>;
  facebook: {
    data: FacebookData;
    issues: string[];
    suggestions: string[];
  };
  imageValidation: ImageValidation | null;
  score: SocialMetaScore;
  priorityActions: string[];
}
