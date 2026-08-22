import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { BookingService } from '../../core/services/booking.service';
import { Booking } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

type AdminBookingTab = 'all' | 'pending' | 'booked' | 'done' | 'declined';

@Component({
  selector: 'app-admin-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingScreenComponent],
  templateUrl: './admin-bookings.component.html',
  styleUrl: './admin-bookings.component.scss',
})
export class AdminBookingsComponent implements OnInit {
  private bookingsApi = inject(BookingService);

  bookings = signal<Booking[]>([]);
  loading = signal(true);
  search = '';
  activeTab = signal<AdminBookingTab>('all');
  counts = signal({ total: 0, pending: 0, booked: 0, done: 0, declined: 0 });

  tabs: Array<{ id: AdminBookingTab; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'booked', label: 'Booked' },
    { id: 'done', label: 'Done' },
    { id: 'declined', label: 'Declined' },
  ];

  ngOnInit(): void {
    this.load();
  }

  tabCount(id: AdminBookingTab): number {
    const c = this.counts();
    if (id === 'all') return c.total;
    return c[id] || 0;
  }

  filterBy(tab: AdminBookingTab): void {
    this.activeTab.set(tab);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const status = this.activeTab() === 'all' ? undefined : this.activeTab();
    this.bookingsApi
      .listAdmin({ status, q: this.search.trim() || undefined, limit: 100 })
      .pipe(
        catchError(() =>
          of({
            data: [],
            pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
            counts: { total: 0, pending: 0, booked: 0, done: 0, declined: 0 },
          }),
        ),
      )
      .subscribe((res) => {
        this.bookings.set(res.data);
        this.counts.set(res.counts);
        this.loading.set(false);
      });
  }

  name(full?: string | null, pro?: string | null): string {
    return pro || full || '—';
  }

  statusLabel(status: string): string {
    if (status === 'cancelled') return 'declined';
    if (status === 'in_progress') return 'in progress';
    if (status === 'reviewed') return 'done';
    if (status === 'completed') return 'done';
    if (['accepted', 'negotiating'].includes(status)) return 'booked';
    return status;
  }

  formatTime(value?: string | null): string {
    if (!value) return '—';
    const match = String(value).match(/^(\d{1,2}):(\d{2})/);
    if (!match) return String(value);
    const hour = Number(match[1]);
    const minute = match[2];
    const suffix = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${minute} ${suffix}`;
  }

  formatHours(value?: number | string | null): string {
    const hours = Number(value);
    if (!hours) return '—';
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
}
