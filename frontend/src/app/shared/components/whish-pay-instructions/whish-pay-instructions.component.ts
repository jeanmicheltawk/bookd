import { Component, Input, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnimatedButtonComponent } from '../animated-button/animated-button.component';
import { WhishSandboxTest } from '../../../core/models';

@Component({
  selector: 'app-whish-pay-instructions',
  standalone: true,
  imports: [CommonModule, RouterLink, AnimatedButtonComponent],
  template: `
    <div class="whish-box">
      <span class="whish-box__label">How to pay</span>
      <h3>Whish Pay</h3>
      <p class="whish-box__lead">
        Pay <strong>{{ amount | currency: currency:'symbol':'1.2-2' }}</strong>
        @if (planLabel) { for your {{ planLabel }} }
        from your Whish balance. You'll be sent to a Whish page to confirm.
      </p>

      @if (sandbox && sandboxTest) {
        <div class="whish-sandbox">
          <span>Sandbox test values</span>
          <p>Phone <strong>{{ sandboxTest.phone }}</strong> · OTP <strong>{{ sandboxTest.otp }}</strong></p>
        </div>
      }

      <ol class="pay-steps">
        <li>
          <span>1</span>
          <p>Tap <strong>Pay with Whish</strong> to open the hosted payment page.</p>
        </li>
        <li>
          <span>2</span>
          <p>Confirm the amount from your Whish balance. Whish sends a one-time code in the app.</p>
        </li>
        @if (requireLogin()) {
          <li>
            <span>3</span>
            <p>Log in first, then open the <strong>Pay</strong> tab to start checkout.</p>
          </li>
        } @else {
          <li>
            <span>3</span>
            <p>You'll come back here after Whish confirms. Your trial still starts when an admin approves your profile.</p>
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

    .whish-sandbox {
      padding: 12px 14px;
      margin-bottom: 16px;
      background: var(--acid-lime);
      color: var(--ink-black);

      span {
        display: block;
        font-size: 0.68rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin-bottom: 4px;
      }

      p { margin: 0; font-size: 0.88rem; }
    }

    .pay-steps {
      margin: 0;
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
  @Input() showCta = false;
  @Input() sandbox = false;
  @Input() sandboxTest: WhishSandboxTest | null = null;
  requireLogin = input(false);
}
