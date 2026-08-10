import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { EventService } from '../../core/services/event.service';
import { EventItem } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-challenges-list',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingScreenComponent],
  templateUrl: './challenges-list.component.html',
  styleUrl: './challenges-list.component.scss',
})
export class ChallengesListComponent implements OnInit {
  private eventService = inject(EventService);

  events = signal<EventItem[]>([]);
  loading = signal(true);
  filterType = signal('');

  filtered(): EventItem[] {
    const type = this.filterType();
    return type ? this.events().filter((e) => e.event_type === type) : this.events();
  }

  ngOnInit(): void {
    this.eventService.list({ limit: 40 })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 40, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        this.events.set(res.data);
        this.loading.set(false);
      });
  }

  isUpcoming(event: EventItem): boolean {
    return !!event.starts_at && new Date(event.starts_at) > new Date();
  }
}
