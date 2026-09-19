import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AnimatedButtonComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './login.component.scss',
})
export class ResetPasswordComponent {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  token = this.route.snapshot.queryParamMap.get('token') || '';
  form = { password: '', confirm: '' };
  loading = signal(false);
  error = signal(this.token ? '' : 'This reset link is missing or invalid.');
  done = signal(false);
  showPassword = signal(false);

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  submit(ngForm: NgForm): void {
    if (!this.token || this.done()) return;
    if (ngForm.invalid) return;
    if (this.form.password !== this.form.confirm) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.auth.confirmPasswordReset(this.token, this.form.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.done.set(true);
      },
      error: (err: { error?: { error?: string } }) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'This reset link is invalid or has expired.');
      },
    });
  }
}
