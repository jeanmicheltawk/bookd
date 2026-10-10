import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ProfileService } from '../../core/services/profile.service';
import { PaymentService } from '../../core/services/payment.service';
import { CreatorSetupService } from '../../core/services/creator-setup.service';
import { PortfolioItem, WhishPaymentInstructions } from '../../core/models';
import {
  isHttpUrl,
  isImageUpload,
  isPdfUpload,
  isVideoUpload,
  portfolioCapsFor,
  portfolioFileTooLargeMessage,
} from '../../core/utils/portfolio-limit';
import { effectiveMembership } from '../../core/utils/subscription';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { ImageCropperComponent } from '../../shared/components/image-cropper/image-cropper.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-dashboard-stepper',
  standalone: true,
  imports: [CommonModule, FormsModule, AnimatedButtonComponent, ImageCropperComponent, LoadingScreenComponent],
  templateUrl: './dashboard-stepper.component.html',
  styleUrl: './dashboard-stepper.component.scss',
})
export class DashboardStepperComponent implements OnInit {
  auth = inject(AuthService);
  api = inject(ApiService);
  private profiles = inject(ProfileService);
  private payments = inject(PaymentService);
  private setup = inject(CreatorSetupService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  step = signal(0);
  pendingPhoto = signal<File | null>(null);
  uploadingPhoto = signal(false);
  uploadingWork = signal(false);
  addingLink = signal(false);
  paying = signal(false);
  loadingPay = signal(true);
  error = signal('');
  payNote = signal('');
  videoUrl = '';
  payment = signal<WhishPaymentInstructions | null>(null);
  items = signal<PortfolioItem[]>([]);

  private placed = false;

  readonly hasPhoto = this.setup.hasPhoto;
  readonly hasPortfolio = this.setup.hasPortfolio;
  readonly steps = computed(() => {
    const list = [
      { label: 'Profile photo' },
      { label: 'Portfolio' },
    ];
    if (!this.auth.isComplimentary()) list.push({ label: 'Payment' });
    return list;
  });
  readonly caps = computed(() => portfolioCapsFor(effectiveMembership(this.auth.user())));
  readonly photoUrl = computed(() => this.auth.user()?.profile_photo_url || '');
  readonly paid = computed(() => this.payment()?.payment?.status === 'confirmed');

  constructor() {
    effect(() => {
      if (this.placed || !this.setup.loaded()) return;
      this.placed = true;
      this.step.set(this.suggestedStep());
    });
  }

  ngOnInit(): void {
    const whish = this.route.snapshot.queryParamMap.get('whish');
    if (whish === 'success' || whish === 'failed') {
      this.placed = true;
      this.step.set(this.payIndex());
      this.syncPayment(whish);
    } else {
      this.loadPayment();
    }
    this.setup.refresh();
    this.loadPortfolio();
  }

  suggestedStep(): number {
    if (!this.hasPhoto()) return 0;
    if (!this.hasPortfolio()) return 1;
    return this.payIndex();
  }

  canOpen(index: number): boolean {
    if (index <= 0) return true;
    if (index === 1) return this.hasPhoto();
    return this.hasPhoto() && this.hasPortfolio();
  }

  go(index: number): void {
    if (!this.canOpen(index) || index > this.steps().length - 1) return;
    this.error.set('');
    this.step.set(index);
  }

  next(): void {
    this.go(this.step() + 1);
  }

  back(): void {
    if (this.step() > 0) this.step.update((value) => value - 1);
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.error.set('Please choose a JPEG, PNG, GIF, or WebP image.');
      return;
    }
    this.error.set('');
    this.pendingPhoto.set(file);
  }

  onPhotoCropped(file: File): void {
    this.pendingPhoto.set(null);
    this.uploadingPhoto.set(true);
    this.error.set('');
    this.profiles.uploadPhoto(file).subscribe({
      next: (media) => {
        const url = media.profile_photo_url || media.url;
        this.auth.updateStoredUser({ profile_photo_url: url });
        this.uploadingPhoto.set(false);
      },
      error: (err) => {
        this.uploadingPhoto.set(false);
        this.error.set(err?.error?.error || 'Could not upload your photo.');
      },
    });
  }

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;

    this.uploadingWork.set(true);
    this.error.set('');
    const notes: string[] = [];
    for (const file of files) {
      if (isVideoUpload(file)) {
        notes.push('Add a video as a link instead of uploading a video file.');
        continue;
      }
      if (isPdfUpload(file) && !this.caps().allowPdf) {
        notes.push('Starter plan allows images only. Upgrade to Premium later to upload PDFs.');
        continue;
      }
      if (!isPdfUpload(file) && !isImageUpload(file)) {
        notes.push(this.caps().allowPdf ? 'Use an image or a PDF.' : 'Use an image.');
        continue;
      }
      const tooLarge = portfolioFileTooLargeMessage(file);
      if (tooLarge) {
        notes.push(tooLarge);
        continue;
      }
      try {
        const item = await firstValueFrom(this.profiles.uploadPortfolio(file));
        this.items.update((list) => [item, ...list]);
      } catch (err: unknown) {
        const message = (err as { error?: { error?: string } })?.error?.error || 'Could not upload that file.';
        notes.push(message);
      }
    }
    this.setup.setPortfolioCount(this.items().length);
    this.uploadingWork.set(false);
    this.error.set([...new Set(notes)].join(' '));
  }

  addVideoLink(): void {
    const url = this.videoUrl.trim();
    if (!isHttpUrl(url)) {
      this.error.set('Enter a valid video link (http or https).');
      return;
    }
    this.addingLink.set(true);
    this.error.set('');
    this.profiles.addPortfolioItem({ url, mediaType: 'video' }).subscribe({
      next: (item) => {
        this.items.update((list) => [item, ...list]);
        this.setup.setPortfolioCount(this.items().length);
        this.videoUrl = '';
        this.addingLink.set(false);
      },
      error: (err) => {
        this.addingLink.set(false);
        this.error.set(err?.error?.error || 'Could not add that video link.');
      },
    });
  }

  pay(): void {
    if (this.paying()) return;
    this.paying.set(true);
    this.error.set('');
    this.payments.checkout().subscribe({
      next: (res) => {
        this.payment.set(res);
        const url = res.collect_url || res.payment?.collect_url;
        if (!url) {
          this.paying.set(false);
          this.error.set('The payment page did not load. Try again.');
          return;
        }
        window.location.href = url;
      },
      error: (err) => {
        this.paying.set(false);
        this.error.set(err?.error?.error || 'Could not start card checkout.');
      },
    });
  }

  finish(): void {
    this.auth.finishStepper();
    this.router.navigate(['/dashboard']);
  }

  private payIndex(): number {
    return this.auth.isComplimentary() ? 1 : 2;
  }

  private loadPortfolio(): void {
    this.profiles.listMyPortfolio().pipe(catchError(() => of({ data: [] as PortfolioItem[] }))).subscribe((res) => {
      this.items.set(res.data || []);
      this.setup.setPortfolioCount(this.items().length);
    });
  }

  private loadPayment(): void {
    if (this.auth.isComplimentary()) {
      this.loadingPay.set(false);
      return;
    }
    this.payments.getWhish().pipe(catchError(() => of(null))).subscribe((res) => {
      this.payment.set(res);
      this.loadingPay.set(false);
    });
  }

  private syncPayment(result: string): void {
    this.loadingPay.set(true);
    this.payments.sync().pipe(catchError(() => of(null))).subscribe((res) => {
      this.payment.set(res);
      this.loadingPay.set(false);
      if (res?.payment?.status === 'confirmed') {
        this.payNote.set('Your card payment was confirmed.');
      } else if (result === 'failed') {
        this.error.set('That attempt did not go through. Tap Pay to try again.');
      } else {
        this.payNote.set('Checking your payment. If you just paid, it can take a moment to confirm.');
      }
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    });
  }
}
