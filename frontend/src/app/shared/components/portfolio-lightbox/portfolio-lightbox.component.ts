import { Component, HostListener, OnDestroy, effect, inject, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PortfolioItem } from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-portfolio-lightbox',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portfolio-lightbox.component.html',
  styleUrl: './portfolio-lightbox.component.scss',
})
export class PortfolioLightboxComponent implements OnDestroy {
  api = inject(ApiService);
  items = input<PortfolioItem[]>([]);
  index = model<number | null>(null);

  constructor() {
    effect(() => {
      document.body.style.overflow = this.index() == null ? '' : 'hidden';
    });
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  current(): PortfolioItem | null {
    const i = this.index();
    const list = this.items();
    if (i == null || i < 0 || i >= list.length) return null;
    return list[i];
  }

  src(item: PortfolioItem): string {
    return this.api.assetUrl(item.url);
  }

  close(): void {
    this.index.set(null);
  }

  prev(event?: Event): void {
    event?.stopPropagation();
    const i = this.index();
    const n = this.items().length;
    if (i == null || n < 2) return;
    this.index.set((i - 1 + n) % n);
  }

  next(event?: Event): void {
    event?.stopPropagation();
    const i = this.index();
    const n = this.items().length;
    if (i == null || n < 2) return;
    this.index.set((i + 1) % n);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (this.index() == null) return;
    if (event.key === 'Escape') this.close();
    if (event.key === 'ArrowLeft') this.prev();
    if (event.key === 'ArrowRight') this.next();
  }
}
