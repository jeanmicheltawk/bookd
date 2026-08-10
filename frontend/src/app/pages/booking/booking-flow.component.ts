import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ProfileService } from '../../core/services/profile.service';
import { BookingService } from '../../core/services/booking.service';
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
  api = inject(ApiService);

  profile = signal<Profile | null>(null);
  loading = signal(true);
  notFound = signal(false);

  step = signal(1);
  totalSteps = 3;

  form = {
    projectType: '',
    projectDate: '',
    location: '',
    description: '',
    budget: null as number | null,
    moodboardUrl: '',
    moodboardUrls: [] as string[],
  };

  submitting = signal(false);
  error = signal('');
  success = signal(false);

  ngOnInit(): void {
    const profileId = this.route.snapshot.paramMap.get('profileId')!;
    this.profileService.getPublic(profileId)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (!res) this.notFound.set(true);
        this.profile.set(res);
        this.loading.set(false);
      });
  }

  addMoodboardUrl(): void {
    const url = this.form.moodboardUrl.trim();
    if (url) {
      this.form.moodboardUrls.push(url);
      this.form.moodboardUrl = '';
    }
  }

  removeMoodboardUrl(url: string): void {
    this.form.moodboardUrls = this.form.moodboardUrls.filter((u) => u !== url);
  }

  nextStep(): void {
    if (this.step() < this.totalSteps) this.step.update((s) => s + 1);
  }

  prevStep(): void {
    if (this.step() > 1) this.step.update((s) => s - 1);
  }

  canProceedFromStep1(): boolean {
    return !!this.form.projectType.trim();
  }

  submit(): void {
    const p = this.profile();
    if (!p) return;

    this.submitting.set(true);
    this.error.set('');

    this.bookingService.create({
      creativeId: p.id,
      projectType: this.form.projectType,
      projectDate: this.form.projectDate || undefined,
      location: this.form.location || undefined,
      description: this.form.description || undefined,
      moodboardUrls: this.form.moodboardUrls.length ? this.form.moodboardUrls : undefined,
      budget: this.form.budget ?? undefined,
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
