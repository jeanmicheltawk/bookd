import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import { ThemeSettings } from '../models';
import { ApiService } from './api.service';

const CSS_VAR_MAP: Array<{ key: keyof ThemeSettings; vars: string[] }> = [
  { key: 'primary_color', vars: ['--color-primary', '--acid-lime'] },
  { key: 'secondary_color', vars: ['--color-secondary', '--hyper-pink'] },
  { key: 'accent_color', vars: ['--color-accent', '--laser-cyan', '--focus'] },
  { key: 'background_color', vars: ['--color-background', '--toxic-orange'] },
  { key: 'text_color', vars: ['--color-text', '--text', '--text-primary'] },
  { key: 'button_color', vars: ['--color-button', '--cta'] },
  { key: 'button_text_color', vars: ['--color-button-text'] },
  { key: 'verified_badge_color', vars: ['--color-verified-badge'] },
];

export function cloneTheme(theme: ThemeSettings): ThemeSettings {
  return { ...theme };
}

export function themesMatch(a: Partial<ThemeSettings> | null | undefined, b: Partial<ThemeSettings> | null | undefined): boolean {
  if (!a || !b) return false;
  const keys: Array<keyof ThemeSettings> = [
    'primary_color', 'secondary_color', 'accent_color', 'background_color',
    'text_color', 'button_color', 'button_text_color', 'verified_badge_color',
  ];
  return keys.every((key) => String(a[key] ?? '').toLowerCase() === String(b[key] ?? '').toLowerCase());
}

/**
 * Loads the active theme from the CMS and applies it as CSS custom properties
 * on :root, so the whole app (including Material components) re-skins live.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private api = inject(ApiService);

  readonly theme = signal<ThemeSettings | null>(null);

  loadTheme(): Observable<ThemeSettings | null> {
    return this.api.get<ThemeSettings>('/cms/theme').pipe(
      tap((theme) => {
        this.theme.set(cloneTheme(theme));
        this.applyTheme(theme);
      }),
      catchError(() => {
        return of(null);
      }),
    );
  }

  applyTheme(theme: ThemeSettings): void {
    const root = document.documentElement;
    for (const { key, vars } of CSS_VAR_MAP) {
      const value = theme[key];
      if (typeof value === 'string' && value) {
        for (const cssVar of vars) root.style.setProperty(cssVar, value);
      }
    }
  }

  /** Live-preview a draft theme (admin theme editor) without persisting it. */
  previewTheme(partial: Partial<ThemeSettings>): void {
    const merged = { ...(this.theme() ?? ({} as ThemeSettings)), ...partial } as ThemeSettings;
    this.applyTheme(merged);
  }

  resetToSaved(): void {
    const saved = this.theme();
    if (saved) this.applyTheme(saved);
  }

  updateTheme(payload: Partial<ThemeSettings>): Observable<ThemeSettings> {
    const body = {
      id: payload.id,
      name: payload.name,
      primary_color: payload.primary_color,
      secondary_color: payload.secondary_color,
      accent_color: payload.accent_color,
      background_color: payload.background_color,
      text_color: payload.text_color,
      button_color: payload.button_color,
      button_text_color: payload.button_text_color,
      gradient_from: payload.gradient_from,
      gradient_to: payload.gradient_to,
      verified_badge_color: payload.verified_badge_color,
    };
    return this.api.put<ThemeSettings>('/cms/theme', body).pipe(
      tap((theme) => {
        this.theme.set(cloneTheme(theme));
        this.applyTheme(theme);
      }),
    );
  }
}
