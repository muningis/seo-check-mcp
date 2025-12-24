import type { MissingRequired, MissingOptional } from '../types/mod';

export const missingRequired = (name: string): MissingRequired => ({
  message: `${name} is required, but it's missing!`
});

export const missingOptional = (name: string): MissingOptional => ({
  message: `${name} is advised, but it's missing!`
});
