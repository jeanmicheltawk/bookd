import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AnnouncementService } from '../../core/services/announcement.service';
import { AuthService } from '../../core/services/auth.service';
import { Announcement } from '../../core/models';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-announcement-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AnimatedButtonComponent, LoadingScreenComponent],
  templateUrl: './announcement-detail.component.html',
  styleUrl: './announcement-detail.component.scss',
})
export class AnnouncementDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private announcementService = inject(AnnouncementService);
  auth = inject(AuthService);

  announcement = signal<Announcement | null>(null);
  loading = signal(true);
  notFound = signal(false);

  applying = signal(false);
  applied = signal(false);
  applyMessage = '';
  applyError = signal('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.announcementService.get(id)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (!res) this.notFound.set(true);
        this.announcement.set(res);
        this.loading.set(false);
      });
  }

  submitApplication(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/auth/login'], { queryParams: { redirect: this.router.url } });
      return;
    }
    const ann = this.announcement();
    if (!ann) return;

    this.applying.set(true);
    this.applyError.set('');
    this.announcementService.apply(ann.id, this.applyMessage).subscribe({
      next: () => {
        this.applying.set(false);
        this.applied.set(true);
      },
      error: (err) => {
        this.applying.set(false);
        this.applyError.set(err?.error?.error || 'Could not submit application. Try again.');
      },
    });
  }
}
