import { Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
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
  canScrollLeft = signal(false);
  canScrollRight = signal(false);

  private track = viewChild<ElementRef<HTMLElement>>('track');

  isHaus = computed(() => {
    if (this.path() !== '/') return false;
    return !this.categorySlug() && this.view() !== 'all';
  });

  isAllCreatives = computed(() => {
    if (!this.isDiscoverPath()) return false;
    return !this.categorySlug() && (this.view() === 'all' || this.path() === '/search');
  });

  constructor() {
    effect((onCleanup) => {
      const el = this.track()?.nativeElement;
      if (!el) return;
      const update = () => this.updateArrows();
      update();
      const observer = new ResizeObserver(update);
      observer.observe(el);
      void document.fonts?.ready.then(update);
      onCleanup(() => observer.disconnect());
    });
  }

  updateArrows(): void {
    const el = this.track()?.nativeElement;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    this.canScrollLeft.set(el.scrollLeft > 12);
    this.canScrollRight.set(max - el.scrollLeft > 12);
  }

  scrollBy(direction: -1 | 1): void {
    const el = this.track()?.nativeElement;
    if (!el) return;
    const bounds = el.getBoundingClientRect();
    const chips = [...el.querySelectorAll<HTMLElement>('.cat-bar__chip')];
    const target = direction === 1
      ? chips.find((chip) => chip.getBoundingClientRect().right > bounds.right + 1)
      : [...chips].reverse().find((chip) => chip.getBoundingClientRect().left < bounds.left - 1);
    if (!target) {
      el.scrollTo({ left: direction === 1 ? el.scrollWidth : 0, behavior: 'smooth' });
      return;
    }
    const nextLeft = el.scrollLeft + (target.getBoundingClientRect().left - bounds.left);
    el.scrollTo({ left: Math.max(0, nextLeft), behavior: 'smooth' });
  }

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
