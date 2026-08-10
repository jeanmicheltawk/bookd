import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="auth-shell">
      <div class="auth-shell__visual">
        <a routerLink="/" class="auth-shell__logo">BK<span class="accent">'D</span></a>
        <h1 class="auth-shell__headline">BOOK AND<br />GET <span class="text-gradient">BOOK'D</span></h1>
        <p class="auth-shell__sub">Where models, talents, photographers, stylists and brands find each other and get to work.</p>
        <div class="auth-shell__orb orb-1"></div>
        <div class="auth-shell__orb orb-2"></div>
      </div>
      <div class="auth-shell__form">
        <router-outlet />
      </div>
    </div>
  `,
  styles: [`
    .auth-shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1fr 1fr;

      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    .auth-shell__visual {
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 64px;
      background: radial-gradient(circle at 30% 20%, rgba(143,0,255,0.35), transparent 55%),
                  radial-gradient(circle at 80% 80%, rgba(0,245,255,0.25), transparent 50%),
                  var(--surface-0);

      @media (max-width: 900px) { padding: 48px 24px; min-height: 280px; }
    }

    .auth-shell__logo {
      font-family: var(--font-display);
      font-size: 2rem;
      font-weight: 800;
      margin-bottom: 40px;
      z-index: 1;
      .accent {
        background: var(--gradient-neon);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
      }
    }

    .auth-shell__headline {
      font-size: clamp(2.2rem, 5vw, 3.6rem);
      z-index: 1;
      text-transform: uppercase;
    }

    .auth-shell__sub {
      max-width: 420px;
      z-index: 1;
      font-size: 1rem;
      margin-top: 16px;
    }

    .auth-shell__orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(60px);
      opacity: 0.5;
    }
    .orb-1 { width: 280px; height: 280px; background: var(--bkd-acid-lime); top: -80px; right: -60px; animation: float 8s ease-in-out infinite; }
    .orb-2 { width: 200px; height: 200px; background: var(--bkd-hyper-pink); bottom: -60px; left: 10%; animation: float-slow 10s ease-in-out infinite; }

    .auth-shell__form {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      background: var(--color-background);
    }
  `],
})
export class AuthLayoutComponent {}
