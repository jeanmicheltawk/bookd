import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { BookingService } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Booking, BookingStatus } from '../../core/models';
import { DashboardNavComponent } from './dashboard-nav.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';

type FilterTab = 'all' | 'pending' | 'active' | 'completed';

@Component({
  selector: 'app-dashboard-bookings',
  standalone: true,
  imports: [CommonModule, RouterLink, DashboardNavComponent, LoadingScreenComponent, AnimatedButtonComponent],
  templateUrl: './dashboard-bookings.component.html',
  styleUrl: './dashboard-bookings.component.scss',
})
export class DashboardBookingsComponent implements OnInit {
  private bookingService = inject(BookingService);
  auth = inject(AuthService);
  api = inject(ApiService);

  bookings = signal<Booking[]>([]);
  loading = signal(true);
  activeTab = signal<FilterTab>('all');
  actioningId = signal<string | null>(null);

  filtered(): Booking[] {
    const tab = this.activeTab();
    const all = this.bookings();
    if (tab === 'all') return all;
    if (tab === 'pending') return all.filter((b) => b.status === 'pending');
    if (tab === 'active') return all.filter((b) => ['accepted', 'negotiating', 'in_progress'].includes(b.status));
    return all.filter((b) => ['completed', 'reviewed'].includes(b.status));
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.bookingService.listMine({ limit: 50 })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        this.bookings.set(res.data);
        this.loading.set(false);
      });
  }

  isCreative(booking: Booking): boolean {
    return booking.creative_id === this.auth.user()?.id;
  }

  accept(booking: Booking): void {
    this.actioningId.set(booking.id);
    this.bookingService.accept(booking.id).subscribe({
      next: (updated) => this.patchBooking(updated),
      complete: () => this.actioningId.set(null),
    });
  }

  decline(booking: Booking): void {
    this.actioningId.set(booking.id);
    this.bookingService.decline(booking.id).subscribe({
      next: (updated) => this.patchBooking(updated),
      complete: () => this.actioningId.set(null),
    });
  }

  markStatus(booking: Booking, status: BookingStatus): void {
    this.actioningId.set(booking.id);
    this.bookingService.updateStatus(booking.id, status).subscribe({
      next: (updated) => this.patchBooking(updated),
      complete: () => this.actioningId.set(null),
    });
  }

  private patchBooking(updated: Booking): void {
    this.bookings.update((list) => list.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
  }
}
