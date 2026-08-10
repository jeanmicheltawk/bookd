import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { LearningService } from '../../core/services/learning.service';
import { LearningArticle } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-learn-hub',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingScreenComponent],
  templateUrl: './learn-hub.component.html',
  styleUrl: './learn-hub.component.scss',
})
export class LearnHubComponent implements OnInit {
  private learningService = inject(LearningService);

  articles = signal<LearningArticle[]>([]);
  loading = signal(true);
  activeCategory = signal('');

  categories(): string[] {
    return Array.from(new Set(this.articles().map((a) => a.category).filter((c): c is string => !!c)));
  }

  filtered(): LearningArticle[] {
    const cat = this.activeCategory();
    return cat ? this.articles().filter((a) => a.category === cat) : this.articles();
  }

  ngOnInit(): void {
    this.learningService.list({ limit: 40 })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 40, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        this.articles.set(res.data);
        this.loading.set(false);
      });
  }
}
