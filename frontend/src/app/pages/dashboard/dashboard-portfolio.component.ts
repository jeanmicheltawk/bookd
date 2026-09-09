import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ProfileService } from '../../core/services/profile.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { PortfolioItem } from '../../core/models';
import {
  PREMIUM_FILE_LIMIT,
  PREMIUM_LINK_LIMIT,
  isHttpUrl,
  isPlayableVideoFile,
  isPortfolioPdf,
  portfolioCapsFor,
} from '../../core/utils/portfolio-limit';
import { effectiveMembership } from '../../core/utils/subscription';
import { DashboardNavComponent } from './dashboard-nav.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { PortfolioLightboxComponent } from '../../shared/components/portfolio-lightbox/portfolio-lightbox.component';

@Component({
  selector: 'app-dashboard-portfolio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DashboardNavComponent, LoadingScreenComponent, PortfolioLightboxComponent],
  templateUrl: './dashboard-portfolio.component.html',
  styleUrl: './dashboard-portfolio.component.scss',
})
export class DashboardPortfolioComponent implements OnInit {
  private profileService = inject(ProfileService);
  api = inject(ApiService);
  auth = inject(AuthService);

  items = signal<PortfolioItem[]>([]);
  loading = signal(true);
  uploading = signal(false);
  addingLink = signal(false);
  uploadError = signal('');
  lightboxIndex = signal<number | null>(null);
  newTitle = '';
  newVideoUrl = '';

  caps = computed(() => portfolioCapsFor(effectiveMembership(this.auth.user())));
  isPremium = computed(() => effectiveMembership(this.auth.user()) === 'premium');
  fileLimit = computed(() => this.caps().files);
  linkLimit = computed(() => this.caps().links);
  fileCount = computed(() => this.items().filter((item) => item.media_type !== 'video').length);
  linkCount = computed(() => this.items().filter((item) => item.media_type === 'video').length);
  atFileLimit = computed(() => this.fileCount() >= this.fileLimit());
  atLinkLimit = computed(() => this.linkCount() >= this.linkLimit());
  premiumFileLimit = PREMIUM_FILE_LIMIT;
  premiumLinkLimit = PREMIUM_LINK_LIMIT;

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

    if (this.atFileLimit()) {
      this.uploadError.set(this.fileLimitError());
      input.value = '';
      return;
    }

    const mime = (file.type || '').toLowerCase();
    const isPdf = mime === 'application/pdf' || mime === 'application/x-pdf' || /\.pdf$/i.test(file.name);
    const isImage = mime.startsWith('image/');
    const isVideo = mime.startsWith('video/');
    if (isVideo) {
      this.uploadError.set('Add a video as a link instead of uploading a video file.');
      input.value = '';
      return;
    }
    if (isPdf && !this.caps().allowPdf) {
      this.uploadError.set('Starter plan allows images only. Upgrade to Premium plan to upload PDFs.');
      input.value = '';
      return;
    }
    if (!isPdf && !isImage) {
      this.uploadError.set(this.caps().allowPdf ? 'Use an image or PDF under 25MB.' : 'Use an image under 25MB.');
      input.value = '';
      return;
    }

    this.uploading.set(true);
    this.uploadError.set('');

    this.profileService.uploadPortfolio(file, this.newTitle).subscribe({
      next: (item) => {
        this.items.update((list) => [item, ...list]);
        this.newTitle = '';
        this.uploading.set(false);
        input.value = '';
      },
      error: (err) => {
        this.uploading.set(false);
        input.value = '';
        this.uploadError.set(err?.error?.error || (this.caps().allowPdf ? 'Could not upload. Try an image or PDF under 25MB.' : 'Could not upload. Try an image under 25MB.'));
      },
    });
  }

  addVideoLink(): void {
    const url = this.newVideoUrl.trim();
    if (!url) {
      this.uploadError.set('Paste a video link first.');
      return;
    }
    if (this.atLinkLimit()) {
      this.uploadError.set(this.linkLimitError());
      return;
    }
    if (!isHttpUrl(url)) {
      this.uploadError.set('Enter a valid video link (http or https).');
      return;
    }

    this.addingLink.set(true);
    this.uploadError.set('');

    this.profileService.addPortfolioItem({
      url,
      mediaType: 'video',
      title: this.newTitle || null,
    }).subscribe({
      next: (item) => {
        this.items.update((list) => [item, ...list]);
        this.newTitle = '';
        this.newVideoUrl = '';
        this.addingLink.set(false);
      },
      error: (err) => {
        this.addingLink.set(false);
        this.uploadError.set(err?.error?.error || 'Could not add that video link.');
      },
    });
  }

  fileLimitError(): string {
    if (this.isPremium()) {
      return `Premium plan allows up to ${this.fileLimit()} portfolio images/PDFs.`;
    }
    return `Starter plan allows ${this.fileLimit()} portfolio images. Upgrade to Premium plan for ${PREMIUM_FILE_LIMIT} images/PDFs.`;
  }

  linkLimitError(): string {
    if (this.isPremium()) {
      return `Premium plan allows up to ${this.linkLimit()} video links.`;
    }
    return `Starter plan allows ${this.linkLimit()} video links. Upgrade to Premium plan for ${PREMIUM_LINK_LIMIT}.`;
  }

  isPdf(item: PortfolioItem): boolean {
    return isPortfolioPdf(item);
  }

  isPlayableVideo(item: PortfolioItem): boolean {
    return isPlayableVideoFile(item);
  }

  openLightbox(index: number): void {
    this.lightboxIndex.set(index);
  }

  remove(item: PortfolioItem): void {
    this.profileService.deletePortfolioItem(item.id).subscribe(() => {
      this.items.update((list) => list.filter((i) => i.id !== item.id));
      this.lightboxIndex.set(null);
    });
  }
}
