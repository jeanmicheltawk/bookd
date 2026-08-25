import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';

import { SubscriptionPayment } from '../../core/models';
import { AdminPaymentService } from '../../core/services/admin-payment.service';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

type PaymentFilter = 'open' | 'awaiting' | 'pending' | 'confirmed' | 'rejected' | 'all';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, LoadingScreenComponent],
  templateUrl: './admin-payments.component.html',
  styleUrl: './admin-payments.component.scss',
})
export class AdminPaymentsComponent implements OnInit {
  private api = inject(AdminPaymentService);

  rows = signal<SubscriptionPayment[]>([]);
  loading = signal(true);
  savingId = signal<string | null>(null);
  listError = signal('');
  statusFilter = signal<PaymentFilter>('open');
  copiedId = signal<string | null>(null);
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  filters: Array<{ id: PaymentFilter; label: string }> = [
    { id: 'open', label: 'to review' },
    { id: 'awaiting', label: 'reference issued' },
    { id: 'pending', label: 'member marked sent' },
    { id: 'confirmed', label: 'confirmed' },
    { id: 'rejected', label: 'rejected' },
    { id: 'all', label: 'all' },
  ];

  ngOnInit(): void {
    this.load();
  }

  filterBy(filter: PaymentFilter): void {
    this.statusFilter.set(filter);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.listError.set('');
    this.api
      .list({
        status: this.statusFilter(),
        limit: 80,
      })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 80, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        this.rows.set(res.data);
        this.loading.set(false);
      });
  }

  confirm(row: SubscriptionPayment): void {
    if (row.status !== 'pending' && row.status !== 'awaiting') return;
    const from = row.sender_whish_number || 'Whish (match by reference)';
    if (!window.confirm(`Confirm ${row.plan_label} payment of ${row.amount} ${row.currency} from ${from}? This extends their plan by 1 month.`)) return;
    this.savingId.set(row.id);
    this.listError.set('');
    this.api.confirm(row.id).subscribe({
      next: (updated) => {
        this.afterReview(updated);
      },
      error: (err) => {
        this.savingId.set(null);
        this.listError.set(err?.error?.error || 'Could not confirm this payment.');
      },
    });
  }

  reject(row: SubscriptionPayment): void {
    if (row.status !== 'pending' && row.status !== 'awaiting') return;
    if (!window.confirm(`Mark this ${row.plan_label} payment as not found? The member can submit again.`)) return;
    this.savingId.set(row.id);
    this.listError.set('');
    this.api.reject(row.id).subscribe({
      next: (updated) => {
        this.afterReview(updated);
      },
      error: (err) => {
        this.savingId.set(null);
        this.listError.set(err?.error?.error || 'Could not reject this payment.');
      },
    });
  }

  private afterReview(updated: SubscriptionPayment): void {
    this.savingId.set(null);
    const filter = this.statusFilter();
    if (filter === 'open' || filter === 'pending' || filter === 'awaiting') {
      this.rows.update((list) => list.filter((item) => item.id !== updated.id));
      return;
    }
    this.rows.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
  }

  statusLabel(status: string): string {
    if (status === 'awaiting') return 'reference issued';
    if (status === 'pending') return 'member marked sent';
    return status;
  }

  displayName(row: SubscriptionPayment): string {
    return row.professional_name || row.full_name || row.email || 'Member';
  }

  async copyReference(row: SubscriptionPayment): Promise<void> {
    if (!row.reference) return;
    try {
      await navigator.clipboard.writeText(row.reference);
      this.copiedId.set(row.id);
      if (this.copiedTimer) clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => {
        if (this.copiedId() === row.id) this.copiedId.set(null);
      }, 1600);
    } catch {
      this.listError.set('Could not copy the reference. Select it and copy manually.');
    }
  }
}
