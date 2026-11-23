/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import './index.css';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ASPECT_RATIOS,
  COUNTRIES,
  type AspectRatioValue,
} from '../shared/constants';
import { icons } from './icons';
import type { AppState, MarketResult, ResultFilter, ThemeMode, UploadedImage, ViewMode } from './types';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const THEME_STORAGE_KEY = 'aai-theme';

const MARKET_PRESETS: ReadonlyArray<{ id: string; label: string; countries: readonly string[] }> = [
  { id: 'dach', label: 'DACH', countries: ['Germany', 'Austria', 'Switzerland'] },
  { id: 'apac', label: 'APAC Key', countries: ['Japan', 'South Korea', 'Singapore', 'Australia'] },
  { id: 'latam', label: 'LATAM', countries: ['Brazil', 'Mexico', 'Colombia', 'Argentina'] },
  { id: 'nordics', label: 'Nordics', countries: ['Sweden', 'Norway', 'Denmark', 'Finland'] },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatMimeShort(mimeType: string): string {
  if (mimeType === 'image/png') return 'PNG';
  if (mimeType === 'image/webp') return 'WebP';
  return 'JPEG';
}

function getExtensionFromMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function sanitizeImageMime(mimeType: string): string {
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType) ? mimeType : 'image/png';
}

function getInitialTheme(): ThemeMode {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function triggerDownload(base64: string, mimeType: string, market: string): void {
  const safeMime = sanitizeImageMime(mimeType);
  const ext = getExtensionFromMime(safeMime);
  const a = document.createElement('a');
  a.href = `data:${safeMime};base64,${base64}`;
  a.download = `localized_ad_${market.toLowerCase().replace(/\s+/g, '_')}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function readImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

class AdLocalizerApp {
  private root: HTMLElement;
  private state: AppState;
  private abortController: AbortController | null = null;
  private campaignId = 0;
  private timerInterval: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = {
      theme: getInitialTheme(),
      uploadedReference: null,
      uploadError: null,
      isDragging: false,
      selectedMarkets: [],
      aspectRatio: '16:9',
      countrySearch: '',
      showCountryDropdown: false,
      activeCountryIndex: -1,
      results: [],
      isGenerating: false,
      generationStartedAt: null,
      elapsedSeconds: 0,
      filter: 'all',
      viewMode: 'grid',
      inspectMarket: null,
      splitPercent: 50,
    };

    this.mountShell();
    this.bindGlobalListeners();
    this.renderAll();
  }

  private mountShell(): void {
    this.root.innerHTML = `
      <div class="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <header id="app-header" class="h-16 px-6 lg:px-10 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between gap-6 shrink-0"></header>

        <main class="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
          <aside class="lg:col-span-5 xl:col-span-4 border-b lg:border-b-0 lg:border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 lg:p-8 flex flex-col gap-7 lg:overflow-y-auto">
            <div class="space-y-1.5">
              <h1 class="font-display text-3xl xl:text-[34px] font-semibold tracking-tight leading-tight text-[var(--text-primary)]">
                Ad Localizer Studio
              </h1>
              <p class="text-sm text-[var(--text-secondary)] leading-relaxed">
                Translate creative copy across global markets while preserving layout, brand colors, and composition.
              </p>
            </div>

            <section id="upload-section" aria-labelledby="heading-upload"></section>

            <div class="h-px bg-[var(--border-subtle)]"></div>

            <section id="markets-section" aria-labelledby="heading-markets" class="space-y-4">
              <div class="flex items-center justify-between gap-2">
                <h2 id="heading-markets" class="text-sm font-semibold text-[var(--text-primary)]">
                  2. Target Markets
                </h2>
                <span id="market-count-label" class="font-mono-tabular text-xs text-[var(--text-muted)]"></span>
              </div>

              <div id="preset-buttons" class="flex flex-wrap gap-2"></div>
              <div id="selected-markets-list"></div>

              <div id="combobox-container" class="relative">
                <div class="relative flex items-center">
                  <span class="absolute left-3.5 text-[var(--text-muted)] pointer-events-none flex items-center">
                    ${icons.searchLens('w-4 h-4')}
                  </span>
                  <input
                    id="country-search"
                    type="text"
                    role="combobox"
                    aria-expanded="false"
                    aria-controls="country-listbox"
                    aria-autocomplete="list"
                    autocomplete="off"
                    placeholder="Search 195 countries..."
                    class="w-full h-11 pl-10 pr-4 rounded-lg bg-[var(--bg-well)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-colors"
                  />
                </div>
                <div
                  id="country-listbox"
                  role="listbox"
                  class="hidden absolute z-40 w-full mt-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-[var(--shadow-elevated)] max-h-56 overflow-y-auto py-1"
                ></div>
              </div>
            </section>

            <div class="h-px bg-[var(--border-subtle)]"></div>

            <section id="aspect-section" aria-labelledby="heading-aspect"></section>

            <div id="generate-section" class="pt-1"></div>
          </aside>

          <section class="lg:col-span-7 xl:col-span-8 flex flex-col min-h-[60vh] lg:h-[calc(100vh-4rem)] lg:overflow-hidden bg-[var(--bg-canvas)]">
            <div id="results-toolbar"></div>
            <div id="results-viewport" class="flex-1 overflow-y-auto p-6 lg:p-10"></div>
          </section>
        </main>

        <div id="inspect-modal"></div>
      </div>
    `;
  }

  private bindGlobalListeners(): void {
    // Keyboard shortcuts for modal & combobox
    document.addEventListener('keydown', (e) => {
      if (this.state.inspectMarket) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.closeInspectModal();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.stepInspectMarket(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.stepInspectMarket(1);
        }
      }
    });

    // Combobox listeners (input element stays mounted so typing never loses focus)
    const input = this.el<HTMLInputElement>('#country-search');
    const combobox = this.el('#combobox-container');

    input.addEventListener('input', () => {
      this.state.countrySearch = input.value;
      this.state.showCountryDropdown = true;
      this.state.activeCountryIndex = -1;
      this.renderCountryDropdown();
    });

    input.addEventListener('focus', () => {
      this.state.showCountryDropdown = true;
      this.renderCountryDropdown();
    });

    combobox.addEventListener('focusout', (e) => {
      const related = e.relatedTarget as Node | null;
      if (!related || !combobox.contains(related)) {
        this.state.showCountryDropdown = false;
        this.renderCountryDropdown();
      }
    });

    input.addEventListener('keydown', (e) => {
      const filtered = this.getFilteredCountries();
      if (!this.state.countrySearch.trim() || filtered.length === 0) {
        if (e.key === 'Escape') {
          this.state.showCountryDropdown = false;
          this.renderCountryDropdown();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.state.showCountryDropdown = true;
        this.state.activeCountryIndex =
          this.state.activeCountryIndex < filtered.length - 1
            ? this.state.activeCountryIndex + 1
            : this.state.activeCountryIndex;
        this.renderCountryDropdown();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.state.activeCountryIndex =
          this.state.activeCountryIndex > 0 ? this.state.activeCountryIndex - 1 : 0;
        this.renderCountryDropdown();
      } else if (e.key === 'Enter' && this.state.activeCountryIndex >= 0) {
        e.preventDefault();
        const chosen = filtered[this.state.activeCountryIndex];
        if (chosen) {
          this.addMarket(chosen);
        }
      } else if (e.key === 'Escape') {
        this.state.showCountryDropdown = false;
        this.renderCountryDropdown();
      }
    });
  }

  private el<T extends HTMLElement = HTMLElement>(selector: string): T {
    const found = this.root.querySelector<T>(selector);
    if (!found) {
      throw new Error(`Expected element ${selector} not found`);
    }
    return found;
  }

  private getFilteredCountries(): string[] {
    const q = this.state.countrySearch.trim().toLowerCase();
    if (!q) return [];
    return COUNTRIES.filter(
      (c) => c.toLowerCase().includes(q) && !this.state.selectedMarkets.includes(c)
    ).slice(0, 8);
  }

  private getActiveAspectCss(): string {
    return ASPECT_RATIOS.find((ar) => ar.value === this.state.aspectRatio)?.css ?? 'aspect-video';
  }

  private toggleTheme(): void {
    const next: ThemeMode = this.state.theme === 'dark' ? 'light' : 'dark';
    this.state.theme = next;
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage failures
    }
    this.renderHeader();
  }

  private async processUploadedFile(file: File): Promise<void> {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
      this.state.uploadError = 'Unsupported format. Please upload a JPEG, PNG, or WebP image.';
      this.renderUploadSection();
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      this.state.uploadError = 'File exceeds the 20 MB maximum upload limit.';
      this.renderUploadSection();
      return;
    }

    this.state.uploadError = null;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Invalid file data'));
          }
        };
        reader.onerror = () => reject(new Error('Could not read the selected file.'));
        reader.readAsDataURL(file);
      });

      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        throw new Error('Failed to parse image bytes.');
      }

      const dims = await readImageDimensions(dataUrl);
      const uploaded: UploadedImage = {
        data: base64,
        mimeType: file.type,
        name: file.name,
        sizeBytes: file.size,
        width: dims.width,
        height: dims.height,
      };
      this.state.uploadedReference = uploaded;
      this.renderUploadSection();
      this.renderGenerateSection();
      this.renderResultsViewport();
    } catch (err: unknown) {
      this.state.uploadError =
        err instanceof Error ? err.message : 'Failed to process the selected image.';
      this.renderUploadSection();
    }
  }

  private addMarket(country: string): void {
    if (!this.state.selectedMarkets.includes(country)) {
      this.state.selectedMarkets = [...this.state.selectedMarkets, country];
    }
    this.state.countrySearch = '';
    this.state.showCountryDropdown = false;
    this.state.activeCountryIndex = -1;
    const input = this.el<HTMLInputElement>('#country-search');
    input.value = '';
    this.renderMarketsState();
    this.renderGenerateSection();
  }

  private removeMarket(country: string): void {
    this.state.selectedMarkets = this.state.selectedMarkets.filter((m) => m !== country);
    this.renderMarketsState();
    this.renderGenerateSection();
  }

  private applyPreset(presetCountries: readonly string[]): void {
    const merged = [...this.state.selectedMarkets];
    for (const c of presetCountries) {
      if (!merged.includes(c)) merged.push(c);
    }
    this.state.selectedMarkets = merged;
    this.renderMarketsState();
    this.renderGenerateSection();
  }

  private startElapsedTimer(): void {
    this.stopElapsedTimer();
    this.state.generationStartedAt = Date.now();
    this.state.elapsedSeconds = 0;
    this.timerInterval = window.setInterval(() => {
      if (this.state.generationStartedAt !== null && this.state.isGenerating) {
        this.state.elapsedSeconds = (Date.now() - this.state.generationStartedAt) / 1000;
        const timerEl = this.root.querySelector('#elapsed-timer');
        if (timerEl) {
          timerEl.textContent = `${this.state.elapsedSeconds.toFixed(1)}s`;
        }
      }
    }, 100);
  }

  private stopElapsedTimer(): void {
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private async requestMarketLocalization(
    market: string,
    ref: UploadedImage,
    ratio: AspectRatioValue,
    signal: AbortSignal
  ): Promise<{ base64Image: string; mimeType: string; durationMs: number }> {
    const started = performance.now();
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        market,
        refImage: ref.data,
        mimeType: ref.mimeType,
        ratio,
      }),
      signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : `HTTP error ${response.status}`);
    }
    if (!data.base64Image) {
      throw new Error('No image returned by server.');
    }

    return {
      base64Image: data.base64Image as string,
      mimeType: typeof data.mimeType === 'string' ? sanitizeImageMime(data.mimeType) : 'image/png',
      durationMs: Math.round(performance.now() - started),
    };
  }

  private async handleGenerate(): Promise<void> {
    if (!this.state.uploadedReference || this.state.selectedMarkets.length === 0) return;

    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;
    const currentCampaignId = ++this.campaignId;

    const marketsToGenerate = [...this.state.selectedMarkets];
    const refSnapshot = this.state.uploadedReference;
    const ratioSnapshot = this.state.aspectRatio;

    this.state.isGenerating = true;
    this.state.filter = 'all';
    this.state.results = marketsToGenerate.map((market) => ({
      market,
      loading: true,
      image: null,
      mimeType: 'image/png',
      error: null,
      durationMs: null,
    }));

    this.startElapsedTimer();
    this.renderHeader();
    this.renderGenerateSection();
    this.renderResultsToolbar();
    this.renderResultsViewport();

    try {
      await Promise.all(
        marketsToGenerate.map(async (market) => {
          try {
            const generated = await this.requestMarketLocalization(
              market,
              refSnapshot,
              ratioSnapshot,
              controller.signal
            );
            if (this.campaignId !== currentCampaignId) return;
            this.state.results = this.state.results.map((r) =>
              r.market === market
                ? {
                    ...r,
                    loading: false,
                    image: generated.base64Image,
                    mimeType: generated.mimeType,
                    error: null,
                    durationMs: generated.durationMs,
                  }
                : r
            );
          } catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            if (this.campaignId !== currentCampaignId) return;
            const message = err instanceof Error ? err.message : 'Generation error';
            this.state.results = this.state.results.map((r) =>
              r.market === market ? { ...r, loading: false, error: message } : r
            );
          }
          this.renderResultsToolbar();
          this.renderResultsViewport();
        })
      );
    } finally {
      if (this.campaignId === currentCampaignId) {
        this.state.isGenerating = false;
        this.stopElapsedTimer();
        this.renderGenerateSection();
        this.renderResultsToolbar();
      }
    }
  }

  private async handleRetryMarket(market: string): Promise<void> {
    if (!this.state.uploadedReference) return;
    if (!this.abortController) {
      this.abortController = new AbortController();
    }
    const currentCampaignId = this.campaignId;
    const signal = this.abortController.signal;
    const refSnapshot = this.state.uploadedReference;
    const ratioSnapshot = this.state.aspectRatio;

    this.state.results = this.state.results.map((r) =>
      r.market === market ? { ...r, loading: true, error: null } : r
    );
    this.renderResultsToolbar();
    this.renderResultsViewport();

    try {
      const generated = await this.requestMarketLocalization(
        market,
        refSnapshot,
        ratioSnapshot,
        signal
      );
      if (this.campaignId !== currentCampaignId) return;
      this.state.results = this.state.results.map((r) =>
        r.market === market
          ? {
              ...r,
              loading: false,
              image: generated.base64Image,
              mimeType: generated.mimeType,
              error: null,
              durationMs: generated.durationMs,
            }
          : r
      );
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (this.campaignId !== currentCampaignId) return;
      const message = err instanceof Error ? err.message : 'Generation error';
      this.state.results = this.state.results.map((r) =>
        r.market === market ? { ...r, loading: false, error: message } : r
      );
    }
    this.renderResultsToolbar();
    this.renderResultsViewport();
  }

  private handleExportAll(): void {
    const ready = this.state.results.filter(
      (r): r is MarketResult & { image: string } => Boolean(r.image)
    );
    ready.forEach((res, idx) => {
      window.setTimeout(() => {
        triggerDownload(res.image, res.mimeType, res.market);
      }, idx * 150);
    });
  }

  private handleReset(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.campaignId += 1;
    this.stopElapsedTimer();
    this.state.isGenerating = false;
    this.state.uploadedReference = null;
    this.state.uploadError = null;
    this.state.selectedMarkets = [];
    this.state.countrySearch = '';
    this.state.showCountryDropdown = false;
    this.state.activeCountryIndex = -1;
    this.state.results = [];
    this.state.elapsedSeconds = 0;
    this.state.filter = 'all';
    this.state.inspectMarket = null;
    this.el<HTMLInputElement>('#country-search').value = '';
    this.renderAll();
  }

  private openInspectModal(market: string): void {
    const found = this.state.results.find((r) => r.market === market && Boolean(r.image));
    if (!found) return;
    this.state.inspectMarket = market;
    this.state.splitPercent = 50;
    this.renderInspectModal();
  }

  private closeInspectModal(): void {
    this.state.inspectMarket = null;
    this.renderInspectModal();
  }

  private stepInspectMarket(delta: -1 | 1): void {
    const ready = this.state.results.filter((r) => Boolean(r.image));
    if (ready.length <= 1 || !this.state.inspectMarket) return;
    const idx = ready.findIndex((r) => r.market === this.state.inspectMarket);
    if (idx === -1) return;
    const nextIdx = (idx + delta + ready.length) % ready.length;
    this.state.inspectMarket = ready[nextIdx].market;
    this.renderInspectModal();
  }

  private renderAll(): void {
    this.renderHeader();
    this.renderUploadSection();
    this.renderMarketsState();
    this.renderAspectSection();
    this.renderGenerateSection();
    this.renderResultsToolbar();
    this.renderResultsViewport();
    this.renderInspectModal();
  }

  private renderHeader(): void {
    const header = this.el('#app-header');
    const isDark = this.state.theme === 'dark';
    const hasSessionContent =
      Boolean(this.state.uploadedReference) ||
      this.state.selectedMarkets.length > 0 ||
      this.state.results.length > 0;

    header.innerHTML = `
      <div class="flex items-center gap-3 whitespace-nowrap shrink-0">
        <span class="text-[var(--accent)] flex items-center">${icons.brandMark('w-6 h-6')}</span>
        <span class="font-display text-lg font-semibold tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0">
          AAI Global Kit
        </span>
      </div>

      <div class="flex items-center gap-3 shrink-0">
        ${
          hasSessionContent
            ? `<button
                id="header-reset-btn"
                type="button"
                class="h-10 px-4 rounded-lg border border-[var(--border-subtle)] bg-transparent hover:bg-[var(--bg-well)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                ${icons.refreshOrbit('w-4 h-4')}
                <span>New Campaign</span>
              </button>`
            : ''
        }
        <button
          id="theme-toggle-btn"
          type="button"
          aria-label="Toggle color theme"
          aria-pressed="${isDark}"
          class="h-10 px-3.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-well)] hover:bg-[var(--bg-hover)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          ${isDark ? icons.sun('w-4 h-4 text-[var(--accent)]') : icons.moon('w-4 h-4 text-[var(--accent)]')}
          <span>${isDark ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    `;

    this.el('#theme-toggle-btn').addEventListener('click', () => this.toggleTheme());
    const resetBtn = header.querySelector('#header-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.handleReset());
    }
  }

  private renderUploadSection(): void {
    const section = this.el('#upload-section');
    const ref = this.state.uploadedReference;

    section.innerHTML = `
      <div class="flex items-center justify-between gap-2 mb-3">
        <h2 id="heading-upload" class="text-sm font-semibold text-[var(--text-primary)]">
          1. Master Creative
        </h2>
        ${
          ref
            ? `<button
                id="remove-upload-btn"
                type="button"
                class="text-xs font-medium text-[var(--text-secondary)] hover:text-red-600 dark:hover:text-red-400 transition-colors whitespace-nowrap"
              >
                Replace file
              </button>`
            : `<span class="text-xs text-[var(--text-muted)]">JPEG, PNG, WebP · Max 20 MB</span>`
        }
      </div>

      ${
        ref
          ? `<div class="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] overflow-hidden">
              <div class="relative p-3 flex items-center justify-center bg-[var(--bg-well)]">
                <img
                  src="data:${sanitizeImageMime(ref.mimeType)};base64,${ref.data}"
                  alt="${escapeHtml(ref.name)}"
                  class="max-h-52 w-auto rounded-md object-contain"
                />
                <button
                  id="clear-image-icon-btn"
                  type="button"
                  aria-label="Remove uploaded image"
                  class="absolute top-3 right-3 w-8 h-8 rounded-lg bg-[var(--bg-surface)]/90 border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  ${icons.closeCross('w-4 h-4')}
                </button>
              </div>
              <div class="px-4 py-2.5 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                <span class="truncate font-medium text-[var(--text-primary)]" title="${escapeHtml(ref.name)}">${escapeHtml(ref.name)}</span>
                <span class="font-mono-tabular text-[var(--text-muted)] whitespace-nowrap shrink-0">
                  ${ref.width > 0 ? `${ref.width}×${ref.height} · ` : ''}${formatMimeShort(ref.mimeType)} · ${formatBytes(ref.sizeBytes)}
                </span>
              </div>
            </div>`
          : `<label
              id="dropzone-label"
              for="ad-upload"
              tabindex="0"
              class="flex flex-col items-center justify-center w-full min-h-36 px-4 py-6 rounded-xl border-2 border-dashed ${
                this.state.isDragging
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                  : 'border-[var(--border-strong)] bg-[var(--bg-well)]/60 hover:border-[var(--accent)] hover:bg-[var(--bg-well)]'
              } cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <span class="w-11 h-11 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--accent)] flex items-center justify-center mb-3">
                ${icons.uploadFrame('w-5 h-5')}
              </span>
              <span class="text-sm font-medium text-[var(--text-primary)] text-center">
                Drop advertisement creative here, or browse
              </span>
              <span class="text-xs text-[var(--text-muted)] mt-1">
                Only on-image text is translated; layout stays locked
              </span>
              <input
                id="ad-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="hidden"
              />
            </label>`
      }

      ${
        this.state.uploadError
          ? `<p role="alert" class="mt-2.5 flex items-center gap-2 text-xs font-medium text-red-600 dark:text-red-400">
              ${icons.alertTriangle('w-4 h-4 shrink-0')}
              <span>${escapeHtml(this.state.uploadError)}</span>
            </p>`
          : ''
      }

      <p class="mt-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
        By uploading, you confirm rights to this asset under our
        <a href="https://policies.google.com/terms/generative-ai/use-policy" target="_blank" rel="noopener noreferrer" class="underline hover:text-[var(--text-secondary)]">Prohibited Use Policy</a>
        and
        <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" class="underline hover:text-[var(--text-secondary)]">API Terms</a>.
      </p>
    `;

    if (ref) {
      section.querySelector('#remove-upload-btn')?.addEventListener('click', () => {
        this.state.uploadedReference = null;
        this.state.uploadError = null;
        this.renderHeader();
        this.renderUploadSection();
        this.renderGenerateSection();
        this.renderResultsViewport();
      });
      section.querySelector('#clear-image-icon-btn')?.addEventListener('click', () => {
        this.state.uploadedReference = null;
        this.state.uploadError = null;
        this.renderHeader();
        this.renderUploadSection();
        this.renderGenerateSection();
        this.renderResultsViewport();
      });
    } else {
      const input = section.querySelector<HTMLInputElement>('#ad-upload');
      const dropzone = section.querySelector<HTMLLabelElement>('#dropzone-label');

      input?.addEventListener('change', () => {
        const file = input.files?.[0];
        input.value = '';
        if (file) {
          void this.processUploadedFile(file);
        }
      });

      dropzone?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          input?.click();
        }
      });

      dropzone?.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (!this.state.isDragging) {
          this.state.isDragging = true;
          dropzone.classList.add('border-[var(--accent)]', 'bg-[var(--accent-soft)]');
        }
      });

      dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
      });

      dropzone?.addEventListener('dragleave', (e) => {
        const related = e.relatedTarget as Node | null;
        if (!related || !dropzone.contains(related)) {
          this.state.isDragging = false;
          dropzone.classList.remove('border-[var(--accent)]', 'bg-[var(--accent-soft)]');
        }
      });

      dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        this.state.isDragging = false;
        dropzone.classList.remove('border-[var(--accent)]', 'bg-[var(--accent-soft)]');
        const file = e.dataTransfer?.files?.[0];
        if (file) {
          void this.processUploadedFile(file);
        }
      });
    }
  }

  private renderMarketsState(): void {
    const countLabel = this.el('#market-count-label');
    const count = this.state.selectedMarkets.length;
    countLabel.textContent = count > 0 ? `${count} selected` : 'None selected';

    const presetsEl = this.el('#preset-buttons');
    presetsEl.innerHTML = MARKET_PRESETS.map((preset) => {
      const allSelected = preset.countries.every((c) => this.state.selectedMarkets.includes(c));
      return `
        <button
          type="button"
          data-preset="${preset.id}"
          class="h-8 px-3 rounded-md border text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            allSelected
              ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'border-[var(--border-subtle)] bg-[var(--bg-well)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
          }"
        >
          + ${escapeHtml(preset.label)}
        </button>
      `;
    }).join('');

    presetsEl.querySelectorAll<HTMLButtonElement>('button[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = MARKET_PRESETS.find((p) => p.id === btn.dataset.preset);
        if (preset) this.applyPreset(preset.countries);
      });
    });

    const listEl = this.el('#selected-markets-list');
    if (this.state.selectedMarkets.length === 0) {
      listEl.innerHTML = '';
    } else {
      listEl.innerHTML = `
        <div class="flex flex-wrap items-center gap-2">
          ${this.state.selectedMarkets
            .map(
              (market) => `
              <span class="inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-well)] text-xs font-medium text-[var(--text-primary)]">
                <span class="whitespace-nowrap">${escapeHtml(market)}</span>
                <button
                  type="button"
                  data-remove-market="${escapeHtml(market)}"
                  aria-label="Remove ${escapeHtml(market)}"
                  class="w-5 h-5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors"
                >
                  ${icons.closeCross('w-3 h-3')}
                </button>
              </span>
            `
            )
            .join('')}
          ${
            this.state.selectedMarkets.length > 1
              ? `<button
                  id="clear-markets-btn"
                  type="button"
                  class="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 transition-colors whitespace-nowrap"
                >
                  Clear all
                </button>`
              : ''
          }
        </div>
      `;

      listEl.querySelectorAll<HTMLButtonElement>('button[data-remove-market]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const market = btn.dataset.removeMarket;
          if (market) this.removeMarket(market);
        });
      });

      listEl.querySelector('#clear-markets-btn')?.addEventListener('click', () => {
        this.state.selectedMarkets = [];
        this.renderMarketsState();
        this.renderGenerateSection();
      });
    }

    this.renderCountryDropdown();
    this.renderHeader();
  }

  private renderCountryDropdown(): void {
    const input = this.el<HTMLInputElement>('#country-search');
    const listbox = this.el('#country-listbox');
    const hasQuery = this.state.countrySearch.trim().length > 0;
    const isOpen = this.state.showCountryDropdown && hasQuery;

    input.setAttribute('aria-expanded', String(isOpen));

    if (!isOpen) {
      listbox.classList.add('hidden');
      listbox.innerHTML = '';
      return;
    }

    const filtered = this.getFilteredCountries();
    listbox.classList.remove('hidden');

    if (filtered.length === 0) {
      listbox.innerHTML = `<div class="px-4 py-2.5 text-xs text-[var(--text-muted)]">No matching countries found</div>`;
      return;
    }

    listbox.innerHTML = filtered
      .map((country, idx) => {
        const active = this.state.activeCountryIndex === idx;
        return `
          <button
            type="button"
            role="option"
            aria-selected="${active}"
            data-country-option="${escapeHtml(country)}"
            class="w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors ${
              active
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                : 'text-[var(--text-primary)] hover:bg-[var(--bg-well)]'
            }"
          >
            <span>${escapeHtml(country)}</span>
            ${active ? `<span class="text-[11px] font-mono-tabular">Enter</span>` : ''}
          </button>
        `;
      })
      .join('');

    listbox.querySelectorAll<HTMLButtonElement>('button[data-country-option]').forEach((btn) => {
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        const country = btn.dataset.countryOption;
        if (country) this.addMarket(country);
      });
    });
  }

  private renderAspectSection(): void {
    const section = this.el('#aspect-section');
    section.innerHTML = `
      <div class="flex items-center justify-between gap-2 mb-3">
        <h2 id="heading-aspect" class="text-sm font-semibold text-[var(--text-primary)]">
          3. Output Aspect Ratio
        </h2>
        <span class="font-mono-tabular text-xs text-[var(--text-muted)]">${this.state.aspectRatio}</span>
      </div>
      <div class="grid grid-cols-5 gap-2" role="group" aria-label="Aspect Ratio">
        ${ASPECT_RATIOS.map((ar) => {
          const active = this.state.aspectRatio === ar.value;
          return `
            <button
              type="button"
              data-aspect="${ar.value}"
              aria-pressed="${active}"
              class="py-2.5 px-2 rounded-lg border flex flex-col items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-well)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }"
            >
              ${icons.aspectRatioFrame(ar.value, 'w-5 h-5')}
              <span class="font-mono-tabular text-xs font-semibold whitespace-nowrap">${ar.label}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;

    section.querySelectorAll<HTMLButtonElement>('button[data-aspect]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ratio = btn.dataset.aspect as AspectRatioValue | undefined;
        if (ratio) {
          this.state.aspectRatio = ratio;
          this.renderAspectSection();
          this.renderResultsViewport();
        }
      });
    });
  }

  private renderGenerateSection(): void {
    const section = this.el('#generate-section');
    const canGenerate =
      !this.state.isGenerating &&
      Boolean(this.state.uploadedReference) &&
      this.state.selectedMarkets.length > 0;
    const marketCount = this.state.selectedMarkets.length;

    section.innerHTML = `
      <button
        id="generate-btn"
        type="button"
        ${canGenerate ? '' : 'disabled'}
        class="w-full h-12 px-5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] font-semibold text-sm flex items-center justify-center gap-2.5 transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent)]"
      >
        ${
          this.state.isGenerating
            ? `${icons.spinnerRing('w-5 h-5')}<span>Localizing ${marketCount} ${marketCount === 1 ? 'Market' : 'Markets'}...</span>`
            : `${icons.globeMeridian('w-5 h-5')}<span>Localize ${marketCount > 0 ? `${marketCount} ${marketCount === 1 ? 'Market' : 'Markets'}` : 'Creative'}</span>`
        }
      </button>
    `;

    section.querySelector('#generate-btn')?.addEventListener('click', () => {
      void this.handleGenerate();
    });
  }

  private renderResultsToolbar(): void {
    const toolbar = this.el('#results-toolbar');
    const total = this.state.results.length;

    if (total === 0) {
      toolbar.innerHTML = '';
      return;
    }

    const readyCount = this.state.results.filter((r) => Boolean(r.image)).length;
    const pendingCount = this.state.results.filter((r) => r.loading).length;
    const failedCount = this.state.results.filter((r) => !r.loading && Boolean(r.error)).length;
    const completedCount = readyCount + failedCount;
    const progressRatio = total > 0 ? completedCount / total : 0;

    const tabs: ReadonlyArray<{ id: ResultFilter; label: string; count: number }> = [
      { id: 'all', label: 'All', count: total },
      { id: 'ready', label: 'Ready', count: readyCount },
      { id: 'pending', label: 'Pending', count: pendingCount },
      { id: 'failed', label: 'Failed', count: failedCount },
    ];

    toolbar.innerHTML = `
      <div class="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-6 lg:px-10 py-4 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-well)] border border-[var(--border-subtle)]" role="tablist" aria-label="Filter localized assets">
            ${tabs
              .map((t) => {
                const active = this.state.filter === t.id;
                return `
                  <button
                    type="button"
                    role="tab"
                    aria-selected="${active}"
                    data-filter="${t.id}"
                    class="h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }"
                  >
                    <span>${t.label}</span>
                    <span class="font-mono-tabular text-[11px] text-[var(--text-muted)]">${t.count}</span>
                  </button>
                `;
              })
              .join('')}
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <div class="hidden sm:flex items-center gap-2 text-xs text-[var(--text-secondary)] font-mono-tabular">
              <span>${completedCount}/${total} done</span>
              <span aria-hidden="true">·</span>
              <span id="elapsed-timer">${this.state.elapsedSeconds.toFixed(1)}s</span>
            </div>

            <div class="flex items-center p-1 rounded-lg bg-[var(--bg-well)] border border-[var(--border-subtle)]" role="group" aria-label="Layout mode">
              <button
                type="button"
                data-view="grid"
                aria-label="Grid layout"
                aria-pressed="${this.state.viewMode === 'grid'}"
                class="w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                  this.state.viewMode === 'grid'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }"
              >
                ${icons.gridView('w-4 h-4')}
              </button>
              <button
                type="button"
                data-view="list"
                aria-label="List layout"
                aria-pressed="${this.state.viewMode === 'list'}"
                class="w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                  this.state.viewMode === 'list'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }"
              >
                ${icons.listView('w-4 h-4')}
              </button>
            </div>

            <button
              id="export-all-btn"
              type="button"
              ${readyCount === 0 ? 'disabled' : ''}
              class="h-10 px-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              ${icons.downloadTray('w-4 h-4')}
              <span>Export All${readyCount > 0 ? ` (${readyCount})` : ''}</span>
            </button>
          </div>
        </div>

        <div class="h-1 w-full rounded-full bg-[var(--bg-well)] overflow-hidden" role="progressbar" aria-valuenow="${Math.round(progressRatio * 100)}" aria-valuemin="0" aria-valuemax="100">
          <div
            class="h-full bg-[var(--accent)] origin-left transition-transform duration-200 ease-out"
            style="transform: scaleX(${progressRatio});"
          ></div>
        </div>
      </div>
    `;

    toolbar.querySelectorAll<HTMLButtonElement>('button[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = btn.dataset.filter as ResultFilter | undefined;
        if (f) {
          this.state.filter = f;
          this.renderResultsToolbar();
          this.renderResultsViewport();
        }
      });
    });

    toolbar.querySelectorAll<HTMLButtonElement>('button[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.view as ViewMode | undefined;
        if (v) {
          this.state.viewMode = v;
          this.renderResultsToolbar();
          this.renderResultsViewport();
        }
      });
    });

    toolbar.querySelector('#export-all-btn')?.addEventListener('click', () => {
      this.handleExportAll();
    });
  }

  private renderResultsViewport(): void {
    const viewport = this.el('#results-viewport');
    const aspectCss = this.getActiveAspectCss();

    if (this.state.results.length === 0) {
      viewport.className = 'flex-1 overflow-y-auto p-6 lg:p-10 studio-grid-bg flex items-center justify-center';
      const ref = this.state.uploadedReference;
      viewport.innerHTML = `
        <div class="w-full max-w-lg text-center space-y-6">
          <div class="mx-auto w-full max-w-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <div class="${aspectCss} w-full rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-well)]/70 flex flex-col items-center justify-center p-4 overflow-hidden transition-all duration-200">
              ${
                ref
                  ? `<img src="data:${sanitizeImageMime(ref.mimeType)};base64,${ref.data}" alt="Selected master creative preview" class="w-full h-full object-contain rounded" />`
                  : `<span class="text-[var(--accent)] mb-2">${icons.aspectRatioFrame(this.state.aspectRatio, 'w-9 h-9')}</span>
                     <span class="font-mono-tabular text-xs font-medium text-[var(--text-secondary)]">Canvas ${this.state.aspectRatio}</span>`
              }
            </div>
          </div>
          <div class="space-y-1.5">
            <h3 class="font-display text-xl font-semibold text-[var(--text-primary)]">
              ${ref ? 'Ready to Localize' : 'Awaiting Master Creative'}
            </h3>
            <p class="text-sm text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
              ${
                ref
                  ? 'Choose target countries on the left and run localization to preview and compare every market variant here.'
                  : 'Upload your advertisement image, select target countries, and choose an output aspect ratio.'
              }
            </p>
          </div>
        </div>
      `;
      return;
    }

    const filtered = this.state.results.filter((r) => {
      if (this.state.filter === 'ready') return Boolean(r.image);
      if (this.state.filter === 'pending') return r.loading;
      if (this.state.filter === 'failed') return !r.loading && Boolean(r.error);
      return true;
    });

    viewport.className = 'flex-1 overflow-y-auto p-6 lg:p-10 studio-grid-bg';

    if (filtered.length === 0) {
      viewport.innerHTML = `
        <div class="h-full min-h-64 flex flex-col items-center justify-center text-center">
          <p class="text-sm font-medium text-[var(--text-secondary)]">No assets match the selected filter.</p>
        </div>
      `;
      return;
    }

    const containerClass =
      this.state.viewMode === 'grid'
        ? 'grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-6xl mx-auto'
        : 'flex flex-col gap-6 max-w-3xl mx-auto';

    viewport.innerHTML = `
      <div class="${containerClass}">
        ${filtered
          .map((res) => {
            const safeMarket = escapeHtml(res.market);
            const safeMime = sanitizeImageMime(res.mimeType);
            const statusText = res.loading
              ? 'Generating'
              : res.image
              ? `Ready${res.durationMs ? ` · ${(res.durationMs / 1000).toFixed(1)}s` : ''} · ${formatMimeShort(safeMime)}`
              : 'Failed';

            return `
              <article class="animate-card-enter rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden flex flex-col">
                <div class="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <h3 class="text-sm font-semibold text-[var(--text-primary)] truncate">${safeMarket}</h3>
                    <div class="flex items-center gap-1.5 text-xs ${
                      res.error
                        ? 'text-red-600 dark:text-red-400'
                        : res.image
                        ? 'text-[var(--accent)]'
                        : 'text-[var(--text-muted)]'
                    }">
                      ${
                        res.loading
                          ? `${icons.spinnerRing('w-3.5 h-3.5')}<span>Generating...</span>`
                          : res.image
                          ? `${icons.checkCircle('w-3.5 h-3.5')}<span class="font-mono-tabular">${statusText}</span>`
                          : `${icons.alertTriangle('w-3.5 h-3.5')}<span>Failed</span>`
                      }
                    </div>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    ${
                      res.image
                        ? `<button
                            type="button"
                            data-inspect-market="${safeMarket}"
                            aria-label="Compare ${safeMarket} with original"
                            class="h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-well)] hover:bg-[var(--bg-hover)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                          >
                            ${icons.compareSplit('w-3.5 h-3.5')}
                            <span>Compare</span>
                          </button>
                          <button
                            type="button"
                            data-download-market="${safeMarket}"
                            aria-label="Download localized ad for ${safeMarket}"
                            class="w-9 h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-well)] text-[var(--text-primary)] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                          >
                            ${icons.downloadTray('w-4 h-4')}
                          </button>`
                        : !res.loading
                        ? `<button
                            type="button"
                            data-retry-market="${safeMarket}"
                            class="h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-well)] hover:bg-[var(--bg-hover)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                          >
                            ${icons.refreshOrbit('w-3.5 h-3.5')}
                            <span>Retry</span>
                          </button>`
                        : ''
                    }
                  </div>
                </div>

                <div class="bg-[var(--bg-well)]/50 flex-1 flex items-center justify-center p-3">
                  ${
                    res.loading
                      ? `<div class="${aspectCss} w-full rounded-lg bg-[var(--bg-well)] flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
                          ${icons.spinnerRing('w-7 h-7 text-[var(--accent)]')}
                          <span class="text-xs font-medium">Translating copy for ${safeMarket}</span>
                        </div>`
                      : res.image
                      ? `<button
                          type="button"
                          data-inspect-market="${safeMarket}"
                          class="w-full rounded-lg overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] cursor-zoom-in"
                        >
                          <img
                            src="data:${safeMime};base64,${res.image}"
                            alt="Localized advertisement for ${safeMarket}"
                            class="w-full max-h-[420px] object-contain mx-auto"
                          />
                        </button>`
                      : `<div class="${aspectCss} w-full rounded-lg bg-[var(--bg-well)] flex flex-col items-center justify-center px-6 text-center gap-2">
                          <span class="text-red-600 dark:text-red-400">${icons.alertTriangle('w-6 h-6')}</span>
                          <p class="text-sm font-medium text-[var(--text-primary)]">Could not generate ${safeMarket}</p>
                          ${
                            res.error
                              ? `<p class="text-xs text-[var(--text-secondary)] max-w-sm">${escapeHtml(res.error)}</p>`
                              : ''
                          }
                        </div>`
                  }
                </div>
              </article>
            `;
          })
          .join('')}
      </div>
    `;

    viewport.querySelectorAll<HTMLButtonElement>('button[data-download-market]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const market = btn.dataset.downloadMarket;
        const found = this.state.results.find((r) => r.market === market && Boolean(r.image));
        if (found?.image) {
          triggerDownload(found.image, found.mimeType, found.market);
        }
      });
    });

    viewport.querySelectorAll<HTMLButtonElement>('button[data-inspect-market]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const market = btn.dataset.inspectMarket;
        if (market) this.openInspectModal(market);
      });
    });

    viewport.querySelectorAll<HTMLButtonElement>('button[data-retry-market]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const market = btn.dataset.retryMarket;
        if (market) void this.handleRetryMarket(market);
      });
    });
  }

  private renderInspectModal(): void {
    const container = this.el('#inspect-modal');
    if (!this.state.inspectMarket || !this.state.uploadedReference) {
      container.innerHTML = '';
      return;
    }

    const ready = this.state.results.filter((r) => Boolean(r.image));
    const current = ready.find((r) => r.market === this.state.inspectMarket);
    if (!current || !current.image) {
      container.innerHTML = '';
      return;
    }

    const ref = this.state.uploadedReference;
    const safeMarket = escapeHtml(current.market);
    const safeMime = sanitizeImageMime(current.mimeType);
    const hasMultiple = ready.length > 1;

    container.innerHTML = `
      <div
        id="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Compare original and ${safeMarket} localized ad"
        class="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 lg:p-8"
      >
        <div class="w-full max-w-5xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-elevated)] overflow-hidden flex flex-col max-h-[92vh]">
          <div class="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <h2 class="font-display text-lg font-semibold text-[var(--text-primary)] truncate">${safeMarket}</h2>
              <span class="text-xs text-[var(--text-muted)] font-mono-tabular whitespace-nowrap">
                Original vs. Localized · Drag slider
              </span>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              ${
                hasMultiple
                  ? `<button id="modal-prev-btn" type="button" aria-label="Previous market" class="w-9 h-9 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-well)] text-[var(--text-primary)] flex items-center justify-center transition-colors">
                      ${icons.chevronLeft('w-4 h-4')}
                    </button>
                    <button id="modal-next-btn" type="button" aria-label="Next market" class="w-9 h-9 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-well)] text-[var(--text-primary)] flex items-center justify-center transition-colors">
                      ${icons.chevronRight('w-4 h-4')}
                    </button>`
                  : ''
              }
              <button id="modal-download-btn" type="button" class="h-9 px-3.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-colors">
                ${icons.downloadTray('w-4 h-4')}
                <span>Download</span>
              </button>
              <button id="modal-close-btn" type="button" aria-label="Close comparison" class="w-9 h-9 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-well)] text-[var(--text-primary)] flex items-center justify-center transition-colors">
                ${icons.closeCross('w-4 h-4')}
              </button>
            </div>
          </div>

          <div class="p-4 lg:p-6 bg-[var(--bg-canvas)] flex-1 overflow-auto flex flex-col items-center justify-center gap-4">
            <div id="compare-stage" class="relative w-full max-w-4xl select-none rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-well)]">
              <img
                src="data:${safeMime};base64,${current.image}"
                alt="Localized advertisement for ${safeMarket}"
                class="w-full max-h-[66vh] object-contain block pointer-events-none"
              />
              <div
                id="compare-original-layer"
                class="absolute inset-0 pointer-events-none"
                style="clip-path: inset(0 ${100 - this.state.splitPercent}% 0 0);"
              >
                <img
                  src="data:${sanitizeImageMime(ref.mimeType)};base64,${ref.data}"
                  alt="Original master advertisement"
                  class="w-full h-full object-contain block"
                />
              </div>
              <div
                id="compare-divider"
                class="absolute top-0 bottom-0 w-0.5 bg-[var(--accent)] pointer-events-none"
                style="left: ${this.state.splitPercent}%;"
              >
                <div class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] shadow-md flex items-center justify-center">
                  ${icons.compareSplit('w-4 h-4')}
                </div>
              </div>
              <div class="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/70 text-white text-[11px] font-medium pointer-events-none">
                Original
              </div>
              <div class="absolute bottom-3 right-3 px-2.5 py-1 rounded-md bg-black/70 text-white text-[11px] font-medium pointer-events-none">
                ${safeMarket}
              </div>
            </div>

            <div class="w-full max-w-md flex items-center gap-3">
              <span class="text-xs font-medium text-[var(--text-secondary)]">Original</span>
              <input
                id="compare-range"
                type="range"
                min="0"
                max="100"
                value="${this.state.splitPercent}"
                aria-label="Before and after split position"
                class="flex-1 accent-[var(--accent)] cursor-ew-resize"
              />
              <span class="text-xs font-medium text-[var(--text-secondary)]">${safeMarket}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const updateSplit = (pct: number) => {
      const clamped = Math.max(0, Math.min(100, pct));
      this.state.splitPercent = clamped;
      const layer = container.querySelector<HTMLElement>('#compare-original-layer');
      const divider = container.querySelector<HTMLElement>('#compare-divider');
      const range = container.querySelector<HTMLInputElement>('#compare-range');
      if (layer) layer.style.clipPath = `inset(0 ${100 - clamped}% 0 0)`;
      if (divider) divider.style.left = `${clamped}%`;
      if (range) range.value = String(Math.round(clamped));
    };

    const stage = container.querySelector<HTMLElement>('#compare-stage');
    const range = container.querySelector<HTMLInputElement>('#compare-range');

    range?.addEventListener('input', () => {
      updateSplit(Number(range.value));
    });

    if (stage) {
      let dragging = false;
      const onPointerMove = (e: PointerEvent) => {
        if (!dragging) return;
        const rect = stage.getBoundingClientRect();
        if (rect.width > 0) {
          updateSplit(((e.clientX - rect.left) / rect.width) * 100);
        }
      };
      stage.addEventListener('pointerdown', (e) => {
        dragging = true;
        stage.setPointerCapture(e.pointerId);
        const rect = stage.getBoundingClientRect();
        if (rect.width > 0) {
          updateSplit(((e.clientX - rect.left) / rect.width) * 100);
        }
      });
      stage.addEventListener('pointermove', onPointerMove);
      stage.addEventListener('pointerup', () => {
        dragging = false;
      });
      stage.addEventListener('pointercancel', () => {
        dragging = false;
      });
    }

    container.querySelector('#modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeInspectModal();
      }
    });
    container.querySelector('#modal-close-btn')?.addEventListener('click', () => {
      this.closeInspectModal();
    });
    container.querySelector('#modal-prev-btn')?.addEventListener('click', () => {
      this.stepInspectMarket(-1);
    });
    container.querySelector('#modal-next-btn')?.addEventListener('click', () => {
      this.stepInspectMarket(1);
    });
    container.querySelector('#modal-download-btn')?.addEventListener('click', () => {
      if (current.image) {
        triggerDownload(current.image, current.mimeType, current.market);
      }
    });
  }
}

const mountEl = document.getElementById('app');
if (mountEl) {
  new AdLocalizerApp(mountEl);
}
