declare type Base64String = string;

declare interface CoreWebVitals {
  /** Largest Contentful Paint in milliseconds (target: < 2500ms) */
  lcp: number | null;
  /** Cumulative Layout Shift score (target: < 0.1) */
  cls: number | null;
  /** First Contentful Paint in milliseconds */
  fcp: number | null;
}

declare interface VitalMetrics {
  /** Time to First Byte in milliseconds */
  timeToFirstByteMS: number;
  /** Load complete time in milliseconds */
  loadCompleteMS: number;
  /** DOM interactive time in milliseconds */
  domInteractiveMS: number;
  /** DOM content loaded time in milliseconds */
  domContentLoadedMS: number;
  /** Core Web Vitals (Google ranking factors) */
  coreWebVitals: CoreWebVitals;
}
