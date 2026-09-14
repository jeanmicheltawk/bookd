import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { NewsService } from '../../../core/services/news.service';
import { ApiService } from '../../../core/services/api.service';
import { NewsItem } from '../../../core/models';
import { AnimatedButtonComponent } from '../animated-button/animated-button.component';

const EMPTY_FORM = {
  title: '',
  body: '',
  isPublished: true,
};

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

@Component({
  selector: 'app-news-ticker',
  standalone: true,
  imports: [CommonModule, FormsModule, AnimatedButtonComponent],
  templateUrl: './news-ticker.component.html',
  styleUrl: './news-ticker.component.scss',
})
export class NewsTickerComponent implements OnInit, OnDestroy {
  private newsService = inject(NewsService);
  auth = inject(AuthService);
  api = inject(ApiService);

  private scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  news = signal<NewsItem[]>([]);
  selected = signal<NewsItem | null>(null);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  error = signal('');
  form = { ...EMPTY_FORM };
  imageFile: File | null = null;
  imagePreview = '';
  removeImage = false;
  private objectUrl = '';
  visible = computed(() => this.news().length > 0 || this.auth.isAdmin());

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.unlockPage();
    this.revokePreview();
  }

  load(): void {
    const request = this.auth.isAdmin() ? this.newsService.listAllAdmin() : this.newsService.list();
    request.pipe(catchError(() => of({ data: [] }))).subscribe((res) => this.news.set(res.data));
  }

  scroll(direction: number): void {
    this.scroller()?.nativeElement.scrollBy({ left: direction * 280, behavior: 'smooth' });
  }

  open(item: NewsItem): void {
    this.selected.set(item);
    this.lockPage();
  }

  close(): void {
    this.selected.set(null);
    if (!this.showForm()) this.unlockPage();
  }

  startAdd(): void {
    this.editingId.set(null);
    this.form = { ...EMPTY_FORM };
    this.resetImage();
    this.error.set('');
    this.selected.set(null);
    this.showForm.set(true);
    this.lockPage();
  }

  startEdit(item: NewsItem): void {
    this.editingId.set(item.id);
    this.form = {
      title: item.title,
      body: item.body || '',
      isPublished: item.is_published ?? true,
    };
    this.resetImage(item.image_url);
    this.error.set('');
    this.selected.set(null);
    this.showForm.set(true);
    this.lockPage();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      this.error.set('Use a JPG, PNG, GIF, or WebP image.');
      return;
    }
    this.revokePreview();
    this.imageFile = file;
    this.removeImage = false;
    this.objectUrl = URL.createObjectURL(file);
    this.imagePreview = this.objectUrl;
    this.error.set('');
  }

  clearImage(): void {
    this.revokePreview();
    this.imageFile = null;
    this.imagePreview = '';
    this.removeImage = true;
  }

  closeForm(): void {
    this.showForm.set(false);
    this.resetImage();
    this.unlockPage();
  }

  submit(ngForm: NgForm): void {
    if (ngForm.invalid || !this.auth.isAdmin()) return;
    this.saving.set(true);
    this.error.set('');

    const id = this.editingId();
    const payload = {
      title: this.form.title,
      body: this.form.body.trim() || null,
      isPublished: this.form.isPublished,
      removeImage: !this.imageFile && this.removeImage,
    };
    const request = id
      ? this.newsService.update(id, payload, this.imageFile)
      : this.newsService.create(payload, this.imageFile);
    request.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.showForm.set(false);
        this.unlockPage();
        this.resetImage();
        if (id) {
          this.news.update((list) => list.map((n) => (n.id === id ? result : n)));
        } else {
          this.news.update((list) => [result, ...list]);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error || 'Could not save news.');
      },
    });
  }

  remove(item: NewsItem): void {
    if (!this.auth.isAdmin()) return;
    this.newsService.delete(item.id).subscribe(() => {
      this.news.update((list) => list.filter((n) => n.id !== item.id));
      if (this.selected()?.id === item.id) this.close();
    });
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.showForm()) this.closeForm();
    else if (this.selected()) this.close();
  }

  private lockPage(): void {
    document.body.style.overflow = 'hidden';
  }

  private unlockPage(): void {
    document.body.style.overflow = '';
  }

  private resetImage(existingUrl?: string | null): void {
    this.revokePreview();
    this.imageFile = null;
    this.removeImage = false;
    this.imagePreview = existingUrl ? this.api.assetUrl(existingUrl) : '';
  }

  private revokePreview(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = '';
    }
  }
}
