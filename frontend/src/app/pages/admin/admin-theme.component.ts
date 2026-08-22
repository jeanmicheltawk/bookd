import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, of } from 'rxjs';

import { ThemeService, cloneTheme, themesMatch } from '../../core/services/theme.service';
import { ThemeSettings } from '../../core/models';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

const BRAND_PRESETS: Array<{ name: string; colors: Partial<ThemeSettings> }> = [
  {
    name: 'Acid Lime',
    colors: {
      primary_color: '#C6FF00', secondary_color: '#FF00A8', accent_color: '#00F5FF',
      background_color: '#FF4D00', text_color: '#FFFFFF', button_color: '#C6FF00',
      button_text_color: '#09000F', gradient_from: '#C6FF00', gradient_to: '#C6FF00',
      verified_badge_color: '#00F5FF',
    },
  },
  {
    name: 'Hyper Pink',
    colors: {
      primary_color: '#FF00A8', secondary_color: '#C6FF00', accent_color: '#FFF500',
      background_color: '#FF4D00', text_color: '#FFFFFF', button_color: '#C6FF00',
      button_text_color: '#09000F', gradient_from: '#FF00A8', gradient_to: '#FF00A8',
      verified_badge_color: '#00F5FF',
    },
  },
  {
    name: 'Electric Blue',
    colors: {
      primary_color: '#0047FF', secondary_color: '#C6FF00', accent_color: '#00F5FF',
      background_color: '#FF4D00', text_color: '#FFFFFF', button_color: '#C6FF00',
      button_text_color: '#09000F', gradient_from: '#0047FF', gradient_to: '#0047FF',
      verified_badge_color: '#00F5FF',
    },
  },
];

@Component({
  selector: 'app-admin-theme',
  standalone: true,
  imports: [CommonModule, FormsModule, AnimatedButtonComponent, LoadingScreenComponent],
  templateUrl: './admin-theme.component.html',
  styleUrl: './admin-theme.component.scss',
})
export class AdminThemeComponent implements OnInit {
  private themeService = inject(ThemeService);

  presets = BRAND_PRESETS;
  draft: ThemeSettings | null = null;
  savedCopy: ThemeSettings | null = null;
  loading = signal(true);
  saving = signal(false);
  saved = signal(false);
  saveError = signal('');

  colorFields: Array<{
    key: 'primary_color' | 'secondary_color' | 'accent_color' | 'background_color' | 'text_color'
      | 'button_color' | 'button_text_color' | 'gradient_from' | 'gradient_to' | 'verified_badge_color';
    label: string;
  }> = [
    { key: 'primary_color', label: 'Primary' },
    { key: 'secondary_color', label: 'Secondary' },
    { key: 'accent_color', label: 'Accent' },
    { key: 'background_color', label: 'Background' },
    { key: 'text_color', label: 'Text' },
    { key: 'button_color', label: 'Button' },
    { key: 'button_text_color', label: 'Button Text' },
    { key: 'gradient_from', label: 'Gradient From' },
    { key: 'gradient_to', label: 'Gradient To' },
    { key: 'verified_badge_color', label: 'Verified Badge' },
  ];

  ngOnInit(): void {
    this.themeService.loadTheme()
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (res) {
          this.savedCopy = cloneTheme(res);
          this.draft = cloneTheme(res);
        }
        this.loading.set(false);
      });
  }

  currentName(): string {
    return this.savedCopy?.name || 'Custom';
  }

  previewName(): string {
    return this.draft?.name || this.matchingPresetName(this.draft) || 'Custom';
  }

  isDirty(): boolean {
    return !themesMatch(this.draft, this.savedCopy);
  }

  isActivePreset(preset: (typeof BRAND_PRESETS)[number]): boolean {
    return this.savedCopy?.name === preset.name || themesMatch(this.savedCopy, preset.colors);
  }

  isPreviewPreset(preset: (typeof BRAND_PRESETS)[number]): boolean {
    return this.draft?.name === preset.name || themesMatch(this.draft, preset.colors);
  }

  matchingPresetName(theme: Partial<ThemeSettings> | null): string {
    if (!theme) return '';
    return this.presets.find((preset) => preset.name === theme.name || themesMatch(theme, preset.colors))?.name || '';
  }

  onColorChange(): void {
    if (!this.draft) return;
    const match = this.matchingPresetName(this.draft);
    this.draft.name = match || 'Custom';
    this.saved.set(false);
    this.saveError.set('');
    this.themeService.previewTheme(this.draft);
  }

  applyPreset(preset: (typeof BRAND_PRESETS)[number]): void {
    if (!this.draft) return;
    this.draft = { ...this.draft, ...preset.colors, name: preset.name };
    this.saved.set(false);
    this.saveError.set('');
    this.themeService.previewTheme(this.draft);
  }

  resetPreview(): void {
    if (!this.savedCopy) return;
    this.draft = cloneTheme(this.savedCopy);
    this.saveError.set('');
    this.themeService.resetToSaved();
  }

  save(): void {
    if (!this.draft) return;
    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set('');
    this.themeService.updateTheme(this.draft).subscribe({
      next: (updated) => {
        this.savedCopy = cloneTheme(updated);
        this.draft = cloneTheme(updated);
        this.saving.set(false);
        this.saved.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.saveError.set(this.readError(err));
      },
    });
  }

  private readError(err: HttpErrorResponse): string {
    const body = err.error;
    if (typeof body === 'string' && body.trim()) return body;
    if (body?.error) return String(body.error);
    if (body?.message) return String(body.message);
    if (err.status === 0) return 'Cannot reach the API. Is the backend running?';
    if (err.status === 401 || err.status === 403) return 'You need to be logged in as admin to save the theme.';
    return `Save failed (${err.status || 'network error'}).`;
  }
}
