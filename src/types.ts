/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AspectRatioValue } from '../shared/constants';

export type ThemeMode = 'light' | 'dark';
export type ResultFilter = 'all' | 'ready' | 'pending' | 'failed';
export type ViewMode = 'grid' | 'list';

export interface UploadedImage {
  data: string;
  mimeType: string;
  name: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface MarketResult {
  market: string;
  loading: boolean;
  image: string | null;
  mimeType: string;
  error: string | null;
  durationMs: number | null;
}

export interface AppState {
  theme: ThemeMode;
  uploadedReference: UploadedImage | null;
  uploadError: string | null;
  isDragging: boolean;
  selectedMarkets: string[];
  aspectRatio: AspectRatioValue;
  countrySearch: string;
  showCountryDropdown: boolean;
  activeCountryIndex: number;
  results: MarketResult[];
  isGenerating: boolean;
  generationStartedAt: number | null;
  elapsedSeconds: number;
  filter: ResultFilter;
  viewMode: ViewMode;
  inspectMarket: string | null;
  splitPercent: number;
}
