import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { WhishPaymentInstructions } from '../../core/models';
import { formatSubDate, membershipLabel, subscriptionStatusLabel } from '../../core/utils/subscription';
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

  get upgradeOffer() {
    const offer = this.info()?.upgrade;
    return offer?.available ? offer : null;
  }

  get canUpgrade(): boolean {
    if (this.auth.isComplimentary() || this.auth.isPremium()) return false;
    return this.auth.user()?.role === 'member' && this.auth.user()?.membership === 'basic';
  }

  get isUpgradePayment(): boolean {
    const purpose = this.payment?.purpose || '';
    return purpose === 'upgrade_topup' || purpose === 'upgrade_full';
  }

  get upgradePayment() {
    return this.upgradeOffer?.payment || (this.isUpgradePayment ? this.payment : null);
  }

  get upgradeInProgress(): boolean {
    const payment = this.upgradePayment;
    return !!payment && (payment.status === 'awaiting' || payment.status === 'pending');
  }

  get isPendingReview(): boolean {
    const payment = this.upgradeInProgress ? this.upgradePayment : this.payment;
    return payment?.status === 'pending' && payment?.collect_status !== 'success';
  }

  get isPaymentConfirmed(): boolean {
    return this.payment?.status === 'confirmed' && !this.isUpgradePayment;
  }

  get isPaymentDue(): boolean {
    if (this.upgradeInProgress) return false;
    if (this.auth.isPending()) return !this.isPaymentConfirmed;
    if (this.info()?.payment_due != null) return !!this.info()?.payment_due;
    return !this.isPaymentConfirmed;
  }

  get paidUntil(): string | null {
    return this.info()?.paid_until || this.auth.user()?.subscription?.ends_at || this.auth.user()?.membership_ends_at || null;
  }

  get canCheckout(): boolean {
    return this.isPaymentDue && !this.isPaymentConfirmed && !this.upgradeInProgress && !!this.info();
  }

  get planName(): string {
    return this.info()?.plan_label || membershipLabel(this.auth.user()?.membership) || 'plan';
  }

  get subStatus(): string {
    return subscriptionStatusLabel(this.auth.user()?.subscription?.status);
  }

  get startedAt(): string | null {
    return this.info()?.started_at || this.auth.user()?.subscription?.started_at || this.auth.user()?.membership_started_at || null;
  }

  get trialEndsAt(): string | null {
    return this.info()?.trial_ends_at || this.auth.user()?.subscription?.trial_ends_at || this.auth.user()?.membership_trial_ends_at || null;
  }

  get daysLeft(): number | null {
    if (this.upgradeOffer?.days_remaining != null) return this.upgradeOffer.days_remaining;
    const fromSub = this.auth.user()?.subscription?.days_remaining;
    if (fromSub != null) return fromSub;
    if (!this.paidUntil) return null;
    return Math.max(0, Math.ceil((new Date(this.paidUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  get isTopupUpgrade(): boolean {
    if (this.upgradeOffer) return this.upgradeOffer.kind === 'topup';
    if (this.auth.isPending()) return this.isPaymentConfirmed;
    const days = this.daysLeft;
    return days != null && days > 0 && days < 7;
  }

  get currentPlanAmount(): number {
    return this.info()?.amount ?? (this.auth.user()?.membership === 'premium' ? 14.99 : 6.99);
  }

  get upgradeAmount(): number {
    return this.upgradeOffer?.amount ?? (this.isTopupUpgrade ? 8 : 14.99);
  }

  get upgradeCutoffAt(): string | null {
    if (this.upgradeOffer?.upgrade_cutoff_at) return this.upgradeOffer.upgrade_cutoff_at;
    if (!this.paidUntil) return null;
    const cutoff = new Date(this.paidUntil);
    cutoff.setDate(cutoff.getDate() - 7);
    return cutoff.toISOString();
  }

  get starterRenewalOpensAt(): string | null {
    if (!this.paidUntil) return null;
    const opens = new Date(this.paidUntil);
    opens.setDate(opens.getDate() - 5);
    return opens.toISOString();
  }

  get nextPaidUntilAfterUpgrade(): string | null {
    if (this.upgradeOffer?.next_paid_until) return this.upgradeOffer.next_paid_until;
    if (this.auth.isPending()) return null;
    if (this.isTopupUpgrade) return this.paidUntil;
    const oneMonth = new Date();
    oneMonth.setMonth(oneMonth.getMonth() + 1);
    const current = this.paidUntil ? new Date(this.paidUntil) : null;
    if (current && current.getTime() > oneMonth.getTime()) return current.toISOString();
    return oneMonth.toISOString();
  }

  get premiumRenewalOpensAt(): string | null {
    if (this.upgradeOffer?.renewal_opens_at) return this.upgradeOffer.renewal_opens_at;
    const end = this.nextPaidUntilAfterUpgrade;
    if (!end) return null;
    const opens = new Date(end);
    opens.setDate(opens.getDate() - 5);
    return opens.toISOString();
  }

  formatDate(value?: string | null): string {
    return formatSubDate(value);
  }

  private applyInfo(res: WhishPaymentInstructions | null, confirmedMessage?: string): void {
    this.info.set(res);
    if (confirmedMessage && (res?.payment?.status === 'confirmed' || res?.upgrade?.payment?.status === 'confirmed')) {
      this.success.set(confirmedMessage);
      this.auth.me().subscribe();
    }
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
        this.applyInfo(res, afterReturn ? 'Whish confirmed your payment.' : undefined);
        this.loading.set(false);
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
        if (res?.payment?.status === 'confirmed' || res?.upgrade?.payment?.status === 'confirmed') {
          this.success.set('Whish confirmed your payment.');
          this.auth.me().subscribe();
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
        if (err?.error?.upgrade || err?.error?.payment) {
          this.info.update((current) => current ? { ...current, ...err.error } : current);
        }
      },
    });
  }

  startUpgrade(): void {
    if (!this.canUpgrade || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    this.success.set('');
    this.payments.upgrade().subscribe({
      next: (res) => {
        this.info.set(res);
        const url = res.collect_url || res.upgrade?.payment?.collect_url || res.payment?.collect_url;
        if (!url) {
          this.submitting.set(false);
          this.error.set('Whish did not return a payment page. Try again.');
          return;
        }
        window.location.href = url;
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.error || 'Could not start Premium upgrade.');
        if (err?.error?.upgrade || err?.error?.payment) {
          this.info.update((current) => current ? { ...current, ...err.error } : current);
        }
      },
    });
  }

  cancelUpgrade(): void {
    if (!this.upgradeInProgress || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    this.payments.cancelUpgrade().subscribe({
      next: (res) => {
        this.info.set(res);
        this.submitting.set(false);
        this.success.set('Premium upgrade cancelled.');
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.error || 'Could not cancel the upgrade.');
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
        if (res.payment?.status === 'confirmed' || res.upgrade?.payment?.status === 'confirmed') {
          this.success.set('Whish confirmed your payment.');
          this.auth.me().subscribe();
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
