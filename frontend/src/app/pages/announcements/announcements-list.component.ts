import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AnnouncementService } from '../../core/services/announcement.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Announcement } from '../../core/models';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-announcements-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AnimatedButtonComponent, LoadingScreenComponent],
  templateUrl: './announcements-list.component.html',
  styleUrl: './announcements-list.component.scss',
})
export class AnnouncementsListComponent implements OnInit {
  private announcementService = inject(AnnouncementService);
  auth = inject(AuthService);
  api = inject(ApiService);

  announcements = signal<Announcement[]>([]);
  loading = signal(true);
  filterType = '';
  filterLocation = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.announcementService
      .list({ type: this.filterType, location: this.filterLocation, limit: 30 })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 30, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        this.announcements.set(res.data);
        this.loading.set(false);
      });
  }
}
