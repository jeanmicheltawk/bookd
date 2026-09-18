import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

export interface CropFrameOption {
  id: string;
  label: string;
  ratio: number;
}

const DEFAULT_FRAMES: CropFrameOption[] = [
  { id: 'portrait', label: 'Portrait', ratio: 3 / 4 },
  { id: 'square', label: 'Square', ratio: 1 },
];

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const MAX_OUTPUT_SIDE = 1600;

@Component({
  selector: 'app-image-cropper',
  standalone: true,
  templateUrl: './image-cropper.component.html',
  styleUrl: './image-cropper.component.scss',
})
export class ImageCropperComponent implements AfterViewInit, OnDestroy {
  file = input.required<File>();
  heading = input('Adjust photo');
  confirmLabel = input('Use this frame');
  frames = input<CropFrameOption[]>(DEFAULT_FRAMES);

  cropped = output<File>();
  cancelled = output<void>();

  private stage = viewChild<ElementRef<HTMLElement>>('stage');
  private imageEl = viewChild<ElementRef<HTMLImageElement>>('image');

  src = signal('');
  ready = signal(false);
  exporting = signal(false);
  error = signal('');
  frameId = signal(DEFAULT_FRAMES[0].id);
  x = signal(0);
  y = signal(0);
  zoom = signal(MIN_ZOOM);
  viewportW = signal(0);
  viewportH = signal(0);
  dragging = signal(false);

  readonly minZoom = MIN_ZOOM;
  readonly maxZoom = MAX_ZOOM;

  displayWidth = computed(() => this.naturalW() * this.coverScale() * this.zoom());
  displayHeight = computed(() => this.naturalH() * this.coverScale() * this.zoom());
  imageTransform = computed(() => `translate3d(${this.x()}px, ${this.y()}px, 0)`);

  private naturalW = signal(0);
  private naturalH = signal(0);
  private coverScale = signal(1);
  private objectUrl = '';
  private viewReady = false;
  private imageReady = false;
  private preserveOnLayout = false;
  private resizeObserver: ResizeObserver | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private dragOriginX = 0;
  private dragOriginY = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private pinchStartDist = 0;
  private pinchStartZoom = MIN_ZOOM;
  private previousOverflow = '';

  constructor() {
    effect(
      (onCleanup) => {
        const file = this.file();
        this.loadFile(file);
        onCleanup(() => this.revokeObjectUrl());
      },
      { allowSignalWrites: true },
    );
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const stage = this.stage()?.nativeElement;
    if (stage) {
      stage.addEventListener('wheel', this.onStageWheel, { passive: false });
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.preserveOnLayout = true;
          this.layout();
        });
        this.resizeObserver.observe(stage);
      }
    }
    this.layout();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.stage()?.nativeElement.removeEventListener('wheel', this.onStageWheel);
    document.body.style.overflow = this.previousOverflow;
    this.revokeObjectUrl();
  }

  activeFrame(): CropFrameOption {
    return this.frames().find((frame) => frame.id === this.frameId()) ?? this.frames()[0];
  }

  setFrame(id: string): void {
    if (id === this.frameId()) return;
    this.frameId.set(id);
    this.zoom.set(MIN_ZOOM);
    this.preserveOnLayout = false;
    this.layout();
  }

  setZoom(value: number, focalX?: number, focalY?: number): void {
    const next = this.clamp(value, MIN_ZOOM, MAX_ZOOM);
    const prev = this.zoom();
    if (Math.abs(next - prev) < 0.0001) return;

    const fx = focalX ?? this.viewportW() / 2;
    const fy = focalY ?? this.viewportH() / 2;
    const prevScale = this.coverScale() * prev;
    const natX = prevScale ? (fx - this.x()) / prevScale : 0;
    const natY = prevScale ? (fy - this.y()) / prevScale : 0;

    this.zoom.set(next);
    const nextScale = this.coverScale() * next;
    this.x.set(fx - natX * nextScale);
    this.y.set(fy - natY * nextScale);
    this.clampOffset();
  }

  onSliderInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.setZoom(value);
  }

  private onStageWheel = (event: Event): void => {
    const wheel = event as WheelEvent;
    wheel.preventDefault();
    const viewport = this.stage()?.nativeElement.querySelector('.cropper__viewport');
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const factor = wheel.deltaY < 0 ? 1.08 : 1 / 1.08;
    this.setZoom(this.zoom() * factor, wheel.clientX - rect.left, wheel.clientY - rect.top);
  };

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchStartDist = this.distance(a, b);
      this.pinchStartZoom = this.zoom();
      this.dragging.set(false);
      return;
    }

    this.dragging.set(true);
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragOriginX = this.x();
    this.dragOriginY = this.y();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      if (this.pinchStartDist <= 0) return;
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const midX = (a.x + b.x) / 2 - rect.left;
      const midY = (a.y + b.y) / 2 - rect.top;
      this.setZoom(this.pinchStartZoom * (this.distance(a, b) / this.pinchStartDist), midX, midY);
      return;
    }

    if (!this.dragging()) return;
    this.x.set(this.dragOriginX + (event.clientX - this.dragStartX));
    this.y.set(this.dragOriginY + (event.clientY - this.dragStartY));
    this.clampOffset();
  }

  onPointerUp(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) {
      this.pinchStartDist = 0;
    }
    if (this.pointers.size === 1) {
      const remaining = [...this.pointers.values()][0];
      this.dragging.set(true);
      this.dragStartX = remaining.x;
      this.dragStartY = remaining.y;
      this.dragOriginX = this.x();
      this.dragOriginY = this.y();
      return;
    }
    this.dragging.set(false);
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  }

  onImageLoad(): void {
    const img = this.imageEl()?.nativeElement;
    if (!img?.naturalWidth) return;
    this.naturalW.set(img.naturalWidth);
    this.naturalH.set(img.naturalHeight);
    this.imageReady = true;
    this.error.set('');
    this.preserveOnLayout = false;
    this.layout();
  }

  onImageError(): void {
    this.error.set('Could not read that image. Try a different JPEG, PNG, or WebP file.');
    this.ready.set(false);
  }

  cancel(): void {
    if (this.exporting()) return;
    this.cancelled.emit();
  }

  async confirm(): Promise<void> {
    if (!this.ready() || this.exporting()) return;
    const img = this.imageEl()?.nativeElement;
    if (!img) return;

    this.exporting.set(true);
    try {
      const blob = await this.exportBlob(img);
      const base = this.file().name.replace(/\.[^.]+$/, '') || 'profile';
      this.cropped.emit(new File([blob], `${base}.jpg`, { type: 'image/jpeg' }));
    } catch {
      this.exporting.set(false);
      this.error.set('Could not crop that image. Try another photo.');
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.cancel();
  }

  private loadFile(file: File): void {
    this.revokeObjectUrl();
    this.imageReady = false;
    this.ready.set(false);
    this.error.set('');
    this.naturalW.set(0);
    this.naturalH.set(0);
    this.zoom.set(MIN_ZOOM);
    this.frameId.set(this.frames()[0]?.id ?? 'portrait');
    this.objectUrl = URL.createObjectURL(file);
    this.src.set(this.objectUrl);
  }

  private layout(): void {
    const stage = this.stage()?.nativeElement;
    if (!stage || !this.viewReady || !this.imageReady || !this.naturalW() || !this.naturalH()) return;

    const ratio = this.activeFrame().ratio;
    const maxW = Math.max(stage.clientWidth, 120);
    const maxH = Math.max(stage.clientHeight, 160);

    let width = maxW;
    let height = width / ratio;
    if (height > maxH) {
      height = maxH;
      width = height * ratio;
    }

    const prevW = this.viewportW();
    const prevH = this.viewportH();
    const prevCover = this.coverScale();
    const prevZoom = this.zoom();
    const centerNatX = prevCover * prevZoom ? (prevW / 2 - this.x()) / (prevCover * prevZoom) : this.naturalW() / 2;
    const centerNatY = prevCover * prevZoom ? (prevH / 2 - this.y()) / (prevCover * prevZoom) : this.naturalH() / 2;

    this.viewportW.set(width);
    this.viewportH.set(height);
    this.coverScale.set(Math.max(width / this.naturalW(), height / this.naturalH()));

    if (this.preserveOnLayout && prevCover) {
      const scale = this.coverScale() * this.zoom();
      this.x.set(width / 2 - centerNatX * scale);
      this.y.set(height / 2 - centerNatY * scale);
    } else {
      this.x.set((width - this.naturalW() * this.coverScale() * this.zoom()) / 2);
      this.y.set((height - this.naturalH() * this.coverScale() * this.zoom()) / 2);
    }

    this.clampOffset();
    this.ready.set(true);
    this.preserveOnLayout = false;
  }

  private clampOffset(): void {
    const dw = this.displayWidth();
    const dh = this.displayHeight();
    const vw = this.viewportW();
    const vh = this.viewportH();
    this.x.set(this.clamp(this.x(), vw - dw, 0));
    this.y.set(this.clamp(this.y(), vh - dh, 0));
  }

  private exportBlob(img: HTMLImageElement): Promise<Blob> {
    const scale = this.coverScale() * this.zoom();
    const cropX = this.clamp(-this.x() / scale, 0, this.naturalW());
    const cropY = this.clamp(-this.y() / scale, 0, this.naturalH());
    const cropW = this.clamp(this.viewportW() / scale, 1, this.naturalW() - cropX);
    const cropH = this.clamp(this.viewportH() / scale, 1, this.naturalH() - cropY);

    let outW = Math.max(1, Math.round(cropW));
    let outH = Math.max(1, Math.round(cropH));
    const longest = Math.max(outW, outH);
    if (longest > MAX_OUTPUT_SIDE) {
      const shrink = MAX_OUTPUT_SIDE / longest;
      outW = Math.max(1, Math.round(outW * shrink));
      outH = Math.max(1, Math.round(outH * shrink));
    }

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new Error('canvas'));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('blob'))), 'image/jpeg', 0.92);
    });
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = '';
    }
  }

  private distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
