import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { TestimonialService } from '../../core/services/testimonial.service';
import { Testimonial } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';

const EMPTY_FORM = {
  authorName: '', authorRole: '', authorPhoto: '', content: '', rating: 5, isPublished: true,
};

@Component({
  selector: 'app-admin-testimonials',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingScreenComponent, AnimatedButtonComponent, SelectComponent],
  templateUrl: './admin-testimonials.component.html',
  styleUrl: './admin-testimonials.component.scss',
})
export class AdminTestimonialsComponent implements OnInit {
  private testimonialService = inject(TestimonialService);

  ratingOptions: SelectOption[] = [5, 4, 3, 2, 1].map((n) => ({
    value: String(n),
    label: `${n} stars`,
  }));

  testimonials = signal<Testimonial[]>([]);
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
    this.testimonialService.listAllAdmin().pipe(catchError(() => of({ data: [] }))).subscribe((res) => {
      this.testimonials.set(res.data);
      this.loading.set(false);
    });
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form = { ...EMPTY_FORM };
    this.showForm.set(true);
  }

  startEdit(t: Testimonial): void {
    this.editingId.set(t.id);
    this.form = {
      authorName: t.author_name, authorRole: t.author_role || '', authorPhoto: t.author_photo || '',
      content: t.content, rating: t.rating || 5, isPublished: t.is_published ?? true,
    };
    this.showForm.set(true);
  }

  submit(ngForm: NgForm): void {
    if (ngForm.invalid) return;
    this.saving.set(true);
    this.error.set('');

    const payload = { ...this.form, rating: Number(this.form.rating) || 5 };
    const id = this.editingId();
    const request = id ? this.testimonialService.update(id, payload) : this.testimonialService.create(payload);
    request.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.showForm.set(false);
        if (id) {
          this.testimonials.update((list) => list.map((t) => (t.id === id ? result : t)));
        } else {
          this.testimonials.update((list) => [result, ...list]);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error || 'Could not save testimonial.');
      },
    });
  }

  remove(t: Testimonial): void {
    this.testimonialService.delete(t.id).subscribe(() => {
      this.testimonials.update((list) => list.filter((x) => x.id !== t.id));
    });
  }
}
