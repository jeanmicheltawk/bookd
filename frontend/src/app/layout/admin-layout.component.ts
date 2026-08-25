import { Component, HostListener, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { AuthService } from '../core/services/auth.service';

interface AdminNavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  auth = inject(AuthService);
  private router = inject(Router);

  mobileOpen = signal(false);

  navItems: AdminNavItem[] = [
    { label: 'Overview', path: '/admin', icon: '◆' },
    // FUTURE: { label: 'Content (CMS)', path: '/admin/content', icon: '✎' },
    { label: 'Theme', path: '/admin/theme', icon: '◐' },
    // FUTURE: { label: 'Media Library', path: '/admin/media', icon: '▦' },
    { label: 'Contacts', path: '/admin/contacts', icon: '✉' },
    { label: 'Categories', path: '/admin/categories', icon: '☰' },
    { label: 'Countries', path: '/admin/countries', icon: '◎' },
    // FUTURE: { label: 'Announcements', path: '/admin/announcements', icon: '📣' },
    // FUTURE: { label: 'Events & Challenges', path: '/admin/events', icon: '★' },
    // FUTURE: { label: 'Learning Hub', path: '/admin/learn', icon: '▤' },
    { label: 'Users', path: '/admin/users', icon: '⌘' },
    { label: 'Payments', path: '/admin/payments', icon: '$' },
    { label: 'Cancellations', path: '/admin/cancellations', icon: '⊘' },
    { label: 'Clients', path: '/admin/clients', icon: '▣' },
    { label: 'Bookings', path: '/admin/bookings', icon: '▦' },
  ];

  constructor() {
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => this.closeMobile());
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.closeMobile();
  }

  toggleMobile(): void {
    this.mobileOpen.update((v) => {
      const next = !v;
      document.body.style.overflow = next ? 'hidden' : '';
      return next;
    });
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
    document.body.style.overflow = '';
  }

  logout(): void {
    this.closeMobile();
    this.auth.logout();
  }
}
