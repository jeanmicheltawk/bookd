import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { CmsService } from '../../core/services/cms.service';
import { Page, Section } from '../../core/models';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

const KNOWN_PAGES = ['home', 'about', 'pricing', 'contact', 'discover', 'learn'];

interface SectionDraft extends Section {
  contentJson: string;
  jsonError?: string;
}

@Component({
  selector: 'app-admin-content',
  standalone: true,
  imports: [CommonModule, FormsModule, AnimatedButtonComponent, LoadingScreenComponent],
  templateUrl: './admin-content.component.html',
  styleUrl: './admin-content.component.scss',
})
export class AdminContentComponent implements OnInit {
  private cms = inject(CmsService);

  knownPages = KNOWN_PAGES;
  activeSlug = signal('home');
  page = signal<Page | null>(null);
  sections = signal<SectionDraft[]>([]);
  loading = signal(true);
  notFound = signal(false);
  savingPage = signal(false);
  savingSectionId = signal<string | null>(null);
  pageSaved = signal(false);

  ngOnInit(): void {
    this.loadPage(this.activeSlug());
  }

  selectPage(slug: string): void {
    this.activeSlug.set(slug);
    this.loadPage(slug);
  }

  loadPage(slug: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.pageSaved.set(false);

    this.cms.getPage(slug)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (!res) {
          this.notFound.set(true);
          this.page.set(null);
          this.sections.set([]);
        } else {
          this.page.set(res);
          this.sections.set(
            res.sections.map((s) => ({ ...s, contentJson: JSON.stringify(s.content ?? {}, null, 2) })),
          );
        }
        this.loading.set(false);
      });
  }

  savePage(): void {
    const p = this.page();
    if (!p) return;
    this.savingPage.set(true);
    this.cms.updatePage(p.slug, {
      title: p.title,
      meta_title: p.meta_title,
      meta_description: p.meta_description,
      is_published: p.is_published,
    }).subscribe({
      next: (updated) => {
        this.page.update((cur) => (cur ? { ...cur, ...updated } : cur));
        this.savingPage.set(false);
        this.pageSaved.set(true);
      },
      error: () => this.savingPage.set(false),
    });
  }

  saveSection(section: SectionDraft): void {
    let parsedContent: any = {};
    try {
      parsedContent = section.contentJson.trim() ? JSON.parse(section.contentJson) : {};
      section.jsonError = undefined;
    } catch {
      section.jsonError = 'Invalid JSON — fix before saving.';
      return;
    }

    this.savingSectionId.set(section.id);
    this.cms.updateSection(section.id, {
      title: section.title,
      subtitle: section.subtitle,
      content: parsedContent,
      media_url: section.media_url,
      cta_label: section.cta_label,
      cta_url: section.cta_url,
      sort_order: section.sort_order,
      is_visible: section.is_visible,
    }).subscribe({
      next: (updated) => {
        this.sections.update((list) =>
          list.map((s) => (s.id === section.id ? { ...s, ...updated, contentJson: JSON.stringify(updated.content ?? {}, null, 2) } : s)),
        );
        this.savingSectionId.set(null);
      },
      error: () => this.savingSectionId.set(null),
    });
  }
}
