import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';

import { MessageService } from '../../core/services/message.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Conversation, Message } from '../../core/models';
import { DashboardNavComponent } from './dashboard-nav.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-dashboard-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardNavComponent, LoadingScreenComponent],
  templateUrl: './dashboard-messages.component.html',
  styleUrl: './dashboard-messages.component.scss',
})
export class DashboardMessagesComponent implements OnInit {
  private messageService = inject(MessageService);
  private alerts = inject(AlertService);
  private route = inject(ActivatedRoute);
  auth = inject(AuthService);
  api = inject(ApiService);

  conversations = signal<Conversation[]>([]);
  activeConversation = signal<Conversation | null>(null);
  messages = signal<Message[]>([]);
  loadingConversations = signal(true);
  loadingMessages = signal(false);
  draft = '';
  sending = signal(false);
  error = signal('');

  ngOnInit(): void {
    const withId = this.route.snapshot.queryParamMap.get('with');
    const bookingId = this.route.snapshot.queryParamMap.get('booking');

    if (withId) {
      this.messageService.getOrCreateConversation(withId).subscribe({
        next: (created) => this.loadConversations(created.id, bookingId),
        error: () => {
          this.error.set('Could not start a conversation with this profile.');
          this.loadConversations(undefined, bookingId);
        },
      });
      return;
    }

    this.loadConversations(undefined, bookingId);
  }

  private loadConversations(openId?: string, bookingId?: string | null): void {
    this.messageService.listConversations()
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((res) => {
        this.conversations.set(res.data);
        this.loadingConversations.set(false);

        const preselect = openId
          ? res.data.find((c) => c.id === openId)
          : bookingId
            ? res.data.find((c) => c.booking_id === bookingId)
            : res.data[0];
        if (preselect) this.openConversation(preselect);
      });
  }

  openConversation(conv: Conversation): void {
    this.activeConversation.set(conv);
    this.loadingMessages.set(true);
    this.messageService.listMessages(conv.id, { limit: 100 })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        this.messages.set(res.data);
        this.loadingMessages.set(false);
        this.messageService.markRead(conv.id).subscribe({
          next: () => this.alerts.refresh(),
        });
      });
  }

  send(): void {
    const body = this.draft.trim();
    const conv = this.activeConversation();
    if (!body || !conv) return;

    this.sending.set(true);
    this.messageService.send(conv.id, body).subscribe({
      next: (msg) => {
        this.messages.update((list) => [...list, msg]);
        this.draft = '';
        this.sending.set(false);
      },
      error: () => this.sending.set(false),
    });
  }

  isMine(msg: Message): boolean {
    return msg.sender_id === this.auth.user()?.id;
  }

  otherParticipant(conv: Conversation): string {
    return conv.participants[0]?.professional_name || conv.participants[0]?.full_name || 'Unknown';
  }

  bookingLabel(conv: Conversation): string {
    if (!conv.booking_id && !conv.booking_date && !conv.booking_location) return '';
    const parts: string[] = [];
    if (conv.booking_date) {
      const d = new Date(conv.booking_date);
      parts.push(
        Number.isNaN(d.getTime())
          ? String(conv.booking_date)
          : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      );
    }
    if (conv.booking_time) parts.push(this.formatTime(conv.booking_time));
    const hours = Number(conv.booking_hours);
    if (hours) parts.push(hours === 1 ? '1 hour' : `${hours} hours`);
    if (conv.booking_location) parts.push(conv.booking_location);
    return parts.join(' · ');
  }

  private formatTime(value: string): string {
    const match = String(value).match(/^(\d{1,2}):(\d{2})/);
    if (!match) return String(value);
    const hour = Number(match[1]);
    const minute = match[2];
    const suffix = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${minute} ${suffix}`;
  }
}
