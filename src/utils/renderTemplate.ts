import ejs from "ejs";

/** Render template using EJS with variables. Supports {{key}} syntax. */
export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return ejs.render(template, vars, { delimiter: "?" });
}
