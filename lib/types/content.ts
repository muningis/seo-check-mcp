export interface LinkInfo {
  href: string;
  text: string;
  rel: string | null;
  target: string | null;
}

export interface HeadingData {
  count: number;
  texts: string[];
}

export interface ImageInfo {
  src: string;
  alt: string | null;
  width: string | null;
  height: string | null;
}

export interface UrlSet {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: number;
}

export interface Resource {
  mime: string;
  url: string;
  headers: Record<string, string>;
}
