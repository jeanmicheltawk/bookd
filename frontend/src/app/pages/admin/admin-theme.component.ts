import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { ThemeService } from '../../core/services/theme.service';
import { ThemeSettings } from '../../core/models';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

const BRAND_PRESETS: Array<{ name: string; colors: Partial<ThemeSettings> }> = [
  {
    name: 'Acid Neon (Default)',
    colors: {
      primary_color: '#C6FF00', secondary_color: '#FF00A8', accent_color: '#00F5FF',
      background_color: '#09000F', text_color: '#FFFFFF', button_color: '#C6FF00',
      button_text_color: '#09000F', gradient_from: '#FF00A8', gradient_to: '#0047FF',
      verified_badge_color: '#00F5FF',
    },
  },
  {
    name: 'Toxic Sunset',
    colors: {
      primary_color: '#FF4D00', secondary_color: '#FFF500', accent_color: '#FF00A8',
      background_color: '#09000F', text_color: '#FFFFFF', button_color: '#FF4D00',
      button_text_color: '#09000F', gradient_from: '#FF4D00', gradient_to: '#8F00FF',
      verified_badge_color: '#FFF500',
    },
  },
  {
    name: 'Ultraviolet',
    colors: {
      primary_color: '#8F00FF', secondary_color: '#00F5FF', accent_color: '#C6FF00',
      background_color: '#09000F', text_color: '#FFFFFF', button_color: '#8F00FF',
      button_text_color: '#FFFFFF', gradient_from: '#8F00FF', gradient_to: '#FF00A8',
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
  theme = signal<ThemeSettings | null>(null);
  loading = signal(true);
  saving = signal(false);
  saved = signal(false);

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
        this.theme.set(res);
        this.loading.set(false);
      });
  }

  onColorChange(): void {
    const t = this.theme();
    if (t) this.themeService.previewTheme(t);
  }

  applyPreset(preset: (typeof BRAND_PRESETS)[number]): void {
    const t = this.theme();
    if (!t) return;
    const merged = { ...t, ...preset.colors } as ThemeSettings;
    this.theme.set(merged);
    this.themeService.previewTheme(merged);
  }

  resetPreview(): void {
    this.themeService.resetToSaved();
  }

  save(): void {
    const t = this.theme();
    if (!t) return;
    this.saving.set(true);
    this.saved.set(false);
    this.themeService.updateTheme(t).subscribe({
      next: (updated) => {
        this.theme.set(updated);
        this.saving.set(false);
        this.saved.set(true);
      },
      error: () => this.saving.set(false),
    });
  }
}
