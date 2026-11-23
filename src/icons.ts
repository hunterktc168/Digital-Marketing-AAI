/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AspectRatioValue } from '../shared/constants';

function svg(body: string, className = 'w-5 h-5', viewBox = '0 0 24 24'): string {
  return `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${className}">${body}</svg>`;
}

export const icons = {
  brandMark(className = 'w-6 h-6'): string {
    return svg(
      `<rect x="3" y="3" width="18" height="18" rx="4" />
       <circle cx="12" cy="12" r="5" />
       <path d="M7 12h10" />
       <path d="M12 7a7.5 7.5 0 0 1 0 10" />
       <path d="M12 7a7.5 7.5 0 0 0 0 10" />`,
      className
    );
  },

  uploadFrame(className = 'w-6 h-6'): string {
    return svg(
      `<path d="M4 9V6a2 2 0 0 1 2-2h3" />
       <path d="M15 4h3a2 2 0 0 1 2 2v3" />
       <path d="M20 15v3a2 2 0 0 1-2 2h-3" />
       <path d="M9 20H6a2 2 0 0 1-2-2v-3" />
       <path d="M12 16V8" />
       <path d="m8.5 11.5 3.5-3.5 3.5 3.5" />`,
      className
    );
  },

  globeMeridian(className = 'w-5 h-5'): string {
    return svg(
      `<circle cx="12" cy="12" r="9" />
       <ellipse cx="12" cy="12" rx="4" ry="9" />
       <path d="M3.6 9h16.8" />
       <path d="M3.6 15h16.8" />`,
      className
    );
  },

  sun(className = 'w-4 h-4'): string {
    return svg(
      `<circle cx="12" cy="12" r="4" />
       <path d="M12 2.5v2" />
       <path d="M12 19.5v2" />
       <path d="m5.28 5.28 1.42 1.42" />
       <path d="m17.3 17.3 1.42 1.42" />
       <path d="M2.5 12h2" />
       <path d="M19.5 12h2" />
       <path d="m5.28 18.72 1.42-1.42" />
       <path d="m17.3 6.7 1.42-1.42" />`,
      className
    );
  },

  moon(className = 'w-4 h-4'): string {
    return svg(
      `<path d="M20.2 14.5A8.5 8.5 0 0 1 9.5 3.8a8.5 8.5 0 1 0 10.7 10.7Z" />`,
      className
    );
  },

  downloadTray(className = 'w-4 h-4'): string {
    return svg(
      `<path d="M12 4v11" />
       <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
       <path d="M4 17.5v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />`,
      className
    );
  },

  refreshOrbit(className = 'w-4 h-4'): string {
    return svg(
      `<path d="M20 11a8.1 8.1 0 0 0-15.5-2m-.5-4v4h4" />
       <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />`,
      className
    );
  },

  searchLens(className = 'w-4 h-4'): string {
    return svg(
      `<circle cx="11" cy="11" r="6.5" />
       <path d="m16 16 4.2 4.2" />`,
      className
    );
  },

  closeCross(className = 'w-3.5 h-3.5'): string {
    return svg(
      `<path d="M6 6 18 18" />
       <path d="M18 6 6 18" />`,
      className
    );
  },

  checkCircle(className = 'w-4 h-4'): string {
    return svg(
      `<circle cx="12" cy="12" r="9" />
       <path d="m8.5 12.2 2.4 2.4 4.8-5" />`,
      className
    );
  },

  alertTriangle(className = 'w-4 h-4'): string {
    return svg(
      `<path d="M10.3 4.3 2.7 17.5A1.8 1.8 0 0 0 4.3 20h15.4a1.8 1.8 0 0 0 1.6-2.5L13.7 4.3a1.9 1.9 0 0 0-3.4 0Z" />
       <path d="M12 9.5v4" />
       <path d="M12 16.5h.01" />`,
      className
    );
  },

  compareSplit(className = 'w-4 h-4'): string {
    return svg(
      `<rect x="3" y="5" width="18" height="14" rx="2" />
       <path d="M12 3v18" />
       <path d="m8.5 12-2 0" />
       <path d="m17.5 12-2 0" />`,
      className
    );
  },

  gridView(className = 'w-4 h-4'): string {
    return svg(
      `<rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
       <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
       <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
       <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />`,
      className
    );
  },

  listView(className = 'w-4 h-4'): string {
    return svg(
      `<rect x="4" y="5" width="16" height="5" rx="1.5" />
       <rect x="4" y="14" width="16" height="5" rx="1.5" />`,
      className
    );
  },

  chevronLeft(className = 'w-4 h-4'): string {
    return svg(`<path d="m15 6-6 6 6 6" />`, className);
  },

  chevronRight(className = 'w-4 h-4'): string {
    return svg(`<path d="m9 6 6 6-6 6" />`, className);
  },

  spinnerRing(className = 'w-5 h-5'): string {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" class="${className} animate-spin-smooth">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.22" stroke-width="2.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" />
    </svg>`;
  },

  aspectRatioFrame(ratio: AspectRatioValue, className = 'w-5 h-5'): string {
    let rect = '<rect x="3" y="6.5" width="18" height="11" rx="1.5" />';
    switch (ratio) {
      case '16:9':
        rect = '<rect x="2.5" y="7" width="19" height="10" rx="1.5" />';
        break;
      case '1:1':
        rect = '<rect x="5" y="5" width="14" height="14" rx="1.5" />';
        break;
      case '9:16':
        rect = '<rect x="7" y="2.5" width="10" height="19" rx="1.5" />';
        break;
      case '4:3':
        rect = '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />';
        break;
      case '3:4':
        rect = '<rect x="5.5" y="3.5" width="13" height="17" rx="1.5" />';
        break;
    }
    return svg(rect, className);
  },
};
