import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatMenuModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  auth = inject(AuthService);
  private router = inject(Router);
  private api = inject(ApiService);

  scrolled = signal(false);
  mobileMenuOpen = signal(false);
  searchTerm = '';

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 12);
  }

  get avatarUrl(): string {
    return this.api.assetUrl(this.auth.user()?.profile_photo_url);
  }

  get initials(): string {
    const name = this.auth.user()?.professional_name || this.auth.user()?.full_name || this.auth.user()?.email || 'U';
    return name.slice(0, 2).toUpperCase();
  }

  submitSearch(): void {
    const q = this.searchTerm.trim();
    this.mobileMenuOpen.set(false);
    this.router.navigate(['/search'], { queryParams: q ? { q } : {} });
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
