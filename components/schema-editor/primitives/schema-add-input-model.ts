export interface SchemaAddInputModel {
  error?: string | null;
  focusAfterSubmit?: boolean;
  inputLabel: string;
  placeholder: string;
  submitLabel: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}
