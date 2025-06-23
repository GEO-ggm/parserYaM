import { chromium, Browser, Page } from '@playwright/test';
import { YANDEX_MAPS_SELECTORS } from '../config/yandex-maps.config';
import * as fs from 'fs';
import * as path from 'path';

interface RegionInfo {
  id: number;
  name: string;
  url: string;
}

interface ClubInfo {
  nameClub: string;
  adressClub: string;
}

interface RegionClubsData {
  region: string;
  regionId: number;
  clubs: ClubInfo[];
  clubsSum: number;
  status: 'success' | 'error';
  error?: string;
}

interface ParseResult {
  totalRegions: number;
  successfulRegions: number;
  totalClubs: number;
  regionsData: RegionClubsData[];
  timestamp: string;
}

export class RegionsClubsParser {
  private browser: Browser | null = null;
  private page: Page | null = null;


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

  async parseRegionClubs(region: RegionInfo): Promise<RegionClubsData> {
    if (!this.page) {
      throw new Error('Parser not initialized');
    }

    const result: RegionClubsData = {
      region: region.name,
      regionId: region.id,
      clubs: [],
      clubsSum: 0,
      status: 'error'
    };

    try {
      console.log(`🔍 Парсим регион: ${region.name} (ID: ${region.id})`);
      
      // Переходим на страницу региона
      await this.page.goto(region.url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      
      
      // Ждем загрузки результатов
      await this.page.waitForTimeout(3000);

      // Проверяем, есть ли результаты поиска
      try {
        await this.page.waitForSelector(YANDEX_MAPS_SELECTORS.nameClub, { 
          timeout: 10000 
        });
        
        // Собираем данные о клубах
        const clubs = await this.extractClubsData();
        
        result.clubs = clubs;
        result.clubsSum = clubs.length;
        result.status = 'success';
        
        console.log(`✅ ${region.name}: найдено ${clubs.length} клубов`);
        
      } catch (error) {
        // Нет результатов поиска
        result.status = 'success'; // Это не ошибка, просто нет клубов
        result.clubsSum = 0;
        console.log(`📍 ${region.name}: клубы не найдены`);
      }

    } catch (error) {
      result.status = 'error';
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ ${region.name}: ошибка - ${result.error}`);
    }

    return result;
  }


  private async extractClubsData(): Promise<ClubInfo[]> {
    if (!this.page) return [];

    // Прокручиваем для загрузки дополнительных результатов
    await this.scrollToLoadMore();

    // Получаем названия клубов
    const clubNames = await this.page.$$eval(
      YANDEX_MAPS_SELECTORS.nameClub, 
      elements => elements.map(el => el.textContent?.trim() || '')
    );

    // Получаем адреса клубов
    const clubAddresses = await this.page.$$eval(
      YANDEX_MAPS_SELECTORS.adressClub, 
      elements => elements.map(el => el.textContent?.trim() || '')
    );

    // Объединяем данные
    const clubs: ClubInfo[] = [];
    const count = Math.min(clubNames.length, clubAddresses.length);

    for (let i = 0; i < count; i++) {
      if (clubNames[i] && clubAddresses[i]) {
        clubs.push({
          nameClub: clubNames[i],
          adressClub: clubAddresses[i]
        });
      }
    }

    return clubs;
  }

  private async scrollToLoadMore() {
    if (!this.page) return;

    console.log('📜 Прокручиваем для загрузки дополнительных результатов...');
    
    for (let i = 0; i < 500; i++) { 
      await this.page.evaluate(() => {
        const searchResults = document.querySelector('.scroll__container');
        if (searchResults) {
          searchResults.scrollTo(0, searchResults.scrollHeight);
        }
      });

      await this.page.waitForTimeout(2000);
    }
  }

  async parseAllRegions(): Promise<ParseResult> {
    // Загружаем список регионов
    const regions = this.loadRegionsFromFile();
    
    if (regions.length === 0) {
      throw new Error('Не найден файл regions-simple.json или он пуст');
    }

    console.log(`🚀 Начинаем парсинг клубов в ${regions.length} регионах...\n`);

    const results: RegionClubsData[] = [];
    let totalClubs = 0;

    for (const region of regions) {
      const regionData = await this.parseRegionClubs(region);
      results.push(regionData);
      
      if (regionData.status === 'success') {
        totalClubs += regionData.clubsSum;
      }

      // Показываем результат для каждого региона
      this.printRegionResult(regionData);
      
      // Пауза между регионами
      await this.page?.waitForTimeout(2000);
    }

    const parseResult: ParseResult = {
      totalRegions: regions.length,
      successfulRegions: results.filter(r => r.status === 'success').length,
      totalClubs: totalClubs,
      regionsData: results,
      timestamp: new Date().toISOString()
    };

    return parseResult;
  }

  private loadRegionsFromFile(): RegionInfo[] {
    try {
      const filePath = path.join(process.cwd(), 'results', 'regions-simple.json');
      
      if (!fs.existsSync(filePath)) {
        console.log('❌ Файл regions-simple.json не найден!');
        console.log('💡 Сначала запустите: npm run collect-regions');
        return [];
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const regions: RegionInfo[] = JSON.parse(fileContent);
      
      console.log(`📋 Загружено ${regions.length} регионов из regions-simple.json`);
      return regions;
      
    } catch (error) {
      console.error('❌ Ошибка при загрузке файла regions-simple.json:', error);
      return [];
    }
  }

  private printRegionResult(regionData: RegionClubsData) {
    console.log(`\n📍 region: ${regionData.region}`);
    console.log(`🎯 clubs: ${regionData.clubsSum}`);
    
    if (regionData.clubsSum > 0) {
      regionData.clubs.forEach((club, index) => {
        console.log(`  ${index + 1}. ${club.nameClub}`);
        console.log(`     📍 ${club.adressClub}`);
      });
    } else if (regionData.status === 'error') {
      console.log(`  ❌ Ошибка: ${regionData.error}`);
    } else {
      console.log(`  📭 Клубы не найдены`);
    }
  }

  async saveResults(result: ParseResult) {
    const resultsPath = path.join(process.cwd(), 'results', 'regions-clubs-data.json');
    
    // Создаем папку results если её нет
    const resultsDir = path.dirname(resultsPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Сохраняем полные результаты
    fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`\n💾 Результаты сохранены в: ${resultsPath}`);
    
    // Создаем упрощенный CSV
    const csvContent = this.generateCSV(result.regionsData);
    const csvPath = path.join(resultsDir, 'regions-clubs.csv');
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    console.log(`📊 CSV файл сохранен в: ${csvPath}`);
  }

  private generateCSV(regionsData: RegionClubsData[]): string {
    let csv = 'Регион,ID региона,Количество клубов,Название клуба,Адрес клуба\n';
    
    regionsData.forEach(regionData => {
      if (regionData.clubsSum === 0) {
        csv += `"${regionData.region}",${regionData.regionId},0,"",""\n`;
      } else {
        regionData.clubs.forEach((club, index) => {
          const clubCount = index === 0 ? regionData.clubsSum : '';
          csv += `"${regionData.region}",${regionData.regionId},"${clubCount}","${club.nameClub}","${club.adressClub}"\n`;
        });
      }
    });
    
    return csv;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  printSummary(result: ParseResult) {
    console.log('\n🎯 === ИТОГОВАЯ СВОДКА ===');
    console.log(`📊 Всего регионов: ${result.totalRegions}`);
    console.log(`✅ Успешно обработано: ${result.successfulRegions}`);
    console.log(`🎮 Всего найдено клубов: ${result.totalClubs}`);
    console.log(`⏰ Время парсинга: ${new Date(result.timestamp).toLocaleString('ru-RU')}`);
    
    // Топ-5 регионов по количеству клубов
    const topRegions = result.regionsData
      .filter(r => r.status === 'success' && r.clubsSum > 0)
      .sort((a, b) => b.clubsSum - a.clubsSum)
      .slice(0, 5);
    
    if (topRegions.length > 0) {
      console.log('\n🏆 Топ-5 регионов по количеству клубов:');
      topRegions.forEach((region, index) => {
        console.log(`  ${index + 1}. ${region.region}: ${region.clubsSum} клубов`);
      });
    }
  }
}

// Основная функция для запуска парсинга
export async function runRegionsClubsParsing() {
  const parser = new RegionsClubsParser();
  
  try {
    await parser.init();
    
    console.log('🎮 Запускаем парсинг компьютерных клубов по регионам...\n');
    
    // Парсим все регионы
    const result = await parser.parseAllRegions();
    
    // Сохраняем результаты
    await parser.saveResults(result);
    
    // Выводим сводку
    parser.printSummary(result);
    
  } catch (error) {
    console.error('❌ Критическая ошибка при парсинге:', error);
  } finally {
    await parser.close();
  }
}

// Запуск, если файл вызывается напрямую
if (require.main === module) {
  runRegionsClubsParsing().catch(console.error);
} 