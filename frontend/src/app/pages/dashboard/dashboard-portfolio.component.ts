import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { ProfileService } from '../../core/services/profile.service';
import { MediaService } from '../../core/services/media.service';
import { PortfolioItem } from '../../core/models';
import { DashboardNavComponent } from './dashboard-nav.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-dashboard-portfolio',
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardNavComponent, LoadingScreenComponent],
  templateUrl: './dashboard-portfolio.component.html',
  styleUrl: './dashboard-portfolio.component.scss',
})
export class DashboardPortfolioComponent implements OnInit {
  private profileService = inject(ProfileService);
  private mediaService = inject(MediaService);

  items = signal<PortfolioItem[]>([]);
  loading = signal(true);
  uploading = signal(false);
  uploadError = signal('');
  newTitle = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.profileService.listMyPortfolio()
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((res) => {
        this.items.set(res.data);
        this.loading.set(false);
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.uploadError.set('');

    this.mediaService.upload(file, 'portfolio', this.newTitle).subscribe({
      next: (media) => {
        const mediaType = media.mime_type.startsWith('video') ? 'video' : 'image';
        this.profileService.addPortfolioItem({ url: media.url, mediaType, title: this.newTitle || media.original_name }).subscribe({
          next: (item) => {
            this.items.update((list) => [item, ...list]);
            this.newTitle = '';
            this.uploading.set(false);
            input.value = '';
          },
          error: () => { this.uploading.set(false); this.uploadError.set('Could not save portfolio item.'); },
        });
      },
      error: () => { this.uploading.set(false); this.uploadError.set('Upload failed. Try a smaller file.'); },
    });
  }

  remove(item: PortfolioItem): void {
    this.profileService.deletePortfolioItem(item.id).subscribe(() => {
      this.items.update((list) => list.filter((i) => i.id !== item.id));
    });
  }
}
