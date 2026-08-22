import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatMenuModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent implements OnInit {
  auth = inject(AuthService);
  alerts = inject(AlertService);
  private api = inject(ApiService);

  scrolled = signal(false);
  mobileMenuOpen = signal(false);

  ngOnInit(): void {
    this.alerts.refresh();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 12);
  }

  get avatarUrl(): string {
    return this.api.assetUrl(this.auth.user()?.profile_photo_url);
  }

  get bookingBadge(): number {
    const a = this.alerts.alerts();
    return this.auth.isBrand() ? a.bookingUpdates : a.newBookings;
  }

  get initials(): string {
    const name = this.auth.user()?.professional_name || this.auth.user()?.full_name || this.auth.user()?.email || 'U';
    return name.slice(0, 2).toUpperCase();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
  }
}
