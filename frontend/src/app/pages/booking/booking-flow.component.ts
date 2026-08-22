import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ProfileService } from '../../core/services/profile.service';
import { BookingService } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Profile } from '../../core/models';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-booking-flow',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AnimatedButtonComponent, LoadingScreenComponent],
  templateUrl: './booking-flow.component.html',
  styleUrl: './booking-flow.component.scss',
})
export class BookingFlowComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private profileService = inject(ProfileService);
  private bookingService = inject(BookingService);
  private auth = inject(AuthService);
  api = inject(ApiService);

  profile = signal<Profile | null>(null);
  loading = signal(true);
  notFound = signal(false);

  submitting = signal(false);
  error = signal('');
  success = signal(false);

  form = {
    date: '',
    time: '',
    hours: 2,
    location: '',
    details: '',
  };

  minDate = this.todayIso();

  private todayIso(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/auth/signup'], {
        queryParams: { role: 'brand', redirect: this.router.url },
      });
      return;
    }

    const profileId = this.route.snapshot.paramMap.get('profileId')!;
    this.profileService.getPublic(profileId)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (!res) this.notFound.set(true);
        this.profile.set(res);
        this.loading.set(false);
      });
  }

  submit(): void {
    const p = this.profile();
    if (!p) return;

    if (!this.form.date) {
      this.error.set('Date is required.');
      return;
    }
    if (this.form.date < this.minDate) {
      this.error.set('Date must be today or later.');
      return;
    }
    if (!this.form.time) {
      this.error.set('Time is required.');
      return;
    }
    if (!this.form.hours || this.form.hours <= 0) {
      this.error.set('Hours are required.');
      return;
    }
    if (!this.form.location.trim()) {
      this.error.set('Location is required.');
      return;
    }
    if (!this.form.details.trim()) {
      this.error.set('Details are required.');
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    this.bookingService.create({
      creativeId: p.id,
      projectType: 'Booking request',
      projectDate: this.form.date,
      projectTime: this.form.time,
      durationHours: Number(this.form.hours),
      location: this.form.location.trim(),
      description: this.form.details.trim(),
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.error || 'Could not create booking request.');
      },
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard/bookings']);
  }
}
