import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Conversation, Message, Paginated } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class MessageService {
  private api = inject(ApiService);

  listConversations(): Observable<{ data: Conversation[] }> {
    return this.api.get('/messages/conversations');
  }

  getOrCreateConversation(participantId: string, bookingId?: string): Observable<Conversation> {
    return this.api.post('/messages/conversations', { participantId, bookingId });
  }

  listMessages(conversationId: string, params?: QueryParams): Observable<Paginated<Message>> {
    return this.api.get(`/messages/conversations/${conversationId}`, params);
  }

  send(conversationId: string, body: string): Observable<Message> {
    return this.api.post(`/messages/conversations/${conversationId}`, { body });
  }

  markRead(conversationId: string): Observable<{ success: boolean }> {
    return this.api.post(`/messages/conversations/${conversationId}/read`);
  }

  listSaved(): Observable<{ data: Message[] }> {
    return this.api.get('/messages/saved');
  }

  toggleSave(messageId: string, saved: boolean): Observable<Message> {
    return this.api.patch(`/messages/${messageId}/save`, { saved });
  }

  report(messageId: string, reason?: string): Observable<{ success: boolean; message: string }> {
    return this.api.post(`/messages/${messageId}/report`, { reason });
  }
}
