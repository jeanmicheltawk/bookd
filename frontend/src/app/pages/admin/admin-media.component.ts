import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { MediaService } from '../../core/services/media.service';
import { ApiService } from '../../core/services/api.service';
import { MediaItem } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';

@Component({
  selector: 'app-admin-media',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingScreenComponent, SelectComponent],
  templateUrl: './admin-media.component.html',
  styleUrl: './admin-media.component.scss',
})
export class AdminMediaComponent implements OnInit {
  private mediaService = inject(MediaService);
  api = inject(ApiService);

  folderOptions: SelectOption[] = [
    { value: 'general', label: 'general' },
    { value: 'avatars', label: 'avatars' },
    { value: 'portfolio', label: 'portfolio' },
    { value: 'cms', label: 'cms' },
    { value: 'events', label: 'events' },
  ];

  items = signal<MediaItem[]>([]);
  folders = signal<Array<{ folder: string; count: number }>>([]);
  activeFolder = signal('');
  search = '';
  loading = signal(true);
  uploading = signal(false);
  uploadFolder = 'general';

  ngOnInit(): void {
    this.loadFolders();
    this.load();
  }

  loadFolders(): void {
    this.mediaService.listFolders().pipe(catchError(() => of({ data: [] }))).subscribe((res) => this.folders.set(res.data));
  }

  load(): void {
    this.loading.set(true);
    this.mediaService.list({ folder: this.activeFolder(), q: this.search, limit: 60 })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 60, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        this.items.set(res.data);
        this.loading.set(false);
      });
  }

  selectFolder(folder: string): void {
    this.activeFolder.set(folder);
    this.load();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.mediaService.upload(file, this.uploadFolder).subscribe({
      next: (media) => {
        this.items.update((list) => [media, ...list]);
        this.uploading.set(false);
        input.value = '';
        this.loadFolders();
      },
      error: () => this.uploading.set(false),
    });
  }

  delete(item: MediaItem): void {
    this.mediaService.delete(item.id).subscribe(() => {
      this.items.update((list) => list.filter((i) => i.id !== item.id));
      this.loadFolders();
    });
  }

  copyUrl(item: MediaItem): void {
    navigator.clipboard?.writeText(this.api.assetUrl(item.url));
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
