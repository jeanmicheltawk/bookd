import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { CreativesOnBoardService } from '../../core/services/creatives-on-board.service';
import { ApiService } from '../../core/services/api.service';
import { CreativesOnBoardItem, SearchResult } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';

@Component({
  selector: 'app-admin-creatives-on-board',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LoadingScreenComponent, AnimatedButtonComponent],
  templateUrl: './admin-creatives-on-board.component.html',
  styleUrl: './admin-creatives-on-board.component.scss',
})
export class AdminCreativesOnBoardComponent implements OnInit {
  private board = inject(CreativesOnBoardService);
  api = inject(ApiService);

  items = signal<CreativesOnBoardItem[]>([]);
  results = signal<SearchResult[]>([]);
  loading = signal(true);
  searching = signal(false);
  pickerOpen = signal(false);
  query = '';
  error = signal('');
  actioningId = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.board.listAdmin().pipe(catchError(() => of({ data: [] }))).subscribe((res) => {
      this.items.set(res.data);
      this.loading.set(false);
    });
  }

  openPicker(): void {
    this.query = '';
    this.error.set('');
    this.pickerOpen.set(true);
    document.body.style.overflow = 'hidden';
    this.search();
  }

  closePicker(): void {
    this.pickerOpen.set(false);
    document.body.style.overflow = '';
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.pickerOpen()) this.closePicker();
  }

  search(): void {
    this.searching.set(true);
    this.error.set('');
    this.board.listCandidates(this.query.trim() || undefined)
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((res) => {
        this.results.set(res.data);
        this.searching.set(false);
      });
  }

  name(p: SearchResult | CreativesOnBoardItem): string {
    return p.professional_name || p.full_name || 'Creative';
  }

  add(profile: SearchResult): void {
    this.actioningId.set(profile.id);
    this.error.set('');
    this.board.add(profile.id).subscribe({
      next: (created) => {
        this.items.update((list) => [...list, created]);
        this.results.update((list) => list.filter((p) => p.id !== profile.id));
        this.actioningId.set(null);
      },
      error: (err) => {
        this.actioningId.set(null);
        this.error.set(err?.error?.error || 'Could not add this creative.');
      },
    });
  }

  move(item: CreativesOnBoardItem, direction: 'up' | 'down'): void {
    this.actioningId.set(item.board_id);
    this.board.move(item.board_id, direction).subscribe({
      next: () => {
        this.actioningId.set(null);
        this.load();
      },
      error: () => this.actioningId.set(null),
    });
  }

  remove(item: CreativesOnBoardItem): void {
    this.actioningId.set(item.board_id);
    this.board.remove(item.board_id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((x) => x.board_id !== item.board_id));
        this.actioningId.set(null);
        if (this.pickerOpen()) this.search();
      },
      error: () => this.actioningId.set(null),
    });
  }
}
