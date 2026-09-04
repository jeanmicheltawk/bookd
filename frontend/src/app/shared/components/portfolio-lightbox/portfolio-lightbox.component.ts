import { Component, HostListener, OnDestroy, effect, inject, input, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { PortfolioItem } from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';
import { isPortfolioPdf } from '../../../core/utils/portfolio-limit';

@Component({
  selector: 'app-portfolio-lightbox',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portfolio-lightbox.component.html',
  styleUrl: './portfolio-lightbox.component.scss',
})
export class PortfolioLightboxComponent implements OnDestroy {
  api = inject(ApiService);
  private sanitizer = inject(DomSanitizer);
  items = input<PortfolioItem[]>([]);
  index = model<number | null>(null);
  pdfUrl = signal<SafeResourceUrl | null>(null);

  constructor() {
    effect(() => {
      document.body.style.overflow = this.index() == null ? '' : 'hidden';
    });

    effect((onCleanup) => {
      const item = this.current();
      if (!item || !this.isPdf(item)) {
        this.pdfUrl.set(null);
        return;
      }

      let objectUrl: string | null = null;
      let cancelled = false;

      fetch(this.src(item))
        .then((res) => {
          if (!res.ok) throw new Error('pdf');
          return res.blob();
        })
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl));
        })
        .catch(() => {
          if (!cancelled) this.pdfUrl.set(null);
        });

      onCleanup(() => {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        this.pdfUrl.set(null);
      });
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

  isPdf(item: PortfolioItem): boolean {
    return isPortfolioPdf(item);
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
