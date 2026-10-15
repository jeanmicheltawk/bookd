import { Component, effect, input, signal } from '@angular/core';

import { vimeoOembedUrl, videoPosterUrl } from '../../../core/utils/portfolio-limit';

@Component({
  selector: 'app-video-cover',
  standalone: true,
  templateUrl: './video-cover.component.html',
  styleUrl: './video-cover.component.scss',
})
export class VideoCoverComponent {
  src = input.required<string>();
  playable = input(false);
  posterUrl = input('');

  poster = signal<string | null>(null);
  private token = 0;

  constructor() {
    effect(() => {
      const url = this.src();
      const playable = this.playable();
      const given = this.posterUrl();
      const token = ++this.token;
      const direct = given || videoPosterUrl(url);
      this.poster.set(direct || null);
      if (playable || direct) return;

      const oembed = vimeoOembedUrl(url);
      if (!oembed) return;
      fetch(oembed)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { thumbnail_url?: string } | null) => {
          if (token !== this.token || !data?.thumbnail_url) return;
          this.poster.set(data.thumbnail_url);
        })
        .catch(() => undefined);
    });
  }

  frameSrc(): string {
    const url = this.src();
    if (!url || /#t=/.test(url)) return url;
    return `${url}#t=0.1`;
  }

  paintFrame(event: Event): void {
    const video = event.target as HTMLVideoElement;
    if (video.dataset['framed'] === '1') return;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const target = duration > 0.3 ? Math.min(0.5, duration * 0.1) : 0.1;
    video.dataset['framed'] = '1';
    if (video.currentTime >= target - 0.05) return;
    try {
      video.currentTime = target;
    } catch {
      /* Seek can fail before the browser has metadata. */
    }
  }
}
