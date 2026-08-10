import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

export interface ProfileCardData {
  id: string;
  full_name?: string;
  professional_name?: string;
  profile_photo_url?: string;
  country?: string;
  city?: string;
  availability?: string;
  custom_url?: string;
  membership?: string;
  is_verified?: boolean;
  category_slug?: string;
  category_name?: string;
  spotlight_label?: string;
}

@Component({
  selector: 'app-profile-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './profile-card.component.html',
  styleUrl: './profile-card.component.scss',
})
export class ProfileCardComponent {
  @Input({ required: true }) profile!: ProfileCardData;
  @Input() index = 0;

  constructor(private api: ApiService) {}

  get link(): string {
    return this.profile.custom_url || this.profile.id;
  }

  get displayName(): string {
    return this.profile.professional_name || this.profile.full_name || 'BOOK\'D Creative';
  }

  get photo(): string {
    return this.api.assetUrl(this.profile.profile_photo_url) || '';
  }

  get initials(): string {
    const name = this.displayName;
    return name
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
