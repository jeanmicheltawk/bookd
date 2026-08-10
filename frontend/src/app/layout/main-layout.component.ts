import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../shared/components/navbar/navbar.component';
import { CategoryBarComponent } from '../shared/components/category-bar/category-bar.component';
import { FooterComponent } from '../shared/components/footer/footer.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, CategoryBarComponent, FooterComponent],
  template: `
    <app-navbar />
    <app-category-bar />
    <main class="main-content">
      <router-outlet />
    </main>
    <app-footer />
  `,
  styles: [`
    .main-content {
      min-height: calc(100vh - var(--nav-height) - var(--category-bar-height));
      padding-top: var(--nav-height);
    }
  `],
})
export class MainLayoutComponent {}
