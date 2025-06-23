import { chromium, Browser, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface RegionInfo {
  id: number;
  name: string;
  originalUrl: string;
  finalUrl: string;
  status: 'success' | 'error' | 'not_found';
  error?: string;
}

interface CollectionResult {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  notFoundCount: number;
  regions: RegionInfo[];
  timestamp: string;
}

export class RegionsCollector {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private results: RegionInfo[] = [];
  private baseUrl = 'https://yandex.ru/maps';
  private urlParams = '/?ll=35.917421%2C56.858745&z=12';

  async init() {
    this.browser = await chromium.launch({ 
      headless: true, // Скрываем браузер для ускорения
      timeout: 60000 
    });
    this.page = await this.browser.newPage();
    
    // Устанавливаем русский язык
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'ru-RU,ru;q=0.9'
    });
  }

  async collectRegion(regionId: number): Promise<RegionInfo> {
    if (!this.page) {
      throw new Error('Collector not initialized');
    }

    // Формируем URL с подставкой ID
    const originalUrl = `${this.baseUrl}/${regionId}/tver${this.urlParams}`;
    
    const regionInfo: RegionInfo = {
      id: regionId,
      name: '',
      originalUrl: originalUrl,
      finalUrl: '',
      status: 'error'
    };

    try {
      console.log(`🔍 Проверяем регион ID: ${regionId}...`);
      
      // Переходим по URL
      await this.page.goto(originalUrl, { 
        waitUntil: 'networkidle',
        timeout: 15000 
      });

      // Получаем финальный URL после редиректов
      const finalUrl = this.page.url();
      regionInfo.finalUrl = finalUrl;

      // Извлекаем название региона из URL
      const regionName = this.extractRegionName(finalUrl);
      
      if (regionName && regionName !== 'tver' && !finalUrl.includes('/moscow/')) {
        regionInfo.name = regionName;
        regionInfo.status = 'success';
        console.log(`✅ ID ${regionId}: ${regionName}`);
      } else {
        regionInfo.status = 'not_found';
        regionInfo.error = 'Region name not extracted';
        console.log(`❓ ID ${regionId}: не удалось извлечь название`);
      }

    } catch (error) {
      regionInfo.status = 'error';
      regionInfo.error = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ ID ${regionId}: ошибка - ${regionInfo.error}`);
    }

    return regionInfo;
  }

  private extractRegionName(url: string): string | null {
    // Паттерны для извлечения названия региона из URL
    const patterns = [
      /\/maps\/\d+\/([^\/\?#]+)/,  // /maps/14/tver/
      /\/maps\/([^\/\?#\d][^\/\?#]*)/  // /maps/regionname/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1] && match[1] !== 'tver') {
        return match[1];
      }
    }

    return null;
  }

  async collectRegionsRange(startId: number, endId: number): Promise<CollectionResult> {
    console.log(`🚀 Начинаем сбор регионов с ID ${startId} по ${endId}...\n`);
    
    this.results = [];
    
    for (let id = startId; id <= endId; id++) {
      const regionInfo = await this.collectRegion(id);
      this.results.push(regionInfo);
      
      // Пауза между запросами
      await this.page?.waitForTimeout(500);
      
      // Показываем прогресс каждые 10 регионов
      if (id % 10 === 0) {
        const successful = this.results.filter(r => r.status === 'success').length;
        console.log(`📊 Прогресс: ${id}/${endId}, найдено регионов: ${successful}`);
      }
    }

    const result: CollectionResult = {
      totalProcessed: this.results.length,
      successCount: this.results.filter(r => r.status === 'success').length,
      errorCount: this.results.filter(r => r.status === 'error').length,
      notFoundCount: this.results.filter(r => r.status === 'not_found').length,
      regions: this.results,
      timestamp: new Date().toISOString()
    };

    return result;
  }

  async saveResults(result: CollectionResult, filename: string = 'regions-collection.json') {
    const resultsPath = path.join(process.cwd(), 'results', filename);
    
    // Создаем папку results если её нет
    const resultsDir = path.dirname(resultsPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Фильтруем результаты - исключаем not_found записи
    const filteredRegions = result.regions.filter(r => r.status !== 'not_found');
    
    // Создаем модифицированный результат без not_found записей
    const filteredResult = {
      ...result,
      regions: filteredRegions,
      savedRegionsCount: filteredRegions.length // добавляем счетчик сохраненных записей
    };

    // Сохраняем отфильтрованные результаты
    fs.writeFileSync(resultsPath, JSON.stringify(filteredResult, null, 2), 'utf-8');
    console.log(`💾 Результаты сохранены в: ${resultsPath} (исключены not_found: ${result.notFoundCount})`);
    
    // Создаем упрощенный список только с успешными регионами
    const successfulRegions = filteredRegions
      .filter(r => r.status === 'success')
      .map(r => ({ id: r.id, name: r.name, url: r.finalUrl }));
    
    const simplePath = path.join(resultsDir, 'regions-simple.json');
    fs.writeFileSync(simplePath, JSON.stringify(successfulRegions, null, 2), 'utf-8');
    console.log(`📋 Упрощенный список сохранен в: ${simplePath}`);

    // Создаем CSV файл (также без not_found)
    const csvContent = this.generateCSV(filteredRegions);
    const csvPath = path.join(resultsDir, 'regions.csv');
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    console.log(`📊 CSV файл сохранен в: ${csvPath}`);
  }

  private generateCSV(regions: RegionInfo[]): string {
    const header = 'ID,Название,Статус,Исходный URL,Финальный URL,Ошибка\n';
    const rows = regions.map(region => 
      `${region.id},"${region.name}","${region.status}","${region.originalUrl}","${region.finalUrl}","${region.error || ''}"`
    ).join('\n');
    
    return header + rows;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  printSummary(result: CollectionResult) {
    const savedCount = result.successCount + result.errorCount; // Сохраняем только success и error
    
    console.log('\n🎯 === ИТОГОВАЯ СВОДКА ===');
    console.log(`📊 Всего обработано: ${result.totalProcessed}`);
    console.log(`✅ Успешно найдено: ${result.successCount}`);
    console.log(`❌ Ошибки: ${result.errorCount}`);
    console.log(`❓ Не найдено (не сохранено): ${result.notFoundCount}`);
    console.log(`💾 Сохранено в JSON: ${savedCount} записей`);
    console.log(`⏰ Время сбора: ${new Date(result.timestamp).toLocaleString('ru-RU')}`);
    
    if (result.successCount > 0) {
      console.log('\n🏆 Найденные регионы:');
      const successful = result.regions.filter(r => r.status === 'success');
      successful.slice(0, 10).forEach(region => {
        console.log(`  ${region.id}: ${region.name}`);
      });
      
      if (successful.length > 10) {
        console.log(`  ... и еще ${successful.length - 10} регионов`);
      }
    }

    if (result.errorCount > 0) {
      console.log('\n⚠️ Регионы с ошибками (сохранены для анализа):');
      result.regions
        .filter(r => r.status === 'error')
        .slice(0, 5)
        .forEach(region => {
          console.log(`  ID ${region.id}: ${region.error}`);
        });
    }
    
    if (result.notFoundCount > 0) {
      console.log(`\n🗑️ Исключено из сохранения: ${result.notFoundCount} записей со статусом 'not_found'`);
    }
  }
}

// Основная функция для запуска сбора
export async function runRegionsCollection(startId: number = 1, endId: number = 150) {
  const collector = new RegionsCollector();
  
  try {
    await collector.init();
    
    console.log('🗺️ Запускаем сбор ID регионов России...\n');
    
    // Собираем регионы
    const result = await collector.collectRegionsRange(startId, endId);
    
    // Сохраняем результаты
    await collector.saveResults(result);
    
    // Выводим сводку
    collector.printSummary(result);
    
  } catch (error) {
    console.error('❌ Критическая ошибка при сборе:', error);
  } finally {
    await collector.close();
  }
}

// Запуск, если файл вызывается напрямую
if (require.main === module) {
  const startId = parseInt(process.argv[2]) || 1;
  const endId = parseInt(process.argv[3]) || 150;
  
  console.log(`Сбор регионов с ID ${startId} по ${endId}`);
  runRegionsCollection(startId, endId).catch(console.error);
} 