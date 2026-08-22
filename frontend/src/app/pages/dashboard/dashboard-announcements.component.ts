import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { AnnouncementService } from '../../core/services/announcement.service';
import { CategoryService } from '../../core/services/category.service';
import { Announcement, Category } from '../../core/models';
import { DashboardNavComponent } from './dashboard-nav.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { SelectComponent, SelectOption, selectOptions } from '../../shared/components/select/select.component';

@Component({
  selector: 'app-dashboard-announcements',
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardNavComponent, LoadingScreenComponent, AnimatedButtonComponent, SelectComponent],
  templateUrl: './dashboard-announcements.component.html',
  styleUrl: './dashboard-announcements.component.scss',
})
export class DashboardAnnouncementsComponent implements OnInit {
  private announcementService = inject(AnnouncementService);
  private categoryService = inject(CategoryService);

  announcements = signal<Announcement[]>([]);
  categories = signal<Category[]>([]);
  loading = signal(true);
  showForm = signal(false);
  submitting = signal(false);
  formError = signal('');

  categoryOptions = computed<SelectOption[]>(() =>
    selectOptions(this.categories().map((c) => ({ value: c.slug, label: c.name })), 'Any'),
  );

  form = {
    title: '',
    announcementType: '',
    description: '',
    budget: undefined as number | undefined,
    isPaid: true,
    location: '',
    deadline: '',
    requiredCategorySlug: '',
    peopleNeeded: 1,
  };

  ngOnInit(): void {
    this.categoryService.list({ searchable: true }).pipe(catchError(() => of({ data: [] }))).subscribe((res) => this.categories.set(res.data));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.announcementService.listMine()
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((res) => {
        this.announcements.set(res.data);
        this.loading.set(false);
      });
  }

  submit(ngForm: NgForm): void {
    if (ngForm.invalid) return;
    this.submitting.set(true);
    this.formError.set('');

    this.announcementService.create(this.form).subscribe({
      next: (created) => {
        this.announcements.update((list) => [created, ...list]);
        this.submitting.set(false);
        this.showForm.set(false);
        ngForm.resetForm({ isPaid: true, peopleNeeded: 1 });
      },
      error: (err) => {
        this.submitting.set(false);
        this.formError.set(err?.error?.error || 'Could not post announcement.');
      },
    });
  }
}
