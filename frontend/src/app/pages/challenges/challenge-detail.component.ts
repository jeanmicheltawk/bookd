import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { EventService } from '../../core/services/event.service';
import { EventItem } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';

@Component({
  selector: 'app-challenge-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingScreenComponent, AnimatedButtonComponent],
  templateUrl: './challenge-detail.component.html',
  styleUrl: './challenge-detail.component.scss',
})
export class ChallengeDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);

  event = signal<EventItem | null>(null);
  loading = signal(true);
  notFound = signal(false);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.eventService.get(slug)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (!res) this.notFound.set(true);
        this.event.set(res);
        this.loading.set(false);
      });
  }
}
