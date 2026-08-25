import { Component, Input, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnimatedButtonComponent } from '../animated-button/animated-button.component';

@Component({
  selector: 'app-whish-pay-instructions',
  standalone: true,
  imports: [CommonModule, RouterLink, AnimatedButtonComponent],
  template: `
    <div class="whish-box">
      <span class="whish-box__label">How to pay</span>
      <h3>Whish to Whish</h3>
      <p class="whish-box__lead">
        Send <strong>{{ amount | currency: currency:'symbol':'1.2-2' }}</strong>
        @if (planLabel) { for your {{ planLabel }} }
        to this Whish number, and put your reference in the transfer note.
      </p>

      <div class="whish-row">
        <div>
          <span>Send to</span>
          <strong>{{ recipient }}</strong>
        </div>
        <button type="button" (click)="copy(recipient, 'number')">
          {{ copied() === 'number' ? 'Copied' : 'Copy number' }}
        </button>
      </div>

      @if (reference) {
        <div class="whish-row whish-row--ref">
          <div>
            <span>Transfer note / reference</span>
            <strong>{{ reference }}</strong>
          </div>
          <button type="button" (click)="copy(reference, 'ref')">
            {{ copied() === 'ref' ? 'Copied' : 'Copy reference' }}
          </button>
        </div>
      }

      <ol class="pay-steps">
        <li>
          <span>1</span>
          <p>Open the Whish app and choose <strong>Whish to Whish</strong>.</p>
        </li>
        <li>
          <span>2</span>
          <p>Send <strong>{{ amount | currency: currency:'symbol':'1.2-2' }}</strong> to <strong>{{ recipient }}</strong>.</p>
        </li>
        <li>
          <span>3</span>
          @if (reference) {
            <p>Put <strong>{{ reference }}</strong> in the transfer note. We use this to match your payment.</p>
          } @else {
            <p>After you log in, your Pay page will show a unique reference to put in the transfer note.</p>
          }
        </li>
        @if (requireLogin()) {
          <li>
            <span>4</span>
            <p>Log in to your account, then open the <strong>Pay</strong> tab in your dashboard.</p>
          </li>
          <li>
            <span>5</span>
            <p>Enter the Whish number you sent from, then tap <strong>I sent the payment</strong>.</p>
          </li>
        } @else {
          <li>
            <span>4</span>
            <p>Open the <strong>Pay</strong> tab, enter the Whish number you sent from, then tap <strong>I sent the payment</strong>.</p>
          </li>
        }
      </ol>

      @if (showCta) {
        <app-animated-button routerLink="/dashboard/pay" variant="primary" [fullWidth]="true">
          Open Pay page
        </app-animated-button>
      }
    </div>
  `,
  styles: [`
    .whish-box {
      text-align: left;
      padding: 24px;
      border: 1px solid currentColor;
    }

    .whish-box__label {
      display: block;
      font-size: 0.72rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--text);
      margin-bottom: 8px;
    }

    h3 {
      margin: 0 0 10px;
      font-size: 1.15rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .whish-box__lead {
      margin: 0 0 18px;
      font-size: 0.92rem;
      line-height: 1.5;
      color: var(--text);
    }

    .whish-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 14px 0;
      border-top: 1px solid currentColor;

      span {
        display: block;
        font-size: 0.7rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text);
        margin-bottom: 4px;
      }

      strong {
        font-size: 1.15rem;
        letter-spacing: 0.04em;
      }

      button {
        flex-shrink: 0;
        padding: 8px 12px;
        background: transparent;
        border: 1px solid currentColor;
        color: inherit;
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        cursor: pointer;
      }

      &--ref {
        background: var(--acid-lime);
        color: var(--ink-black);
        border-color: var(--acid-lime);
        margin: 0 -24px;
        padding: 16px 24px;
        span { color: var(--ink-black); }
      }
    }

    .pay-steps {
      margin: 18px 0 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
      text-align: left;

      li {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      span {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--acid-lime);
        color: var(--ink-black);
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0;
        text-transform: none;
        margin: 0;
      }

      p {
        margin: 4px 0 0;
        font-size: 0.9rem;
        line-height: 1.45;
        color: inherit;
      }
    }

    app-animated-button { display: block; margin-top: 20px; }
  `],
})
export class WhishPayInstructionsComponent {
  @Input() amount = 6.99;
  @Input() currency = 'USD';
  @Input() planLabel = '';
  @Input() recipient = '+961 3 177 655';
  @Input() reference = '';
  @Input() showCta = false;
  requireLogin = input(false);

  copied = signal('');

  async copy(value: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copied.set(key);
      setTimeout(() => {
        if (this.copied() === key) this.copied.set('');
      }, 1600);
    } catch {
      /* ignore */
    }
  }
}
