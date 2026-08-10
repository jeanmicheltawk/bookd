import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';

import { AnnouncementService } from '../../core/services/announcement.service';
import { Announcement } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-admin-announcements',
  standalone: true,
  imports: [CommonModule, LoadingScreenComponent],
  templateUrl: './admin-announcements.component.html',
  styleUrl: './admin-announcements.component.scss',
})
export class AdminAnnouncementsComponent implements OnInit {
  private announcementService = inject(AnnouncementService);

  announcements = signal<Announcement[]>([]);
  loading = signal(true);
  activeStatus = signal('pending');
  actioningId = signal<string | null>(null);

  statuses: Announcement['status'][] = ['pending', 'approved', 'rejected', 'closed'];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.announcementService.listAllAdmin({ status: this.activeStatus(), limit: 50 })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        this.announcements.set(res.data);
        this.loading.set(false);
      });
  }

  filterByStatus(status: string): void {
    this.activeStatus.set(status);
    this.load();
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
