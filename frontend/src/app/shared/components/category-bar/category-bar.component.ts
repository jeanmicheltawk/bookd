import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../core/models';

@Component({
  selector: 'app-category-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './category-bar.component.html',
  styleUrl: './category-bar.component.scss',
})
export class CategoryBarComponent implements OnInit {
  private categoryService = inject(CategoryService);

  categories = signal<Category[]>([]);

  ngOnInit(): void {
    this.categoryService.list().subscribe({
      next: (res) => this.categories.set(res.data),
      error: () => this.categories.set([]),
    });
  }
}
