import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { AnnouncementService } from '../../core/services/announcement.service';
import { Announcement, AnnouncementApplication } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { RouterLink } from '@angular/router';

const EMPTY_FORM = {
  title: '',
  announcementType: '',
  description: '',
  location: '',
  contactEmail: '',
  contactPhone: '',
  budget: undefined as number | undefined,
  isPaid: true,
  deadline: '',
  peopleNeeded: 1,
};

@Component({
  selector: 'app-admin-announcements',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LoadingScreenComponent, AnimatedButtonComponent],
  templateUrl: './admin-announcements.component.html',
  styleUrl: './admin-announcements.component.scss',
})
export class AdminAnnouncementsComponent implements OnInit {
  private announcementService = inject(AnnouncementService);

  announcements = signal<Announcement[]>([]);
  applicants = signal<Record<string, AnnouncementApplication[]>>({});
  incoming = signal<AnnouncementApplication[]>([]);
  loading = signal(true);
  activeTab = signal('pending');
  actioningId = signal<string | null>(null);
  showForm = signal(false);
  saving = signal(false);
  error = signal('');
  form = { ...EMPTY_FORM };

  statuses = ['all', 'pending', 'approved', 'rejected', 'closed'];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    if (this.activeTab() === 'applicants') {
      this.announcementService.listIncomingApplicationsAdmin()
        .pipe(catchError(() => of({ data: [] })))
        .subscribe((res) => {
          this.incoming.set(res.data);
          this.loading.set(false);
        });
      return;
    }
    const status = this.activeTab() === 'all' ? undefined : this.activeTab();
    this.announcementService.listAllAdmin({ status, limit: 50 })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        this.announcements.set(res.data);
        this.loading.set(false);
        this.applicants.set({});
        for (const a of res.data) {
          if ((a.application_count || 0) > 0) this.loadApplicants(a.id);
        }
      });
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

  filterByTab(tab: string): void {
    this.activeTab.set(tab);
    this.load();
  }

  startCreate(): void {
    this.form = { ...EMPTY_FORM, isPaid: true, peopleNeeded: 1 };
    this.error.set('');
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.error.set('');
  }

  submit(ngForm: NgForm): void {
    if (ngForm.invalid) return;
    this.saving.set(true);
    this.error.set('');
    this.announcementService.create({
      title: this.form.title,
      announcementType: this.form.announcementType,
      description: this.form.description,
      location: this.form.location,
      contactEmail: this.form.contactEmail,
      contactPhone: this.form.contactPhone,
      budget: this.form.budget,
      isPaid: this.form.isPaid,
      deadline: this.form.deadline || undefined,
      peopleNeeded: this.form.peopleNeeded,
    }).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.showForm.set(false);
        if (this.activeTab() === created.status || this.activeTab() === 'all') {
          this.announcements.update((list) => [created, ...list]);
        } else {
          this.activeTab.set(created.status);
          this.load();
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error || 'Could not post announcement.');
      },
    });
  }

  moderate(a: Announcement, status: Announcement['status']): void {
    this.actioningId.set(a.id);
    this.announcementService.moderate(a.id, status).subscribe({
      next: () => {
        this.actioningId.set(null);
        this.announcements.update((list) => list.filter((x) => x.id !== a.id));
      },
      error: () => this.actioningId.set(null),
    });
  }
}
