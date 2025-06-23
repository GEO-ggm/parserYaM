import { Page, Locator } from '@playwright/test';

/**
 * Утилита для ожидания загрузки страницы
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * Утилита для скролла к элементу
 */
export async function scrollToElement(locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
}

/**
 * Утилита для заполнения формы
 */
export async function fillForm(page: Page, formData: Record<string, string>): Promise<void> {
  for (const [selector, value] of Object.entries(formData)) {
    await page.fill(selector, value);
  }
}

/**
 * Утилита для ожидания элемента и клика
 */
export async function waitAndClick(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector);
  await page.click(selector);
}

/**
 * Утилита для создания случайной строки
 */
export function generateRandomString(length: number = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Утилита для создания случайного email
 */
export function generateRandomEmail(): string {
  const randomString = generateRandomString(8);
  return `test.${randomString}@example.com`;
} 