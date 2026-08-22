import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { EventService } from '../../core/services/event.service';
import { EventItem } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';

const EMPTY_FORM = {
  title: '', slug: '', description: '', eventType: 'challenge',
  coverImage: '', startsAt: '', endsAt: '', prize: '', isPublished: true,
};

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingScreenComponent, AnimatedButtonComponent, SelectComponent],
  templateUrl: './admin-events.component.html',
  styleUrl: './admin-events.component.scss',
})
export class AdminEventsComponent implements OnInit {
  private eventService = inject(EventService);

  eventTypeOptions: SelectOption[] = [
    { value: 'challenge', label: 'Challenge' },
    { value: 'event', label: 'Event' },
    { value: 'workshop', label: 'Workshop' },
  ];

  events = signal<EventItem[]>([]);
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
    this.eventService.listAllAdmin().pipe(catchError(() => of({ data: [] }))).subscribe((res) => {
      this.events.set(res.data);
      this.loading.set(false);
    });
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form = { ...EMPTY_FORM };
    this.showForm.set(true);
  }

  startEdit(e: EventItem): void {
    this.editingId.set(e.id);
    this.form = {
      title: e.title, slug: e.slug, description: e.description || '', eventType: e.event_type,
      coverImage: e.cover_image || '', startsAt: e.starts_at?.slice(0, 10) || '', endsAt: e.ends_at?.slice(0, 10) || '',
      prize: e.prize || '', isPublished: e.is_published ?? true,
    };
    this.showForm.set(true);
  }

  submit(ngForm: NgForm): void {
    if (ngForm.invalid) return;
    this.saving.set(true);
    this.error.set('');

    const id = this.editingId();
    const request = id ? this.eventService.update(id, this.form) : this.eventService.create(this.form);
    request.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.showForm.set(false);
        if (id) {
          this.events.update((list) => list.map((e) => (e.id === id ? result : e)));
        } else {
          this.events.update((list) => [result, ...list]);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error || 'Could not save event.');
      },
    });
  }

  remove(e: EventItem): void {
    this.eventService.delete(e.id).subscribe(() => {
      this.events.update((list) => list.filter((x) => x.id !== e.id));
    });
  }
}
