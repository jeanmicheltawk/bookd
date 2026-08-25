import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';

import { SubscriptionCancellation } from '../../core/models';
import { AdminCancellationService } from '../../core/services/admin-cancellation.service';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

type RefundFilter = 'all' | 'pending' | 'done';

@Component({
  selector: 'app-admin-cancellations',
  standalone: true,
  imports: [CommonModule, LoadingScreenComponent],
  templateUrl: './admin-cancellations.component.html',
  styleUrl: './admin-cancellations.component.scss',
})
export class AdminCancellationsComponent implements OnInit {
  private api = inject(AdminCancellationService);

  rows = signal<SubscriptionCancellation[]>([]);
  loading = signal(true);
  savingId = signal<string | null>(null);
  listError = signal('');
  refundFilter = signal<RefundFilter>('all');

  filters: Array<{ id: RefundFilter; label: string }> = [
    { id: 'all', label: 'all' },
    { id: 'pending', label: 'refund pending' },
    { id: 'done', label: 'refund done' },
  ];

  ngOnInit(): void {
    this.load();
  }

  filterBy(filter: RefundFilter): void {
    this.refundFilter.set(filter);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.listError.set('');
    const refund = this.refundFilter();
    this.api
      .list({
        refund: refund === 'all' ? undefined : refund,
        limit: 80,
      })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 80, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        this.rows.set(res.data);
        this.loading.set(false);
      });
  }

  setRefund(row: SubscriptionCancellation, refund_done: boolean): void {
    if (row.refund_done === refund_done) return;
    this.savingId.set(row.id);
    this.listError.set('');
    this.api.setRefund(row.id, refund_done).subscribe({
      next: (updated) => {
        this.rows.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
        this.savingId.set(null);
      },
      error: (err) => {
        this.savingId.set(null);
        this.listError.set(err?.error?.error || 'Could not update refund status.');
      },
    });
  }

  displayName(row: SubscriptionCancellation): string {
    return row.professional_name || row.full_name || row.email;
  }
}
