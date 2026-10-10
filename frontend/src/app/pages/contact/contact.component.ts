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

  submit(ngForm: NgForm): void {
    if (ngForm.invalid) return;
    this.sending.set(true);
    this.error.set('');

    this.contactService.send(this.form).subscribe({
      next: () => {
        this.sending.set(false);
        this.sent.set(true);
        ngForm.resetForm();
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(err?.error?.error || 'Something went wrong. Please try again.');
      },
    });
  }
}
