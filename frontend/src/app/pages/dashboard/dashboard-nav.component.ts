import { Component, OnInit, inject } from '@angular/core';
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
    @if (alerts.alerts(); as a) {
      <div class="dash-notices">
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
      &:hover { transform: translateY(-1px); }
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

  ngOnInit(): void {
    this.alerts.refresh();
  }

  get items(): DashNavItem[] {
    const a = this.alerts.alerts();
    if (this.auth.isBrand()) {
      return [
        { label: 'Overview', path: '/dashboard', exact: true },
        { label: 'History', path: '/dashboard/bookings', badge: a.bookingUpdates },
        { label: 'Messages', path: '/dashboard/messages', badge: a.unreadMessages },
        { label: 'Settings', path: '/dashboard/settings' },
      ];
    }

    return [
      { label: 'Overview', path: '/dashboard', exact: true },
      { label: 'Bookings', path: '/dashboard/bookings', badge: a.newBookings },
      { label: 'Messages', path: '/dashboard/messages', badge: a.unreadMessages },
      { label: 'Notifications', path: '/dashboard/notifications' },
      { label: 'Portfolio', path: '/dashboard/portfolio' },
      { label: 'Settings', path: '/dashboard/settings' },
    ];
  }
}
