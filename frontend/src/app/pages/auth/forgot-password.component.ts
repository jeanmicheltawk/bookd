import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AnimatedButtonComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './login.component.scss',
})
export class ForgotPasswordComponent {
  private auth = inject(AuthService);

  email = '';
  loading = signal(false);
  error = signal('');
  sent = signal(false);

  submit(ngForm: NgForm): void {
    if (ngForm.invalid || this.sent()) return;
    this.loading.set(true);
    this.error.set('');

    this.auth.requestPasswordReset(this.email.trim()).subscribe({
      next: () => {
        this.loading.set(false);
        this.sent.set(true);
      },
      error: (err: { error?: { error?: string } }) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'Could not send a reset link. Try again.');
      },
    });
  }
}
