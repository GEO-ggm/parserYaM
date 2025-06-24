#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { getRegionsPath } from './build-config';
import { NetworkClubsScraper } from '../scripts/network-clubs-scraper';
import { yandexMapsParser } from '../scripts/yandex-maps-parser';

// Интерфейсы
interface RegionInfo {
  id: number;
  name: string;
  url: string;
}

// Основной класс CLI
export class ClubsParserCLI {
  private regions: RegionInfo[] = [];
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async init() {
    // Загружаем регионы
    await this.loadRegions();
  }

  private async loadRegions() {
    const regionsPath = getRegionsPath();
    
    if (!fs.existsSync(regionsPath)) {
      console.error(`❌ Файл регионов не найден: ${regionsPath}`);
      console.error(`💡 Убедитесь, что файл regions-simple.json находится:`);
      console.error(`   - В папке results/ (для разработки)`);
      console.error(`   - Рядом с EXE файлом (для production)`);
      process.exit(1);
    }
    
    try {
      const regionsData = fs.readFileSync(regionsPath, 'utf-8');
      this.regions = JSON.parse(regionsData);
      console.log(`✅ Загружено ${this.regions.length} регионов`);
    } catch (error) {
      console.error(`❌ Ошибка загрузки регионов:`, error);
      process.exit(1);
    }
  }

  async showMainMenu() {
    console.clear();
    console.log('╔════════════════════════════════════════╗');
    console.log('║     🗺️  ПАРСЕР КОМПЬЮТЕРНЫХ КЛУБОВ     ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('Выберите действие:');
    console.log('  1. Парсить конкретный регион');
    console.log('  2. Парсить все регионы');
    console.log('  3. Показать список регионов');
    console.log('  4. Поиск региона по названию');
    console.log('  0. Выход');
    console.log('');
  }

  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  async selectRegion(): Promise<RegionInfo | null> {
    const choice = await this.question('Введите ID региона или его название: ');
    
    // Попытка найти по ID
    const regionId = parseInt(choice, 10);
    if (!isNaN(regionId)) {
      const region = this.regions.find(r => r.id === regionId);
      if (region) return region;
    }
    
    // Попытка найти по названию
    const searchTerm = choice.toLowerCase();
    const matchedRegions = this.regions.filter(r => 
      r.name.toLowerCase().includes(searchTerm)
    );
    
    if (matchedRegions.length === 0) {
      console.log('❌ Регион не найден');
      return null;
    }
    
    if (matchedRegions.length === 1) {
      return matchedRegions[0];
    }
    
    // Если найдено несколько регионов
    console.log('\nНайдено несколько регионов:');
    matchedRegions.slice(0, 10).forEach((r, i) => {
      console.log(`  ${i + 1}. [ID: ${r.id}] ${r.name}`);
    });
    
    const index = await this.question('\nВыберите номер региона: ');
    const selectedIndex = parseInt(index, 10) - 1;
    
    if (selectedIndex >= 0 && selectedIndex < matchedRegions.length) {
      return matchedRegions[selectedIndex];
    }
    
    return null;
  }

  async showRegionsList() {
    console.clear();
    console.log('📋 СПИСОК ВСЕХ РЕГИОНОВ:');
    console.log('════════════════════════════════════════');
    
    // Группируем по странам
    const russianRegions = this.regions.filter(r => r.id < 84);
    const otherRegions = this.regions.filter(r => r.id >= 84);
    
    console.log('\n🇷🇺 Российские регионы:');
    russianRegions.forEach(region => {
      console.log(`  ${region.id.toString().padStart(3)}: ${region.name}`);
    });
    
    if (otherRegions.length > 0) {
      console.log('\n🌍 Другие регионы:');
      otherRegions.forEach(region => {
        console.log(`  ${region.id.toString().padStart(3)}: ${region.name}`);
      });
    }
    
    await this.question('\nНажмите Enter для продолжения...');
  }

  async searchRegions() {
    const searchTerm = await this.question('Введите часть названия региона: ');
    const results = this.regions.filter(r => 
      r.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (results.length === 0) {
      console.log('❌ Регионы не найдены');
    } else {
      console.log(`\n📍 Найдено регионов: ${results.length}`);
      results.forEach(region => {
        console.log(`  [ID: ${region.id}] ${region.name}`);
      });
    }
    
    await this.question('\nНажмите Enter для продолжения...');
  }

  async parseRegion(region: RegionInfo) {
    console.log(`\n🚀 Начинаем парсинг региона: ${region.name} (ID: ${region.id})`);
    console.log(`🔗 URL: ${region.url}`);
    
    const scraper = new NetworkClubsScraper(yandexMapsParser);
    
    try {
      await scraper.init();
      
      // Очищаем данные для нового региона
      scraper.clearRegionData();
      
      // Переходим на URL региона
      if (scraper.page) {
        await scraper.page.goto(region.url, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
        
        console.log('⏳ Ждем загрузки первичных результатов...');
        await scraper.page.waitForTimeout(3000);
        
        // Выполняем скролл для загрузки данных (используем те же настройки что и в run-network-scraper)
        await scraper['scrollToTriggerRequests'](15);
        
        // Ждем завершения всех запросов
        await scraper.page.waitForTimeout(2000);
        
        // Получаем собранные данные
        const uniqueClubs = scraper.removeDuplicates(scraper.clubsData);
        
        // Добавляем информацию о регионе к каждому клубу
        uniqueClubs.forEach((club: any) => {
          club.regionId = region.id;
          club.regionName = region.name;
          club.sourceRegionUrl = region.url;
        });
        
        console.log(`✅ Регион ${region.name}: найдено ${uniqueClubs.length} клубов`);
        console.log(`🌐 Network запросов: ${scraper.networkRequests}`);
        
        // Сохраняем результаты
        await this.saveResults({
          totalFound: uniqueClubs.length,
          clubs: uniqueClubs,
          region: region.name,
          regionId: region.id,
          timestamp: new Date().toISOString(),
          networkRequests: scraper.networkRequests
        }, region);
        
        await scraper.close();
        return uniqueClubs;
      }
      
    } catch (error) {
      console.error(`❌ Ошибка при парсинге региона:`, error);
      await scraper.close();
      return [];
    }
  }

  async parseAllRegions() {
    console.log(`\n🌍 Начинаем парсинг всех регионов (${this.regions.length} регионов)`);
    
    const allClubs: any[] = [];
    let successCount = 0;
    let totalNetworkRequests = 0;
    
    for (let i = 0; i < this.regions.length; i++) {
      const region = this.regions[i];
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📍 Регион ${i + 1}/${this.regions.length}: ${region.name}`);
      
      const scraper = new NetworkClubsScraper(yandexMapsParser);
      
      try {
        await scraper.init();
        scraper.clearRegionData();
        
        if (scraper.page) {
          await scraper.page.goto(region.url, { 
            waitUntil: 'networkidle',
            timeout: 30000 
          });
          
          console.log('⏳ Ждем загрузки первичных результатов...');
          await scraper.page.waitForTimeout(3000);
          
          await scraper['scrollToTriggerRequests'](15);
          await scraper.page.waitForTimeout(2000);
          
          const uniqueClubs = scraper.removeDuplicates(scraper.clubsData);
          
          uniqueClubs.forEach((club: any) => {
            club.regionId = region.id;
            club.regionName = region.name;
            club.sourceRegionUrl = region.url;
          });
          
          if (uniqueClubs.length > 0) {
            allClubs.push(...uniqueClubs);
            successCount++;
            totalNetworkRequests += scraper.networkRequests;
          }
          
          console.log(`✅ Регион ${region.name}: найдено ${uniqueClubs.length} клубов`);
        }
        
        await scraper.close();
        
      } catch (error) {
        console.error(`❌ Ошибка при сборе данных для региона ${region.name}:`, error);
        await scraper.close();
      }
      
      // Пауза между регионами
      if (i < this.regions.length - 1) {
        console.log('⏸️ Пауза 2 секунды...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Сохраняем общие результаты
    await this.saveAllResults({
      totalRegions: this.regions.length,
      successfulRegions: successCount,
      totalClubs: allClubs.length,
      clubs: allClubs,
      timestamp: new Date().toISOString(),
      networkRequests: totalNetworkRequests
    });
  }

  async saveResults(result: any, region: RegionInfo) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `clubs-${region.name}-${timestamp}.json`;
    const csvFilename = `clubs-${region.name}-${timestamp}.csv`;
    
    const resultsPath = path.join(process.cwd(), 'results', filename);
    const csvPath = path.join(process.cwd(), 'results', csvFilename);
    
    // Создаем папку results если её нет
    const resultsDir = path.dirname(resultsPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Сохраняем JSON
    fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`💾 JSON сохранен: ${resultsPath}`);
    
    // Сохраняем CSV
    const csvContent = this.generateCSV(result.clubs);
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    console.log(`📊 CSV сохранен: ${csvPath}`);
  }

  async saveAllResults(result: any) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `clubs-all-regions-${timestamp}.json`;
    const csvFilename = `clubs-all-regions-${timestamp}.csv`;
    
    const resultsPath = path.join(process.cwd(), 'results', filename);
    const csvPath = path.join(process.cwd(), 'results', csvFilename);
    
    const resultsDir = path.dirname(resultsPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2), 'utf-8');
    fs.writeFileSync(csvPath, this.generateCSV(result.clubs), 'utf-8');
    
    console.log(`\n📋 ИТОГОВАЯ СТАТИСТИКА:`);
    console.log(`════════════════════════════════════════`);
    console.log(`✅ Обработано регионов: ${result.successfulRegions}/${result.totalRegions}`);
    console.log(`🏢 Всего клубов найдено: ${result.totalClubs}`);
    console.log(`🌐 Network запросов: ${result.networkRequests}`);
    console.log(`💾 Результаты сохранены в: ${resultsPath}`);
  }

  private generateCSV(clubs: any[]): string {
    const header = 'ID региона,Название региона,Название,Адрес,Полный адрес,Страна,Почтовый код,Телефон,Все телефоны,Сайт,Все сайты,Рейтинг,Отзывы,Количество оценок,Категории,Часы работы,Социальные сети,Широта,Долгота,Фото,Ссылка на Яндекс.Карты\n';
    
    const rows = clubs.map(club => {
      const lat = club.coordinates?.lat || '';
      const lon = club.coordinates?.lon || '';
      const phones = club.phones?.join('; ') || club.phone || '';
      const websites = club.websites?.join('; ') || club.website || '';
      const categories = club.categories?.join('; ') || '';
      const socialLinks = club.socialLinks?.map((link: { type: any; url: any; }) => `${link.type}: ${link.url}`).join('; ') || '';
      
      // Формируем ссылку на Яндекс.Карты
      const yandexMapsUrl = (club.urlSeoname && club.urlId) 
        ? `https://yandex.ru/maps/org/${club.urlSeoname}/${club.urlId}`
        : '';
      
      return `"${club.regionId || ''}",` +
             `"${(club.regionName || '').replace(/"/g, '""')}",` +
             `"${(club.name || '').replace(/"/g, '""')}",` +
             `"${(club.address || '').replace(/"/g, '""')}",` +
             `"${(club.fullAddress || '').replace(/"/g, '""')}",` +
             `"${(club.country || '').replace(/"/g, '""')}",` +
             `"${(club.postalCode || '').replace(/"/g, '""')}",` +
             `"${(club.phone || '').replace(/"/g, '""')}",` +
             `"${phones.replace(/"/g, '""')}",` +
             `"${(club.website || '').replace(/"/g, '""')}",` +
             `"${websites.replace(/"/g, '""')}",` +
             `"${club.rating || ''}",` +
             `"${club.reviews || ''}",` +
             `"${club.ratingCount || ''}",` +
             `"${categories.replace(/"/g, '""')}",` +
             `"${(club.workingHours || '').replace(/"/g, '""')}",` +
             `"${socialLinks.replace(/"/g, '""')}",` +
             `"${lat}",` +
             `"${lon}",` +
             `"${(club.photo || '').replace(/"/g, '""')}",` +
             `"${yandexMapsUrl}"`;
    }).join('\n');
    
    return header + rows;
  }

  async run() {
    await this.init();
    
    let exit = false;
    
    while (!exit) {
      await this.showMainMenu();
      const choice = await this.question('Ваш выбор: ');
      
      switch (choice) {
        case '1':
          const region = await this.selectRegion();
          if (region) {
            await this.parseRegion(region);
            await this.question('\nНажмите Enter для продолжения...');
          }
          break;
          
        case '2':
          const confirm = await this.question('\n⚠️ Это займет много времени. Продолжить? (y/n): ');
          if (confirm.toLowerCase() === 'y') {
            await this.parseAllRegions();
            await this.question('\nНажмите Enter для продолжения...');
          }
          break;
          
        case '3':
          await this.showRegionsList();
          break;
          
        case '4':
          await this.searchRegions();
          break;
          
        case '0':
          exit = true;
          break;
          
        default:
          console.log('❌ Неверный выбор');
          await this.question('\nНажмите Enter для продолжения...');
      }
    }
    
    this.rl.close();
  }
}

// Запуск приложения
async function main() {
  const parser = new ClubsParserCLI();
  
  try {
    await parser.run();
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 