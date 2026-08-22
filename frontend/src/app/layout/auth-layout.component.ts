import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="auth-shell">
      <div class="auth-shell__visual">
        <a routerLink="/" class="auth-shell__logo">
          <img src="/assets/logo.svg" alt="BOOK'D" />
        </a>
        <h1 class="auth-shell__headline">BOOK AND<br />GET <span class="text-gradient">BOOK'D</span></h1>
        <p class="auth-shell__sub">Where models, talents, photographers, stylists and brands find each other and get to work.</p>
      </div>
      <div class="auth-shell__form">
        <div class="auth-shell__form-inner">
          <router-outlet />
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .auth-shell {
      height: 100dvh;
      max-height: 100dvh;
      overflow: hidden;
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: var(--toxic-orange);

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
        height: auto;
        max-height: none;
        min-height: 100dvh;
        overflow: visible;
      }
    }

    .auth-shell__visual {
      position: relative;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 64px;
      background: var(--uv-purple);
      color: #ffffff;

      @media (max-width: 900px) { padding: 48px 24px; min-height: 280px; }
    }

    .auth-shell__logo {
      display: block;
      width: min(280px, 70%);
      margin-bottom: 40px;
      img { width: 100%; height: auto; }
    }

    .auth-shell__headline {
      font-family: var(--font-campaign);
      font-size: clamp(2.2rem, 5vw, 3.6rem);
      font-weight: 800;
      line-height: 0.9;
      letter-spacing: -0.01em;
      text-transform: uppercase;
    }

    .auth-shell__sub {
      max-width: 420px;
      font-size: 1rem;
      font-weight: 600;
      margin-top: 16px;
      color: #ffffff;
    }

    .auth-shell__form {
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      background: var(--toxic-orange);

      @media (max-width: 900px) {
        overflow: visible;
        height: auto;
      }
    }

    .auth-shell__form-inner {
      width: 100%;
      margin-block: auto;
      display: flex;
      justify-content: center;
      padding: 48px 24px;
    }
  `],
})
export class AuthLayoutComponent {}
