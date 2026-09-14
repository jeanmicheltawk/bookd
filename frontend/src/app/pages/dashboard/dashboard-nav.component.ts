import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';

interface DashNavItem {
  label: string;
  path: string;
  exact?: boolean;
  badge?: number;
}

@Component({
  selector: 'app-dashboard-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    @if (!spamHintDismissed() || !auth.isPending()) {
      <div class="dash-notices">
        @if (!spamHintDismissed()) {
          <div class="dash-notice dash-notice--spam">
            <p>Emails from {{ mailFrom }} can land in spam. Check junk/spam for messages, bookings, and approvals — then mark as not spam.</p>
            <button type="button" (click)="dismissSpamHint()">Got it</button>
          </div>
        }
        @if (!auth.isPending() && alerts.alerts(); as a) {
          @if (a.unreadMessages) {
            <a class="dash-notice dash-notice--message" routerLink="/dashboard/messages">
              You have {{ a.unreadMessages }} unread message{{ a.unreadMessages === 1 ? '' : 's' }}.
            </a>
          }
          @if (!auth.isBrand() && a.newBookings) {
            <a class="dash-notice dash-notice--booking" routerLink="/dashboard/bookings">
              You have {{ a.newBookings }} new booking request{{ a.newBookings === 1 ? '' : 's' }}.
            </a>
          }
          @if (auth.isBrand() && a.bookingUpdates) {
            <a class="dash-notice dash-notice--booking" routerLink="/dashboard/bookings">
              You have {{ a.bookingUpdates }} booking update{{ a.bookingUpdates === 1 ? '' : 's' }} — approved or declined.
            </a>
          }
          @if (!auth.isBrand() && (a.subscription?.status === 'ending_soon' || a.subscription?.status === 'expired')) {
            <a class="dash-notice dash-notice--pay" routerLink="/dashboard/pay">
              {{ a.subscription?.status === 'expired' ? 'Your plan has ended. Pay with Whish to stay public.' : 'Time to pay your subscription with Whish.' }}
            </a>
          }
        }
      </div>
    }

    <nav class="dash-nav">
      @for (item of items; track item.path) {
        <a
          [routerLink]="item.path"
          [routerLinkActiveOptions]="{ exact: !!item.exact }"
          routerLinkActive="active"
        >
          {{ item.label }}
          @if (item.badge) {
            <span class="nav-badge">{{ item.badge }}</span>
          }
        </a>
      }
    </nav>
  `,
  styles: [`
    .dash-notices {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 20px;
    }

    .dash-notice {
      display: block;
      padding: 14px 18px;
      font-weight: 800;
      font-size: 0.82rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-black);
      &--message { background: var(--acid-lime); }
      &--booking { background: var(--nuclear-yellow); }
      &--pay { background: var(--hyper-pink); color: #fff; }
      &:hover { transform: translateY(-1px); }
      &--spam {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        background: var(--ink-black);
        color: #fff;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: none;
        &:hover { transform: none; }
        p { margin: 0; max-width: 52rem; }
        button {
          flex-shrink: 0;
          padding: 8px 14px;
          border: 1px solid #fff;
          background: transparent;
          color: #fff;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
        }
      }
    }

    .dash-nav {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 8px;
      margin-bottom: 32px;
      border-bottom: 1px solid var(--surface-border);
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }

      a {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        font-weight: 700;
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--text);
        position: relative;

        &:hover { color: var(--acid-lime); }
        &.active {
          color: var(--acid-lime);
          &::after {
            content: '';
            position: absolute;
            left: 12px; right: 12px; bottom: -9px;
            height: 3px;
            background: var(--acid-lime);
          }
        }
      }
    }

    .nav-badge {
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--hyper-pink);
      color: #fff;
      font-size: 0.7rem;
      font-weight: 800;
    }
  `],
})
export class DashboardNavComponent implements OnInit {
  auth = inject(AuthService);
  alerts = inject(AlertService);
  readonly mailFrom = 'info@bookdhaus.com';

  private readonly spamHintKey = 'bookd-mail-spam-hint-dismissed';
  spamHintDismissed = signal(typeof localStorage !== 'undefined' && localStorage.getItem(this.spamHintKey) === '1');

  ngOnInit(): void {
    if (!this.auth.isPending()) this.alerts.refresh();
  }

  dismissSpamHint(): void {
    localStorage.setItem(this.spamHintKey, '1');
    this.spamHintDismissed.set(true);
  }

  get items(): DashNavItem[] {
    const complimentary = this.auth.isComplimentary();

    if (this.auth.isPending()) {
      const pending: DashNavItem[] = [
        { label: 'Status', path: '/dashboard', exact: true },
      ];
      if (!complimentary) pending.push({ label: 'Pay', path: '/dashboard/pay' });
      pending.push({ label: 'Profile', path: '/dashboard/settings' });
      return pending;
    }

    const a = this.alerts.alerts();
    if (this.auth.isBrand()) {
      return [
        { label: 'Overview', path: '/dashboard', exact: true },
        { label: 'History', path: '/dashboard/bookings', badge: a.bookingUpdates },
        { label: 'Messages', path: '/dashboard/messages', badge: a.unreadMessages },
        { label: 'Profile', path: '/dashboard/settings' },
      ];
    }

    const items: DashNavItem[] = [
      { label: 'Overview', path: '/dashboard', exact: true },
      { label: 'Bookings', path: '/dashboard/bookings', badge: a.newBookings },
      { label: 'Messages', path: '/dashboard/messages', badge: a.unreadMessages },
      { label: 'Notifications', path: '/dashboard/notifications', badge: a.unreadNotifications },
      { label: 'Portfolio', path: '/dashboard/portfolio' },
      { label: 'Announcements', path: '/dashboard/announcements' },
    ];
    if (!complimentary) {
      const sub = a.subscription;
      const payDue = !!sub?.payment_due || sub?.status === 'ending_soon' || sub?.status === 'expired';
      if (payDue) {
        items.push({
          label: 'Pay',
          path: '/dashboard/pay',
          badge: (sub?.status === 'ending_soon' || sub?.status === 'expired') ? 1 : 0,
        });
      }
    }
    items.push({ label: 'Profile', path: '/dashboard/settings' });
    return items;
  }
}
