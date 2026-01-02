export {
  suggestTitleImprovements,
  suggestDescriptionImprovements,
  suggestCanonicalUrl,
} from './meta';

export {
  generateAltSuggestion,
  analyzeImage,
  analyzeImages,
} from './images';

export {
  analyzeHeadingStructure,
  suggestHeadingImprovements,
} from './headings';

export {
  parseUrlStructure,
  analyzeUrl,
} from './url';

export type { TitleSuggestion, DescriptionSuggestion } from './meta';
export type { ImageSuggestion, ImageAnalysisResult } from './images';
export type { HeadingSuggestion, HeadingStructureAnalysis, HeadingContent } from './headings';
export type { UrlAnalysis, UrlStructure } from './url';

export {
  analyzeSemanticStructure,
  calculateSemanticScore,
} from './semantic';
export type { SemanticSuggestion } from './semantic';

export {
  analyzeOpenGraph,
  analyzeTwitterCard,
  analyzeFacebook,
  generateSocialPreview,
  validateSocialImage,
  calculateSocialMetaScore,
} from './social-meta';
export type { SocialMetaSuggestion } from './social-meta';
