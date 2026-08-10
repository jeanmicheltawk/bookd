import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-dashboard-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="dash-nav">
      <a routerLink="/dashboard" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="active">Overview</a>
      <a routerLink="/dashboard/bookings" routerLinkActive="active">Bookings</a>
      <a routerLink="/dashboard/messages" routerLinkActive="active">Messages</a>
      <a routerLink="/dashboard/notifications" routerLinkActive="active">Notifications</a>
      <a routerLink="/dashboard/portfolio" routerLinkActive="active">Portfolio</a>
      <!-- FUTURE: <a routerLink="/dashboard/announcements" routerLinkActive="active">Announcements</a> -->
      <a routerLink="/dashboard/settings" routerLinkActive="active">Settings</a>
    </nav>
  `,
  styles: [`
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
        padding: 10px 18px;
        border-radius: var(--radius-pill) var(--radius-pill) 0 0;
        font-weight: 700;
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        color: var(--text-muted);
        transition: color var(--dur-fast);
        position: relative;

        &:hover { color: var(--text-primary); }
        &.active {
          color: var(--color-primary);
          &::after {
            content: '';
            position: absolute;
            left: 12px; right: 12px; bottom: -9px;
            height: 3px;
            background: var(--gradient-acid);
            border-radius: var(--radius-pill);
          }
        }
      }
    }
  `],
})
export class DashboardNavComponent {}
