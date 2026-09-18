import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';

import { AnnouncementService } from '../../core/services/announcement.service';
import { CategoryService } from '../../core/services/category.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Announcement, AnnouncementApplication, Category } from '../../core/models';
import { RouterLink } from '@angular/router';
import { DashboardNavComponent } from './dashboard-nav.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { SelectComponent, SelectOption, selectOptions } from '../../shared/components/select/select.component';

@Component({
  selector: 'app-dashboard-announcements',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DashboardNavComponent, LoadingScreenComponent, AnimatedButtonComponent, SelectComponent],
  templateUrl: './dashboard-announcements.component.html',
  styleUrl: './dashboard-announcements.component.scss',
})
export class DashboardAnnouncementsComponent implements OnInit {
  private announcementService = inject(AnnouncementService);
  private categoryService = inject(CategoryService);
  auth = inject(AuthService);
  api = inject(ApiService);

  canPublish = computed(() => this.auth.isAdmin() || this.auth.isPremium());

  announcements = signal<Announcement[]>([]);
  applicants = signal<Record<string, AnnouncementApplication[]>>({});
  incoming = signal<AnnouncementApplication[]>([]);
  categories = signal<Category[]>([]);
  loading = signal(true);
  tab = signal<'all' | 'posts'>('all');
  showForm = signal(false);
  showUpgradePopup = signal(false);
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
    contactEmail: '',
    contactPhone: '',
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
    forkJoin({
      posts: this.announcementService.listMine().pipe(catchError(() => of({ data: [] as Announcement[] }))),
      incoming: this.announcementService.listIncomingApplications().pipe(catchError(() => of({ data: [] as AnnouncementApplication[] }))),
    }).subscribe(({ posts, incoming }) => {
      this.announcements.set(posts.data);
      this.incoming.set(incoming.data);
      this.loading.set(false);
      for (const a of posts.data) {
        if ((a.application_count || 0) > 0) this.loadApplicants(a.id);
      }
    });
  }

  setTab(tab: 'all' | 'posts'): void {
    this.tab.set(tab);
  }

  applicantsFor(id: string): AnnouncementApplication[] {
    return this.applicants()[id] || [];
  }

  applicantName(app: AnnouncementApplication): string {
    return app.professional_name || app.full_name || app.applicant_email || 'Applicant';
  }

  profileLink(app: AnnouncementApplication): string | null {
    return app.custom_url || app.profile_id || null;
  }

  loadApplicants(id: string): void {
    this.announcementService.listApplications(id)
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((res) => {
        this.applicants.update((map) => ({ ...map, [id]: res.data }));
      });
  }

  @HostListener('document:keydown.escape')
  closeUpgradePopup(): void {
    this.showUpgradePopup.set(false);
  }

  submit(ngForm: NgForm): void {
    if (!this.canPublish()) {
      this.showUpgradePopup.set(true);
      return;
    }
    if (ngForm.invalid) return;
    this.submitting.set(true);
    this.formError.set('');

    this.announcementService.create(this.form).subscribe({
      next: (created) => {
        this.announcements.update((list) => [created, ...list]);
        this.submitting.set(false);
        this.showForm.set(false);
        ngForm.resetForm({ isPaid: true, peopleNeeded: 1, contactEmail: '', contactPhone: '' });
      },
      error: (err) => {
        this.submitting.set(false);
        if (err?.status === 403) {
          this.showUpgradePopup.set(true);
          return;
        }
        this.formError.set(err?.error?.error || 'Could not post announcement.');
      },
    });
  }
}
