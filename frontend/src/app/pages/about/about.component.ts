import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, AnimatedButtonComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  values = [
    { title: 'BOLD BY DEFAULT', copy: 'We built a platform that looks and feels like the creatives who use it — loud, confident, unmistakable.' },
    { title: 'ZERO GATEKEEPING', copy: 'Direct connections between talent and brands. No black-box algorithms deciding who gets seen.' },
    { title: 'SAFETY FIRST', copy: 'Verified badges, moderated announcements, and a reporting system that actually gets reviewed.' },
    { title: 'GROWTH-OBSESSED', copy: 'Performance scores, spotlight rotations, and challenges engineered to get you discovered faster.' },
  ];

  timeline = [
    { year: '2023', title: 'The Idea', copy: 'Frustrated with clunky, corporate casting tools, we sketched BOOK\'D on a napkin.' },
    { year: '2024', title: 'The Build', copy: 'Months of late nights, neon mood boards, and way too much coffee.' },
    { year: '2025', title: 'The Launch', copy: 'BOOK\'D HAUS goes live — bold, loud, and ready to shake up the industry.' },
    { year: 'NOW', title: 'The Movement', copy: 'Thousands of creatives and brands getting BOOK\'D every single day.' },
  ];
}
