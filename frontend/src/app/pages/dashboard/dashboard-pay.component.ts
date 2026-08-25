import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { WhishPaymentInstructions } from '../../core/models';
import { phoneErrorWhileTyping } from '../../core/utils/contact-validation';
import { DashboardNavComponent } from './dashboard-nav.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-dashboard-pay',
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardNavComponent, AnimatedButtonComponent, LoadingScreenComponent],
  templateUrl: './dashboard-pay.component.html',
  styleUrl: './dashboard-pay.component.scss',
})
export class DashboardPayComponent implements OnInit {
  auth = inject(AuthService);
  private payments = inject(PaymentService);

  info = signal<WhishPaymentInstructions | null>(null);
  loading = signal(true);
  submitting = signal(false);
  copied = signal('');
  error = signal('');
  success = signal('');
  senderNumber = '';
  note = '';
  phoneError = '';

  ngOnInit(): void {
    if (this.auth.isComplimentary()) {
      this.loading.set(false);
      return;
    }
    this.load();
  }

  get payment() {
    return this.info()?.payment || null;
  }

  get isPendingReview(): boolean {
    return this.payment?.status === 'pending';
  }

  get isPaymentConfirmed(): boolean {
    return this.payment?.status === 'confirmed';
  }

  get canSubmit(): boolean {
    return !this.isPendingReview && !this.isPaymentConfirmed && !!this.info();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.payments
      .getWhish()
      .pipe(catchError((err) => {
        this.error.set(err?.error?.error || 'Could not load payment instructions.');
        return of(null);
      }))
      .subscribe((res) => {
        this.info.set(res);
        if (res?.payment?.sender_whish_number) {
          this.senderNumber = res.payment.sender_whish_number;
        } else if (res?.suggested_whish_number && !this.senderNumber) {
          this.senderNumber = res.suggested_whish_number;
        }
        this.loading.set(false);
      });
  }

  onSenderChange(value: string): void {
    this.senderNumber = value;
    this.phoneError = phoneErrorWhileTyping(value) || '';
  }

  async copy(value: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copied.set(key);
      setTimeout(() => {
        if (this.copied() === key) this.copied.set('');
      }, 1600);
    } catch {
      this.error.set('Could not copy. Please copy it manually.');
    }
  }

  submit(): void {
    if (!this.canSubmit || this.submitting()) return;
    const sender = this.senderNumber.trim();
    if (!sender) {
      this.error.set('Enter the Whish number you sent from.');
      return;
    }
    if (this.phoneError) {
      this.error.set(this.phoneError);
      return;
    }

    this.submitting.set(true);
    this.error.set('');
    this.success.set('');
    this.payments.submitWhish({
      sender_whish_number: sender,
      note: this.note.trim() || undefined,
    }).subscribe({
      next: (res) => {
        this.info.set(res);
        this.submitting.set(false);
        this.success.set('Got it. We will confirm the Whish transfer and extend your plan.');
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.error || 'Could not submit your payment.');
        if (err?.error?.payment) {
          this.info.update((current) => current ? { ...current, ...err.error, payment: err.error.payment } : current);
        }
      },
    });
  }
}
