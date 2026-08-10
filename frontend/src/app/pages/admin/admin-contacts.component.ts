import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';

import { ContactService } from '../../core/services/contact.service';
import { ContactMessage } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-admin-contacts',
  standalone: true,
  imports: [CommonModule, LoadingScreenComponent],
  templateUrl: './admin-contacts.component.html',
  styleUrl: './admin-contacts.component.scss',
})
export class AdminContactsComponent implements OnInit {
  private contactService = inject(ContactService);

  messages = signal<ContactMessage[]>([]);
  loading = signal(true);
  activeStatus = signal('');
  activeMessage = signal<ContactMessage | null>(null);
  exporting = signal(false);

  statuses: ContactMessage['status'][] = ['new', 'read', 'replied', 'archived'];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.contactService.list({ status: this.activeStatus(), limit: 50 })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        this.messages.set(res.data);
        this.loading.set(false);
      });
  }

  filterByStatus(status: string): void {
    this.activeStatus.set(status);
    this.load();
  }

  open(msg: ContactMessage): void {
    this.activeMessage.set(msg);
    if (msg.status === 'new') this.updateStatus(msg, 'read');
  }

  updateStatus(msg: ContactMessage, status: ContactMessage['status']): void {
    this.contactService.updateStatus(msg.id, status).subscribe((updated) => {
      this.messages.update((list) => list.map((m) => (m.id === updated.id ? updated : m)));
      if (this.activeMessage()?.id === updated.id) this.activeMessage.set(updated);
    });
  }

  remove(msg: ContactMessage): void {
    this.contactService.delete(msg.id).subscribe(() => {
      this.messages.update((list) => list.filter((m) => m.id !== msg.id));
      if (this.activeMessage()?.id === msg.id) this.activeMessage.set(null);
    });
  }

  exportCsv(): void {
    this.exporting.set(true);
    this.contactService.exportCsv().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contact_messages.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => this.exporting.set(false),
    });
  }
}
