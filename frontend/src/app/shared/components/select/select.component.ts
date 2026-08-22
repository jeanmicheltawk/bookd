import {
  Component,
  ElementRef,
  HostListener,
  Input,
  booleanAttribute,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
}

export function selectOptions(
  items: Array<string | SelectOption>,
  emptyLabel?: string,
): SelectOption[] {
  const mapped = items.map((item) =>
    typeof item === 'string' ? { value: item, label: item } : item,
  );
  return emptyLabel != null ? [{ value: '', label: emptyLabel }, ...mapped] : mapped;
}

@Component({
  selector: 'app-select',
  standalone: true,
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => SelectComponent), multi: true },
  ],
  host: { class: 'bkd-select-host' },
})
export class SelectComponent implements ControlValueAccessor, Validator {
  private host = inject(ElementRef<HTMLElement>);

  @Input() options: SelectOption[] = [];
  @Input() placeholder = '';
  @Input({ transform: booleanAttribute }) required = false;
  @Input({ transform: booleanAttribute }) disabled = false;

  value = signal('');
  open = signal(false);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | number | null): void {
    this.value.set(value == null ? '' : String(value));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  validate(): ValidationErrors | null {
    if (this.required && !this.value()) return { required: true };
    return null;
  }

  displayLabel(): string {
    const current = this.value();
    const match = this.options.find((opt) => opt.value === current);
    if (match) return match.label;
    return this.placeholder || current;
  }

  isPlaceholder(): boolean {
    const current = this.value();
    if (!current) return true;
    return !this.options.some((opt) => opt.value === current);
  }

  toggle(): void {
    if (this.disabled) return;
    this.open.update((open) => !open);
    this.onTouched();
  }

  choose(opt: SelectOption): void {
    this.value.set(opt.value);
    this.onChange(opt.value);
    this.open.set(false);
    this.onTouched();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}
