import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { WhishPaymentInstructions } from '../../core/models';
import { DashboardNavComponent } from './dashboard-nav.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-dashboard-pay',
  standalone: true,
  imports: [CommonModule, DashboardNavComponent, AnimatedButtonComponent, LoadingScreenComponent],
  templateUrl: './dashboard-pay.component.html',
  styleUrl: './dashboard-pay.component.scss',
})
export class DashboardPayComponent implements OnInit {
  auth = inject(AuthService);
  private payments = inject(PaymentService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  info = signal<WhishPaymentInstructions | null>(null);
  loading = signal(true);
  submitting = signal(false);
  error = signal('');
  success = signal('');

  ngOnInit(): void {
    if (this.auth.isComplimentary()) {
      this.loading.set(false);
      return;
    }
    const result = this.route.snapshot.queryParamMap.get('whish');
    if (result === 'success' || result === 'failed') {
      this.handleReturn(result);
      return;
    }
    this.load();
  }

  get payment() {
    return this.info()?.payment || null;
  }

  get isPendingReview(): boolean {
    return this.payment?.status === 'pending' && this.payment?.collect_status !== 'success';
  }

  get isPaymentConfirmed(): boolean {
    return this.payment?.status === 'confirmed';
  }

  get canCheckout(): boolean {
    return !this.isPaymentConfirmed && !!this.info();
  }

  load(afterReturn = false): void {
    this.loading.set(true);
    this.error.set('');
    this.payments
      .getWhish()
      .pipe(catchError((err) => {
        this.error.set(err?.error?.error || 'Could not load payment details.');
        return of(null);
      }))
      .subscribe((res) => {
        this.info.set(res);
        this.loading.set(false);
        if (afterReturn && res?.payment?.status === 'confirmed') {
          this.success.set('Whish confirmed your payment.');
        }
      });
  }

  handleReturn(result: string): void {
    this.loading.set(true);
    this.payments
      .sync()
      .pipe(catchError((err) => {
        this.error.set(err?.error?.error || 'Could not check your Whish payment yet. Refresh this page in a moment.');
        return of(null);
      }))
      .subscribe((res) => {
        this.info.set(res);
        this.loading.set(false);
        if (res?.payment?.status === 'confirmed') {
          this.success.set('Whish confirmed your payment.');
        } else if (result === 'failed') {
          this.error.set('That attempt did not go through. The payment link is still open — tap Pay with Whish to try again.');
        } else {
          this.success.set('Checking with Whish. If you just paid, this page will update in a moment — tap Refresh status.');
        }
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      });
  }

  checkout(): void {
    if (!this.canCheckout || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    this.success.set('');
    this.payments.checkout().subscribe({
      next: (res) => {
        this.info.set(res);
        const url = res.collect_url || res.payment?.collect_url;
        if (!url) {
          this.submitting.set(false);
          this.error.set('Whish did not return a payment page. Try again.');
          return;
        }
        window.location.href = url;
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.error || 'Could not start Whish checkout.');
        if (err?.error?.payment) {
          this.info.update((current) => current ? { ...current, ...err.error, payment: err.error.payment } : current);
        }
      },
    });
  }

  refreshStatus(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    this.payments.sync().subscribe({
      next: (res) => {
        this.info.set(res);
        this.submitting.set(false);
        if (res.payment?.status === 'confirmed') {
          this.success.set('Whish confirmed your payment.');
        } else {
          this.success.set('Still waiting on Whish. If you already paid, wait a few seconds and refresh again.');
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.error || 'Could not check payment status.');
      },
    });
  }
}
