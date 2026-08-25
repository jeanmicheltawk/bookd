import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AnimatedButtonComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form = { email: '', password: '' };
  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  submit(ngForm: NgForm): void {
    if (ngForm.invalid) return;
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.form).subscribe({
      next: (res) => {
        this.loading.set(false);
        const redirect = this.route.snapshot.queryParamMap.get('redirect');
        if (redirect) {
          this.router.navigateByUrl(redirect);
          return;
        }
        this.router.navigateByUrl(res.user?.role === 'admin' ? '/admin' : '/dashboard');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'Invalid email or password.');
      },
    });
  }
}
