import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ContactService } from '../../core/services/contact.service';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { buildPortfolioWhatsappUrl } from '../../core/utils/bookd-whatsapp';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, AnimatedButtonComponent],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent {
  private contactService = inject(ContactService);

  form = { name: '', email: '', subject: '', message: '' };
  sending = signal(false);
  sent = signal(false);
  error = signal('');
  readonly buildPortfolioUrl = buildPortfolioWhatsappUrl();

  attempted = signal(false);

  showError(ngForm: NgForm, controlName: string): boolean {
    const control = ngForm.controls[controlName];
    return this.attempted() && !!control && control.invalid;
  }

  submit(ngForm: NgForm): void {
    if (this.sending()) return;
    this.attempted.set(true);
    this.error.set('');
    ngForm.control.markAllAsTouched();

    if (ngForm.invalid) {
      this.error.set('Fill in your name, a valid email, and a message of at least 10 characters.');
      return;
    }

    this.sending.set(true);
    this.contactService.send({
      name: this.form.name.trim(),
      email: this.form.email.trim(),
      subject: this.form.subject.trim(),
      message: this.form.message.trim(),
    }).subscribe({
      next: () => {
        this.sending.set(false);
        this.sent.set(true);
        this.attempted.set(false);
        this.form = { name: '', email: '', subject: '', message: '' };
        ngForm.resetForm();
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(err?.error?.error || 'Something went wrong. Please try again.');
      },
    });
  }
}
