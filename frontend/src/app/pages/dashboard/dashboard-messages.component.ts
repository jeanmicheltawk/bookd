import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';

import { MessageService } from '../../core/services/message.service';
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

  ngOnInit(): void {
    this.messageService.listConversations()
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((res) => {
        this.conversations.set(res.data);
        this.loadingConversations.set(false);

        const bookingId = this.route.snapshot.queryParamMap.get('booking');
        const preselect = bookingId ? res.data.find((c) => c.booking_id === bookingId) : res.data[0];
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
        this.messageService.markRead(conv.id).subscribe();
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
}
