import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../core/models';

@Component({
  selector: 'app-category-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './category-bar.component.html',
  styleUrl: './category-bar.component.scss',
})
export class CategoryBarComponent implements OnInit, OnDestroy {
  private categoryService = inject(CategoryService);
  private router = inject(Router);
  private sub?: Subscription;

  categories = signal<Category[]>([]);
  categorySlug = signal<string | null>(null);
  view = signal<string | null>(null);
  path = signal('/');

  isHaus = computed(() => {
    if (this.path() !== '/') return false;
    return !this.categorySlug() && this.view() !== 'all';
  });

  isAllCreatives = computed(() => {
    if (!this.isDiscoverPath()) return false;
    return !this.categorySlug() && (this.view() === 'all' || this.path() === '/search');
  });

  ngOnInit(): void {
    this.categoryService.list({ searchable: true }).subscribe({
      next: (res) => this.categories.set(res.data),
      error: () => this.categories.set([]),
    });
    this.syncFromUrl();
    this.sub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.syncFromUrl());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  isCategoryActive(slug: string): boolean {
    return this.isDiscoverPath() && this.categorySlug() === slug;
  }

  private isDiscoverPath(): boolean {
    const path = this.path();
    return path === '/' || path === '/search';
  }

  private syncFromUrl(): void {
    const tree = this.router.parseUrl(this.router.url);
    const child = tree.root.children['primary'];
    this.path.set(child?.segments.length ? `/${child.segments.map((s) => s.path).join('/')}` : '/');
    this.categorySlug.set(tree.queryParams['category'] || null);
    this.view.set(tree.queryParams['view'] || null);
  }
}
