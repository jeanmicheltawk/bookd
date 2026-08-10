import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { Country } from '../../core/models';
import { CountryService } from '../../core/services/country.service';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-admin-countries',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingScreenComponent],
  templateUrl: './admin-countries.component.html',
  styleUrl: './admin-countries.component.scss',
})
export class AdminCountriesComponent implements OnInit {
  private countriesApi = inject(CountryService);

  countries = signal<Country[]>([]);
  loading = signal(true);
  saving = signal(false);
  error = signal('');

  newCountry = { name: '', slug: '' };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.countriesApi
      .list()
      .pipe(catchError(() => of({ data: [] as Country[] })))
      .subscribe((res) => {
        this.countries.set(res.data);
        this.loading.set(false);
      });
  }

  createCountry(): void {
    if (!this.newCountry.name.trim()) {
      this.error.set('Country name is required.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.countriesApi
      .create({
        name: this.newCountry.name.trim(),
        slug: this.newCountry.slug.trim() || undefined,
      })
      .subscribe({
        next: (created) => {
          this.newCountry = { name: '', slug: '' };
          this.saving.set(false);
          this.countries.update((list) =>
            [...list, created].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
          );
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.error || 'Could not create country.');
        },
      });
  }

  deleteCountry(country: Country): void {
    if (!confirm(`Delete country "${country.name}"? This cannot be undone.`)) return;
    this.saving.set(true);
    this.error.set('');
    this.countriesApi.delete(country.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.countries.update((list) => list.filter((c) => c.id !== country.id));
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error || 'Could not delete country.');
      },
    });
  }
}
