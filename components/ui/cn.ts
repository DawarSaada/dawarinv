/** Joins conditional class names. Deliberately dependency-free. */
export type ClassValue = string | false | null | undefined;

export const cn = (...values: ClassValue[]): string => values.filter(Boolean).join(' ');
