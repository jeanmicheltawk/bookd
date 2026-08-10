import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { LearningService } from '../../core/services/learning.service';
import { LearningArticle } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';

const EMPTY_FORM = {
  title: '', slug: '', category: '', content: '', coverImage: '', videoUrl: '', isPublished: true,
};

@Component({
  selector: 'app-admin-learn',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingScreenComponent, AnimatedButtonComponent],
  templateUrl: './admin-learn.component.html',
  styleUrl: './admin-learn.component.scss',
})
export class AdminLearnComponent implements OnInit {
  private learningService = inject(LearningService);

  articles = signal<LearningArticle[]>([]);
  loading = signal(true);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  error = signal('');

  form: any = { ...EMPTY_FORM };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.learningService.listAllAdmin().pipe(catchError(() => of({ data: [] }))).subscribe((res) => {
      this.articles.set(res.data);
      this.loading.set(false);
    });
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form = { ...EMPTY_FORM };
    this.showForm.set(true);
  }

  startEdit(a: LearningArticle): void {
    this.editingId.set(a.id);
    this.form = {
      title: a.title, slug: a.slug, category: a.category || '', content: a.content || '',
      coverImage: a.cover_image || '', videoUrl: a.video_url || '', isPublished: a.is_published ?? true,
    };
    this.showForm.set(true);
  }

  submit(ngForm: NgForm): void {
    if (ngForm.invalid) return;
    this.saving.set(true);
    this.error.set('');

    const id = this.editingId();
    const request = id ? this.learningService.update(id, this.form) : this.learningService.create(this.form);
    request.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.showForm.set(false);
        if (id) {
          this.articles.update((list) => list.map((a) => (a.id === id ? result : a)));
        } else {
          this.articles.update((list) => [result, ...list]);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error || 'Could not save article.');
      },
    });
  }

  remove(a: LearningArticle): void {
    this.learningService.delete(a.id).subscribe(() => {
      this.articles.update((list) => list.filter((x) => x.id !== a.id));
    });
  }
}
