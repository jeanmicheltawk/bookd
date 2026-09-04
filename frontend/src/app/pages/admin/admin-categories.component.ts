import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { Category, CategoryField, CategoryFieldType } from '../../core/models';
import { CategoryService, sortCategoryFields } from '../../core/services/category.service';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingScreenComponent, SelectComponent],
  templateUrl: './admin-categories.component.html',
  styleUrl: './admin-categories.component.scss',
})
export class AdminCategoriesComponent implements OnInit {
  private categoriesApi = inject(CategoryService);

  categories = signal<Category[]>([]);
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  selectedId = signal<string | null>(null);

  selected = computed(() => {
    const id = this.selectedId();
    return this.categories().find((c) => c.id === id) || null;
  });

  newCategory = { name: '', slug: '' };

  fieldDraft = {
    label: '',
    field_key: '',
    field_type: 'text' as CategoryFieldType,
    optionsText: '',
    is_required: false,
  };

  fieldTypes: CategoryFieldType[] = ['text', 'number', 'dropdown', 'textarea'];
  fieldTypeOptions: SelectOption[] = this.fieldTypes.map((t) => ({ value: t, label: t }));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.categoriesApi
      .list()
      .pipe(catchError(() => of({ data: [] as Category[] })))
      .subscribe((res) => {
        this.categories.set(
          res.data.map((c) => ({
            ...c,
            fields: sortCategoryFields(c.fields).map((f) => ({
              ...f,
              options: Array.isArray(f.options) ? f.options : [],
            })),
          })),
        );
        if (!this.selectedId() && res.data[0]) {
          this.selectedId.set(res.data[0].id);
        } else if (this.selectedId() && !res.data.some((c) => c.id === this.selectedId())) {
          this.selectedId.set(res.data[0]?.id || null);
        }
        this.loading.set(false);
      });
  }

  select(category: Category): void {
    this.selectedId.set(category.id);
    this.error.set('');
  }

  createCategory(): void {
    if (!this.newCategory.name.trim()) {
      this.error.set('Category name is required.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.categoriesApi.create({
      name: this.newCategory.name.trim(),
      slug: this.newCategory.slug.trim() || undefined,
    }).subscribe({
      next: (created) => {
        this.newCategory = { name: '', slug: '' };
        this.saving.set(false);
        this.categories.update((list) => [...list, { ...created, fields: [] }]);
        this.selectedId.set(created.id);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error || 'Could not create category.');
      },
    });
  }

  deleteCategory(category: Category): void {
    if (!confirm(`Delete category "${category.name}"? This cannot be undone.`)) return;
    this.saving.set(true);
    this.error.set('');
    this.categoriesApi.delete(category.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.categories.update((list) => list.filter((c) => c.id !== category.id));
        if (this.selectedId() === category.id) {
          this.selectedId.set(this.categories()[0]?.id || null);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error || 'Could not delete category.');
      },
    });
  }

  addField(): void {
    const category = this.selected();
    if (!category) return;
    if (!this.fieldDraft.label.trim()) {
      this.error.set('Field label is required.');
      return;
    }

    const options = this.fieldDraft.optionsText
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    this.saving.set(true);
    this.error.set('');
    this.categoriesApi
      .createField(category.id, {
        label: this.fieldDraft.label.trim(),
        field_key: this.fieldDraft.field_key.trim() || undefined,
        field_type: this.fieldDraft.field_type,
        options: this.fieldDraft.field_type === 'dropdown' ? options : [],
        is_required: this.fieldDraft.is_required,
        sort_order: (category.fields || []).length,
      })
      .subscribe({
        next: (field) => {
          this.saving.set(false);
          this.fieldDraft = {
            label: '',
            field_key: '',
            field_type: 'text',
            optionsText: '',
            is_required: false,
          };
          this.categories.update((list) =>
            list.map((c) =>
              c.id === category.id
                ? {
                    ...c,
                    fields: sortCategoryFields([
                      ...(c.fields || []),
                      { ...field, options: field.options || [] },
                    ]),
                  }
                : c,
            ),
          );
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.error || 'Could not add field.');
        },
      });
  }

  removeField(field: CategoryField): void {
    const category = this.selected();
    if (!category) return;
    if (!confirm(`Remove field "${field.label}"?`)) return;

    this.saving.set(true);
    this.error.set('');
    this.categoriesApi.deleteField(category.id, field.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.categories.update((list) =>
          list.map((c) =>
            c.id === category.id
              ? { ...c, fields: (c.fields || []).filter((f) => f.id !== field.id) }
              : c,
          ),
        );
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error || 'Could not remove field.');
      },
    });
  }

  moveField(field: CategoryField, direction: -1 | 1): void {
    const category = this.selected();
    if (!category) return;
    const fields = [...(category.fields || [])];
    const index = fields.findIndex((f) => f.id === field.id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= fields.length) return;

    const swapped = fields[next];
    fields[index] = swapped;
    fields[next] = field;
    this.persistFieldOrder(category.id, fields);
  }

  private persistFieldOrder(categoryId: string, fields: CategoryField[]): void {
    const ordered = fields.map((f, i) => ({ ...f, sort_order: i }));
    this.applyFields(categoryId, ordered);
    this.saving.set(true);
    this.error.set('');
    this.categoriesApi.reorderFields(categoryId, ordered.map((f) => f.id)).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.applyFields(
          categoryId,
          sortCategoryFields(res.data).map((f) => ({
            ...f,
            options: Array.isArray(f.options) ? f.options : [],
          })),
        );
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error || 'Could not reorder fields.');
        this.load();
      },
    });
  }

  private applyFields(categoryId: string, fields: CategoryField[]): void {
    this.categories.update((list) =>
      list.map((c) => (c.id === categoryId ? { ...c, fields } : c)),
    );
  }
}
