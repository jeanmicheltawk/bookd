import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { buildPortfolioWhatsappUrl } from './core/utils/bookd-whatsapp';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private themeService = inject(ThemeService);
  readonly buildPortfolioUrl = buildPortfolioWhatsappUrl();

  ngOnInit(): void {
    this.themeService.loadTheme().subscribe();
  }
}
