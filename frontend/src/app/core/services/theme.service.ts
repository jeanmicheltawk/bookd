import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import { ThemeSettings } from '../models';
import { ApiService } from './api.service';

const CSS_VAR_MAP: Record<keyof Omit<ThemeSettings, 'id' | 'name' | 'is_active' | 'updated_at'>, string> = {
  primary_color: '--color-primary',
  secondary_color: '--color-secondary',
  accent_color: '--color-accent',
  background_color: '--color-background',
  text_color: '--color-text',
  button_color: '--color-button',
  button_text_color: '--color-button-text',
  gradient_from: '--gradient-from',
  gradient_to: '--gradient-to',
  verified_badge_color: '--color-verified-badge',
};

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
        this.theme.set(theme);
        this.applyTheme(theme);
      }),
      catchError(() => {
        return of(null);
      }),
    );
  }

  applyTheme(theme: ThemeSettings): void {
    const root = document.documentElement;
    for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
      const value = (theme as any)[key];
      if (value) root.style.setProperty(cssVar, value);
    }
    if (theme.gradient_from && theme.gradient_to) {
      root.style.setProperty(
        '--gradient-neon',
        `linear-gradient(135deg, ${theme.gradient_from} 0%, ${theme.gradient_to} 100%)`,
      );
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
    return this.api.put<ThemeSettings>('/cms/theme', payload).pipe(
      tap((theme) => {
        this.theme.set(theme);
        this.applyTheme(theme);
      }),
    );
  }
}
