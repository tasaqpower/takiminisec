export type FormFieldType =
  | "text"
  | "multiline"
  | "checkbox"
  | "radio"
  | "dropdown"
  | "date"
  | "signature";

export interface FormFieldItem {
  id: string;
  page: number; // 0-indexed
  type: FormFieldType;
  name: string;
  label?: string;
  value: string | boolean;
  defaultValue?: string | boolean;
  options?: string[]; // for dropdown or radio
  required?: boolean;
  readOnly?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}
