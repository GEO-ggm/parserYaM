import { chromium, Browser, Page } from '@playwright/test';
import { yandexMapsConfig, YANDEX_MAPS_SELECTORS } from '../config/yandex-maps.config';
import * as fs from 'fs';
import * as path from 'path';

interface ClubData {
  name: string;
  address: string;
  index: number;
}

interface ScrapingResult {
  totalFound: number;
  clubs: ClubData[];
  timestamp: string;
  sourceUrl: string;
}

export class ClubsScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private results: ClubData[] = [];

  async init() {
    this.browser = await chromium.launch({ 
      headless: false, // Показываем браузер для отладки
      timeout: 60000 
    });
    this.page = await this.browser.newPage();
    
    // Устанавливаем русский язык и увеличиваем viewport
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'ru-RU,ru;q=0.9'
    });
    
    await this.page.setViewportSize({ width: 1920, height: 1080 });
  }

  async scrapeClubs(maxResults: number = 8000): Promise<ScrapingResult> {
    if (!this.page) {
      throw new Error('Scraper not initialized');
    }

    console.log('🚀 Начинаем сбор данных о клубах...');
    console.log(`📍 URL: ${yandexMapsConfig.startUrl}`);
    console.log(`🎯 Максимум результатов: ${maxResults}\n`);

    try {
      // Переходим на страницу поиска
      await this.page.goto(yandexMapsConfig.startUrl, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      console.log('⏳ Ждем загрузки результатов поиска...');
      
      // Ждем появления результатов поиска
      await this.page.waitForSelector(YANDEX_MAPS_SELECTORS.nameClub, { 
        timeout: 15000 
      });

      console.log('✅ Результаты поиска загружены');

      // Прокручиваем страницу для загрузки большего количества результатов
      await this.scrollToLoadMore(maxResults);

      // Собираем данные о клубах
      console.log('📊 Собираем данные о клубах...');
      const clubs = await this.extractClubsData(maxResults);

      const result: ScrapingResult = {
        totalFound: clubs.length,
        clubs: clubs,
        timestamp: new Date().toISOString(),
        sourceUrl: yandexMapsConfig.startUrl
      };

      console.log(`\n🎉 Собрано ${clubs.length} клубов`);
      return result;

    } catch (error) {
      console.error('❌ Ошибка при сборе данных:', error);
      throw error;
    }
  }

  private async scrollToLoadMore(targetCount: number) {
    if (!this.page) return;

    console.log('📜 Прокручиваем страницу для загрузки дополнительных результатов...');
    
    let lastCount = 0;
    let stableCount = 0;
    let noChangeCount = 0;
    const MAX_NO_CHANGE = 2; // Максимальное количество итераций без изменений
    
    for (let i = 0; i < MAX_NO_CHANGE; i++) { 
      // Прокручиваем вниз
      await this.page.evaluate(() => {
        const searchResults = document.querySelector('.scroll__container');
        if (searchResults) {
          searchResults.scrollTo(0, searchResults.scrollHeight);
          console.log(`📈 Текущее количество результатов: ${searchResults.scrollHeight}`);
        }
      });

      // Ждем загрузки новых результатов
      await this.page.waitForTimeout(1000);

      // Проверяем количество загруженных элементов
      const currentCount = await this.page.$$eval(
        YANDEX_MAPS_SELECTORS.nameClub, 
        elements => elements.length
      );

      console.log(`📈 Текущее количество результатов: ${currentCount}`);

      // Если достигли целевого количества
      if (currentCount >= targetCount) {
        console.log(`🎯 Достигнуто целевое количество: ${targetCount}`);
        break;
      }

      // Проверяем, загружаются ли новые результаты
      if (currentCount === lastCount) {
        stableCount++;
        if (stableCount >= MAX_NO_CHANGE) {
          console.log('⏹️ Больше результатов не загружается');
          break;
        }
      } else {
        stableCount = 0;
      }

      lastCount = currentCount;
    }
  }

  private async extractClubsData(maxResults: number): Promise<ClubData[]> {
    if (!this.page) return [];

    // Получаем названия клубов
    const clubNames = await this.page.$$eval(YANDEX_MAPS_SELECTORS.nameClub, elements => 
      elements.map(el => el.textContent?.trim() || '')
    );

    // Получаем адреса клубов
    const clubAddresses = await this.page.$$eval(YANDEX_MAPS_SELECTORS.adressClub, elements => 
      elements.map(el => el.textContent?.trim() || '')
    );

    // Объединяем данные
    const clubs: ClubData[] = [];
    const count = Math.min(clubNames.length, clubAddresses.length, maxResults);

    for (let i = 0; i < count; i++) {
      clubs.push({
        index: i + 1,
        name: clubNames[i],
        address: clubAddresses[i]
      });
    }

    // Выводим найденные клубы в консоль
    console.log('\n📋 Найденные клубы:');
    clubs.forEach((club, index) => {
      console.log(`${index + 1}. ${club.name}`);
      console.log(`   📍 ${club.address}\n`);
    });

    return clubs;
  }

  async saveResults(result: ScrapingResult, filename: string = 'clubs-data.json') {
    const resultsPath = path.join(process.cwd(), 'results', filename);
    
    // Создаем папку results если её нет
    const resultsDir = path.dirname(resultsPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Сохраняем результаты
    fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`💾 Результаты сохранены в: ${resultsPath}`);
    
    // Создаем также CSV файл для удобства
    const csvContent = this.generateCSV(result.clubs);
    const csvPath = path.join(resultsDir, 'clubs-data.csv');
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    console.log(`📊 CSV файл сохранен в: ${csvPath}`);
  }

  private generateCSV(clubs: ClubData[]): string {
    const header = 'Номер,Название,Адрес\n';
    const rows = clubs.map(club => 
      `${club.index},"${club.name.replace(/"/g, '""')}","${club.address.replace(/"/g, '""')}"`
    ).join('\n');
    
    return header + rows;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  printSummary(result: ScrapingResult) {
    console.log('\n🎯 === СВОДКА ===');
    console.log(`📊 Всего найдено клубов: ${result.totalFound}`);
    console.log(`⏰ Время сбора: ${new Date(result.timestamp).toLocaleString('ru-RU')}`);
    console.log(`🌐 Источник: ${result.sourceUrl.substring(0, 100)}...`);
    
    if (result.clubs.length > 0) {
      console.log('\n🏆 Топ-5 клубов:');
      result.clubs.slice(0, 5).forEach((club, index) => {
        console.log(`${index + 1}. ${club.name}`);
        console.log(`   📍 ${club.address}`);
      });
    }
  }
}

// Основная функция для запуска сбора данных
export async function runClubsScraping(maxResults: number = 8000) {
  const scraper = new ClubsScraper();
  
  try {
    await scraper.init();
    
    console.log('🎮 Запускаем сбор данных о компьютерных клубах...\n');
    
    // Собираем данные
    const result = await scraper.scrapeClubs(maxResults);
    
    // Сохраняем результаты
    await scraper.saveResults(result);
    
    // Выводим сводку
    scraper.printSummary(result);
    
  } catch (error) {
    console.error('❌ Ошибка при сборе данных:', error);
  } finally {
    await scraper.close();
  }
}

// Запуск, если файл вызывается напрямую
if (require.main === module) {
  const maxResults = parseInt(process.argv[2]) || 1000;
  runClubsScraping(maxResults).catch(console.error);
} 