import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, AnimatedButtonComponent],
  template: `
    <section class="nf">
      <h1 class="nf__code text-gradient">404</h1>
      <h2>THIS PAGE GOT <span class="text-gradient-acid">UNBOOK'D</span></h2>
      <p>The page you're looking for doesn't exist, moved, or never got BOOK'D in the first place.</p>
      <app-animated-button routerLink="/" variant="primary" size="lg">Back to Home</app-animated-button>
    </section>
  `,
  styles: [`
    .nf {
      min-height: 70vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 80px 24px;
      gap: 16px;
    }
    .nf__code {
      font-family: var(--font-campaign);
      font-size: clamp(6rem, 20vw, 12rem);
      font-weight: 900;
      line-height: 0.9;
      letter-spacing: -0.02em;
      text-transform: uppercase;
    }
    .nf h2 { text-transform: uppercase; font-size: clamp(1.4rem, 4vw, 2.2rem); }
    .nf p { max-width: 480px; margin-bottom: 12px; }
  `],
})
export class NotFoundComponent {}
