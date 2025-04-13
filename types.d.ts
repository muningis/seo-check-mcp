declare type Base64String = string;

declare interface VitalMetrics {
  timeToFirstByteMS: number;
  loadCompleteMS: number;
  domInteractiveMS: number;
  domContentLoadedMS: number;
}