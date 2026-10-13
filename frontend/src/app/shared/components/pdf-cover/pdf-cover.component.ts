import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import { loadPdfBytes, loadPdfjs, pdfAssetBase } from '../../../core/utils/pdf-preview';

@Component({
  selector: 'app-pdf-cover',
  standalone: true,
  templateUrl: './pdf-cover.component.html',
  styleUrl: './pdf-cover.component.scss',
})
export class PdfCoverComponent implements AfterViewInit, OnDestroy {
  src = input.required<string>();
  title = input('Document');

  ready = signal(false);
  failed = signal(false);

  private host = inject(ElementRef<HTMLElement>);
  private canvas = viewChild<ElementRef<HTMLCanvasElement>>('page');
  private token = 0;
  private drawing = false;
  private pending = false;
  private viewReady = false;
  private observer?: ResizeObserver;
  private renderTask: { cancel: () => void } | null = null;

  constructor() {
    effect(() => {
      this.src();
      if (this.viewReady) void this.draw();
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.observer = new ResizeObserver(() => {
      if (!this.ready() && !this.failed() && !this.drawing) void this.draw();
    });
    this.observer.observe(this.host.nativeElement);
    void this.draw();
  }

  ngOnDestroy(): void {
    this.token++;
    this.observer?.disconnect();
    this.renderTask?.cancel();
  }

  private async draw(): Promise<void> {
    if (this.drawing) {
      this.pending = true;
      return;
    }
    this.pending = false;
    this.drawing = true;

    const token = ++this.token;
    this.renderTask?.cancel();
    this.renderTask = null;
    this.ready.set(false);
    this.failed.set(false);

    const src = this.src();
    const canvas = this.canvas()?.nativeElement;
    const host = this.host.nativeElement;
    let pdf: { destroy: () => Promise<void> } | null = null;
    try {
      if (!src || !canvas) return;

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (token !== this.token) return;

      const cssWidth = host.clientWidth;
      const cssHeight = host.clientHeight;
      if (cssWidth < 2 || cssHeight < 2) return;

      const pdfjs = await loadPdfjs();
      if (token !== this.token) return;
      const bytes = await loadPdfBytes(src);
      if (token !== this.token) return;

      const base = pdfAssetBase();
      const doc = await pdfjs.getDocument({
        data: bytes.slice(),
        cMapUrl: new URL('cmaps/', base).href,
        cMapPacked: true,
        standardFontDataUrl: new URL('standard_fonts/', base).href,
      }).promise;
      pdf = doc;
      if (token !== this.token) return;

      const page = await doc.getPage(1);
      const unscaled = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const fit = Math.min(cssWidth / unscaled.width, cssHeight / unscaled.height);
      const viewport = page.getViewport({ scale: Math.max(fit, 0.1) * dpr });
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const task = page.render({ canvasContext: ctx, viewport, background: '#ffffff' });
      this.renderTask = task;
      await task.promise;
      if (this.renderTask === task) this.renderTask = null;
      if (token !== this.token) return;
      this.ready.set(true);
    } catch (err) {
      if (token !== this.token) return;
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : '';
      if (name === 'RenderingCancelledException') return;
      this.failed.set(true);
    } finally {
      this.drawing = false;
      await pdf?.destroy().catch(() => undefined);
      if (this.pending) {
        this.pending = false;
        void this.draw();
      }
    }
  }
}
