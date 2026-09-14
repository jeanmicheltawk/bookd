import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { NewsService } from '../../core/services/news.service';
import { ApiService } from '../../core/services/api.service';
import { NewsItem } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';

const EMPTY_FORM = {
  title: '', body: '', isPublished: true,
};

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

@Component({
  selector: 'app-admin-news',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingScreenComponent, AnimatedButtonComponent],
  templateUrl: './admin-news.component.html',
  styleUrl: './admin-news.component.scss',
})
export class AdminNewsComponent implements OnInit, OnDestroy {
  private newsService = inject(NewsService);
  api = inject(ApiService);

  items = signal<NewsItem[]>([]);
  loading = signal(true);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  error = signal('');
  imageFile: File | null = null;
  imagePreview = '';
  removeImage = false;
  private objectUrl = '';

  form: typeof EMPTY_FORM = { ...EMPTY_FORM };

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.revokePreview();
  }

  load(): void {
    this.loading.set(true);
    this.newsService.listAllAdmin().pipe(catchError(() => of({ data: [] }))).subscribe((res) => {
      this.items.set(res.data);
      this.loading.set(false);
    });
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form = { ...EMPTY_FORM };
    this.resetImage();
    this.error.set('');
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.resetImage();
    this.error.set('');
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
    this.showForm.set(true);
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

  submit(ngForm: NgForm): void {
    if (ngForm.invalid) return;
    this.saving.set(true);
    this.error.set('');

    const id = this.editingId();
    const payload = {
      title: this.form.title,
      body: this.form.body,
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
        this.resetImage();
        if (id) {
          this.items.update((list) => list.map((n) => (n.id === id ? result : n)));
        } else {
          this.items.update((list) => [result, ...list]);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error || 'Could not save news.');
      },
    });
  }

  remove(item: NewsItem): void {
    this.newsService.delete(item.id).subscribe(() => {
      this.items.update((list) => list.filter((x) => x.id !== item.id));
    });
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
