import { runNetworkClubsScraping } from './network-clubs-scraper';
import { yandexMapsParser } from './yandex-maps-parser';
import * as fs from 'fs';
import * as path from 'path';

interface RegionData {
  id: number;
  name: string;
  url: string;
}

// Функция для загрузки данных о регионах
function loadRegions(): RegionData[] {
  const regionsPath = path.join(process.cwd(), 'results', 'regions-simple.json');
  
  if (!fs.existsSync(regionsPath)) {
    throw new Error(`Файл с регионами не найден: ${regionsPath}`);
  }
  
  const regionsData = fs.readFileSync(regionsPath, 'utf-8');
  return JSON.parse(regionsData);
}

// Функция для поиска региона по ID
function findRegionById(regions: RegionData[], id: number): RegionData | null {
  return regions.find(region => region.id === id) || null;
}

// Основная функция для запуска сбора данных через network
async function main() {
  try {
    // Получаем аргументы командной строки
    const args = process.argv.slice(2);
    const regionArg = args[0];
    
    // Загружаем список регионов
    const regions = loadRegions();
    
    let targetRegions: RegionData[] = [];
    let outputSuffix = '';
    
    if (!regionArg || regionArg === 'global') {
      // Режим "global" - парсим все регионы
      targetRegions = regions;
      outputSuffix = 'all-regions';
      console.log(`🌍 Режим: сбор данных по всем регионам (${regions.length} регионов)`);
    } else {
      // Режим конкретного региона
      const regionId = parseInt(regionArg, 10);
      
      if (isNaN(regionId)) {
        console.error('❌ Ошибка: ID региона должно быть числом');
        console.log('💡 Использование:');
        console.log('  npm run network-scraper        - по всем регионам');
        console.log('  npm run network-scraper global - по всем регионам');
        console.log('  npm run network-scraper 10     - по региону с ID 10');
        process.exit(1);
      }
      
      const region = findRegionById(regions, regionId);
      if (!region) {
        console.error(`❌ Регион с ID ${regionId} не найден`);
        console.log('📋 Доступные регионы:');
        regions.slice(0, 10).forEach(r => {
          console.log(`  ${r.id}: ${r.name}`);
        });
        console.log(`  ... и еще ${regions.length - 10} регионов`);
        process.exit(1);
      }
      
      targetRegions = [region];
      outputSuffix = `region-${regionId}`;
      console.log(`🎯 Режим: сбор данных по региону "${region.name}" (ID: ${regionId})`);
    }
    
    console.log(`🚀 Запуск сбора данных о клубах через network-запросы...\n`);
    
    // Параметры сбора
    const scrollIterations = 15;
    
    // Запускаем сбор данных
    const result = await runNetworkClubsScrapingForRegions(
      targetRegions, 
      yandexMapsParser, 
      scrollIterations, 
      outputSuffix
    );
    
    console.log('\n✅ Сбор данных завершен успешно!');
    console.log(`📁 Файлы сохранены в папке results/`);
    
  } catch (error) {
    console.error('❌ Ошибка при сборе данных:', error);
    process.exit(1);
  }
}

// Функция для сбора данных по регионам
async function runNetworkClubsScrapingForRegions(
  regions: RegionData[],
  parser: any,
  scrollIterations: number,
  outputSuffix: string
) {
  const allClubs: any[] = [];
  let totalNetworkRequests = 0;
  
  for (const region of regions) {
    console.log(`\n📍 Начинаем сбор данных для региона: ${region.name} (ID: ${region.id})`);
    console.log(`🔗 URL: ${region.url}`);
    
    try {
      // Временно меняем URL в конфиге для текущего региона
      const originalConfig = require('../config/yandex-maps.config');
      const tempConfig = { ...originalConfig.yandexMapsConfig };
      tempConfig.startUrl = region.url;
      
      // Создаем временный парсер с новым URL
      const { NetworkClubsScraper } = await import('./network-clubs-scraper');
      const scraper = new NetworkClubsScraper(parser);
      
      await scraper.init();
      
      // Очищаем данные для нового региона
      scraper.clearRegionData();
      
      // Переходим на URL региона
      if (scraper['page']) {
        await scraper['page'].goto(region.url, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
        
        console.log('⏳ Ждем загрузки первичных результатов...');
        await scraper['page'].waitForTimeout(3000);
        
        // Выполняем скролл для загрузки данных
        await scraper['scrollToTriggerRequests'](scrollIterations);
        
        // Ждем завершения всех запросов
        await scraper['page'].waitForTimeout(2000);
        
        // Получаем собранные данные
        const regionClubs = scraper['removeDuplicates'](scraper['clubsData']);
        
        // Добавляем информацию о регионе к каждому клубу
        regionClubs.forEach((club: any) => {
          club.regionId = region.id;
          club.regionName = region.name;
          club.sourceRegionUrl = region.url;
        });
        
        allClubs.push(...regionClubs);
        totalNetworkRequests += scraper['networkRequests'];
        
        console.log(`✅ Регион ${region.name}: найдено ${regionClubs.length} клубов`);
      }
      
      await scraper.close();
      
    } catch (error) {
      console.error(`❌ Ошибка при сборе данных для региона ${region.name}:`, error);
    }
    
    // Небольшая пауза между регионами
    if (regions.length > 1) {
      console.log('⏸️ Пауза 2 секунды перед следующим регионом...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Формируем итоговый результат
  const result = {
    totalFound: allClubs.length,
    clubs: allClubs,
    regionsProcessed: regions.length,
    timestamp: new Date().toISOString(),
    networkRequests: totalNetworkRequests
  };
  
  // Сохраняем результаты
  await saveResults(result, outputSuffix);
  
  // Выводим статистику
  printFinalSummary(result, regions);
  
  return result;
}

// Функция для сохранения результатов
async function saveResults(result: any, suffix: string) {
  const filename = `network-clubs-data-${suffix}.json`;
  const csvFilename = `network-clubs-data-${suffix}.csv`;
  
  const resultsPath = path.join(process.cwd(), 'results', filename);
  const csvPath = path.join(process.cwd(), 'results', csvFilename);
  
  // Создаем папку results если её нет
  const resultsDir = path.dirname(resultsPath);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Сохраняем JSON
  fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`💾 JSON результаты сохранены в: ${resultsPath}`);
  
  // Сохраняем CSV
  const csvContent = generateCSV(result.clubs);
  fs.writeFileSync(csvPath, csvContent, 'utf-8');
  console.log(`📊 CSV файл сохранен в: ${csvPath}`);
}

// Функция для генерации CSV
function generateCSV(clubs: any[]): string {
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

// Функция для вывода итоговой статистики
function printFinalSummary(result: any, regions: RegionData[]) {
  console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА:');
  console.log('─'.repeat(50));
  console.log(`🎯 Всего клубов найдено: ${result.totalFound}`);
  console.log(`🏘️ Регионов обработано: ${result.regionsProcessed}`);
  console.log(`🌐 Network запросов: ${result.networkRequests}`);
  console.log(`⏰ Время завершения: ${result.timestamp}`);
  console.log('─'.repeat(50));
  
  if (result.clubs.length > 0) {
    console.log('\n📋 Примеры найденных клубов:');
    result.clubs.slice(0, 5).forEach((club: any, index: number) => {
      console.log(`${index + 1}. ${club.name} (${club.regionName})`);
      console.log(`   📍 ${club.address}`);
      if (club.phone) console.log(`   📞 ${club.phone}`);
      if (club.rating) console.log(`   ⭐ ${club.rating} (${club.reviews || 0} отзывов)`);
      console.log('');
    });
    
    // Статистика по регионам
    const regionStats = result.clubs.reduce((acc: any, club: any) => {
      const regionName = club.regionName || 'Неизвестный регион';
      acc[regionName] = (acc[regionName] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n📈 Статистика по регионам:');
    Object.entries(regionStats)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10)
      .forEach(([region, count]) => {
        console.log(`  ${region}: ${count} клубов`);
      });
  }
}

// Запуск скрипта
if (require.main === module) {
  main();
} 