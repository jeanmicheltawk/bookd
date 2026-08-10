import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { catchError, of } from 'rxjs';

import { LearningService } from '../../core/services/learning.service';
import { LearningArticle } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-learn-article',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingScreenComponent],
  templateUrl: './learn-article.component.html',
  styleUrl: './learn-article.component.scss',
})
export class LearnArticleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private learningService = inject(LearningService);
  private sanitizer = inject(DomSanitizer);

  article = signal<LearningArticle | null>(null);
  safeVideoUrl = signal<SafeResourceUrl | null>(null);
  loading = signal(true);
  notFound = signal(false);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.learningService.get(slug)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (!res) this.notFound.set(true);
        this.article.set(res);
        if (res?.video_url) {
          this.safeVideoUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(res.video_url));
        }
        this.loading.set(false);
      });
  }
}
