import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';

import { ProfileService } from '../../core/services/profile.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { PortfolioItem } from '../../core/models';
import {
  PREMIUM_FILE_LIMIT,
  PREMIUM_LINK_LIMIT,
  isHttpUrl,
  isImageUpload,
  isPdfUpload,
  isPlayableVideoFile,
  isPortfolioPdf,
  isVideoUpload,
  portfolioCapsFor,
  portfolioFileTooLargeMessage,
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
  uploadStatus = signal('');
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

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    if (this.atFileLimit()) {
      this.uploadError.set(this.fileLimitError());
      input.value = '';
      return;
    }

    const remaining = this.fileLimit() - this.fileCount();
    const notes: string[] = [];
    const valid: File[] = [];

    for (const file of files) {
      if (isVideoUpload(file)) {
        notes.push('Add a video as a link instead of uploading a video file.');
        continue;
      }
      if (isPdfUpload(file) && !this.caps().allowPdf) {
        notes.push('Starter plan allows images only. Upgrade to Premium plan to upload PDFs.');
        continue;
      }
      if (!isPdfUpload(file) && !isImageUpload(file)) {
        notes.push(this.caps().allowPdf ? 'Use an image or a PDF of 40MB or less.' : 'Use an image of 40MB or less.');
        continue;
      }
      const tooLarge = portfolioFileTooLargeMessage(file);
      if (tooLarge) {
        notes.push(tooLarge);
        continue;
      }
      valid.push(file);
    }

    const accepted = valid.slice(0, remaining);
    if (valid.length > remaining) {
      notes.push(this.fileLimitError());
    }

    if (!accepted.length) {
      this.uploadError.set([...new Set(notes)].join(' '));
      input.value = '';
      return;
    }

    this.uploading.set(true);
    this.uploadError.set([...new Set(notes)].join(' '));
    const title = accepted.length === 1 ? this.newTitle : '';
    const uploaded: PortfolioItem[] = [];

    for (let i = 0; i < accepted.length; i++) {
      this.uploadStatus.set(`Uploading ${i + 1}/${accepted.length}...`);
      try {
        const item = await firstValueFrom(
          this.profileService.uploadPortfolio(accepted[i], title || undefined)
        );
        uploaded.push(item);
      } catch (err: unknown) {
        const message = (err as { error?: { error?: string } })?.error?.error
          || (isPdfUpload(accepted[i])
            ? 'Could not upload. Compress the PDF or upload a PDF of 40MB or less.'
            : (this.caps().allowPdf ? 'Could not upload. Try an image or PDF of 40MB or less.' : 'Could not upload. Try an image of 40MB or less.'));
        notes.push(message);
      }
    }

    if (uploaded.length) {
      this.items.update((list) => [...uploaded, ...list]);
      this.newTitle = '';
    }
    this.uploading.set(false);
    this.uploadStatus.set('');
    this.uploadError.set([...new Set(notes)].join(' '));
    input.value = '';
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
