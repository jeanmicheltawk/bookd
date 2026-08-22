import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { AdminUser, AdminUserService } from '../../core/services/admin-user.service';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-admin-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingScreenComponent],
  templateUrl: './admin-clients.component.html',
  styleUrl: './admin-clients.component.scss',
})
export class AdminClientsComponent implements OnInit {
  private usersApi = inject(AdminUserService);

  clients = signal<AdminUser[]>([]);
  total = signal(0);
  loading = signal(true);
  exporting = signal(false);
  search = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.usersApi
      .listClients({ q: this.search.trim() || undefined, limit: 100 })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        this.clients.set(res.data);
        this.total.set(res.pagination.total);
        this.loading.set(false);
      });
  }

  exportExcel(): void {
    this.exporting.set(true);
    this.usersApi.exportClientsExcel().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bookd-clients.xls';
        a.click();
        window.URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => this.exporting.set(false),
    });
  }
}
