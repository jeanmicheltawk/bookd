import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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
  collapsed = signal(false);

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
    { label: 'Testimonials', path: '/admin/testimonials', icon: '❝' },
    { label: 'Users', path: '/admin/users', icon: '⌘' },
    { label: 'Analytics', path: '/admin/analytics', icon: '▲' },
  ];

  toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
  }

  logout(): void {
    this.auth.logout();
  }
}
