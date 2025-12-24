import type { MissingRequired, MissingOptional } from './validation';
import type { HeadingData, ImageInfo, LinkInfo, Resource } from './content';

export interface SecurityHeaders {
  hsts: string | null;
  csp: string | null;
  xFrameOptions: string | null;
  xContentTypeOptions: string | null;
}

export interface OpenGraphMeta {
  title: string | MissingRequired;
  description: string | MissingRequired;
  image: string | MissingOptional;
  url: string | MissingOptional;
  type: string | MissingOptional;
  siteName: string | MissingOptional;
}

export interface TwitterMeta {
  card: string | MissingOptional;
  title: string | MissingOptional;
  description: string | MissingOptional;
  image: string | MissingOptional;
  site: string | MissingOptional;
}

export interface MobileMeta {
  themeColor: string | MissingOptional;
  appleMobileWebAppCapable: string | MissingOptional;
}

export interface PageMeta {
  charset: string | MissingRequired;
  viewport: string | MissingRequired;
  lang: string | MissingOptional;
  title: string | MissingRequired;
  titleLength: number;
  description: string | MissingRequired;
  descriptionLength: number;
  canonical: string | MissingOptional;
  robots: string | MissingOptional;
  og: OpenGraphMeta;
  twitter: TwitterMeta;
  mobile: MobileMeta;
}

export interface PageContent {
  html: string;
  wordCount: number;
  headings: {
    h1: HeadingData;
    h2: HeadingData;
    h3: HeadingData;
    h4: HeadingData;
    h5: HeadingData;
    h6: HeadingData;
  };
}

export interface ImageStats {
  total: number;
  withAlt: number;
  withoutAlt: number;
  details: ImageInfo[];
}

export interface PageLinks {
  internal: LinkInfo[];
  external: LinkInfo[];
}

export interface PageInfo {
  headers: Record<string, string>;
  securityHeaders: SecurityHeaders;
  meta: PageMeta;
  content: PageContent;
  images: ImageStats;
  links: PageLinks;
  resources: Resource[];
  ldJson: object[];
  vitalMetrics: VitalMetrics;
}

export interface RetrievePageResult {
  pageInfo: PageInfo;
  desktopScreenshot: string;
  mobileScreenshot: string;
}
