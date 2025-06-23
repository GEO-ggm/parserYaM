import { chromium, Browser, Page, Response } from '@playwright/test';
import { yandexMapsConfig } from '../config/yandex-maps.config';
import * as fs from 'fs';
import * as path from 'path';

// Модель для парсинга JSON данных из Яндекс Карт
export interface NetworkClubsParser {
  // Функция для определения нужного ли это запрос
  isTargetRequest: (url: string, method: string) => boolean;
  
  // Функция для извлечения данных о клубах из JSON ответа
  parseClubsData: (jsonData: any) => ClubData[];
  
  // Функция для извлечения общей информации о поиске
  parseSearchInfo?: (jsonData: any) => SearchInfo;
}

export interface ClubData {
  name: string;
  address: string;
  fullAddress?: string;
  country?: string;
  postalCode?: string;
  coordinates?: {
    lat: number;
    lon: number;
  };
  phone?: string;
  phones?: string[];
  website?: string;
  websites?: string[];
  rating?: number;
  reviews?: number;
  ratingCount?: number;
  categories?: string[];
  workingHours?: string;
  socialLinks?: Array<{
    type: string;
    url: string;
  }>;
  regionId?: number;
  regionName?: string;
  sourceRegionUrl?: string;
  rawData?: any; // Исходные данные для отладки
}

export interface SearchInfo {
  totalFound: number;
  searchQuery: string;
  region?: string;
}

interface ScrapingResult {
  totalFound: number;
  clubs: ClubData[];
  searchInfo?: SearchInfo;
  timestamp: string;
  sourceUrl: string;
  networkRequests: number;
}

export class NetworkClubsScraper {
  private browser: Browser | null = null;
  public page: Page | null = null;
  public clubsData: ClubData[] = [];
  public networkRequests: number = 0;
  private parser: NetworkClubsParser;
  private processedCoordinates: Set<string> = new Set(); // Для отслеживания уже найденных координат
  
  constructor(parser: NetworkClubsParser) {
    this.parser = parser;
  }

  async init() {
    this.browser = await chromium.launch({ 
      headless: false,
      timeout: 60000 
    });
    this.page = await this.browser.newPage();
    
    // Устанавливаем русский язык и увеличиваем viewport
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'ru-RU,ru;q=0.9'
    });
    
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    
    // Настраиваем перехват network-запросов
    await this.setupNetworkInterception();
  }

  private async setupNetworkInterception() {
    if (!this.page) return;

    // Перехватываем все response'ы
    this.page.on('response', async (response: Response) => {
      try {
        const url = response.url();
        const method = response.request().method();
        
        // Проверяем, нужен ли нам этот запрос
        if (this.parser.isTargetRequest(url, method)) {
          console.log(`🔍 Перехвачен запрос: ${method} ${url}`);
          this.networkRequests++;
          
          // Получаем JSON данные
          const jsonData = await response.json();
          
          // Парсим данные о клубах
          const clubs = this.parser.parseClubsData(jsonData);
          
          if (clubs.length > 0) {
            // Фильтруем дубликаты на лету
            const newClubs = this.filterNewClubs(clubs);
            
            if (newClubs.length > 0) {
              console.log(`📦 Извлечено новых клубов из запроса: ${newClubs.length} (всего было: ${clubs.length})`);
              this.clubsData.push(...newClubs);
            } else {
              console.log(`🔄 Все клубы из запроса уже были найдены ранее (${clubs.length} дубликатов)`);
            }
          }
          
          // Сохраняем raw данные для отладки (опционально)
          await this.saveRawNetworkData(jsonData, `network-${this.networkRequests}.json`);
        }
      } catch (error) {
        console.log(`⚠️ Ошибка при обработке response: ${error}`);
      }
    });
  }

  async scrapeClubsFromNetwork(scrollIterations: number = 10): Promise<ScrapingResult> {
    if (!this.page) {
      throw new Error('Scraper not initialized');
    }

    console.log('🚀 Начинаем сбор данных через network...');
    console.log(`📍 URL: ${yandexMapsConfig.startUrl}`);
    console.log(`🔄 Количество прокруток: ${scrollIterations}\n`);

    try {
      // Очищаем предыдущие данные
      this.clubsData = [];
      this.networkRequests = 0;
      this.processedCoordinates.clear();
      console.log('🧹 Очищены данные предыдущего сбора');

      // Переходим на страницу поиска
      await this.page.goto(yandexMapsConfig.startUrl, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      console.log('⏳ Ждем загрузки первичных результатов...');
      await this.page.waitForTimeout(3000);

      // Прокручиваем для загрузки данных
      await this.scrollToTriggerRequests(scrollIterations);

      // Ждем завершения всех запросов
      await this.page.waitForTimeout(2000);

      // Удаляем дубликаты по названию и адресу
      const uniqueClubs = this.removeDuplicates(this.clubsData);

      const result: ScrapingResult = {
        totalFound: uniqueClubs.length,
        clubs: uniqueClubs,
        timestamp: new Date().toISOString(),
        sourceUrl: yandexMapsConfig.startUrl,
        networkRequests: this.networkRequests
      };

      console.log(`\n🎉 Собрано ${uniqueClubs.length} уникальных клубов из ${this.networkRequests} network-запросов`);
      return result;

    } catch (error) {
      console.error('❌ Ошибка при сборе данных:', error);
      throw error;
    }
  }

  async scrollToTriggerRequests(iterations: number) {
    if (!this.page) return;

    console.log('📜 Прокручиваем для загрузки данных...');
    
    // Сначала делаем небольшой скролл назад для активации запросов
    await this.page.evaluate(() => {
      const searchResults = document.querySelector('.scroll__container');
      if (searchResults) {
        searchResults.scrollTo(0, Math.max(0, searchResults.scrollTop - 100));
      }
    });
    await this.page.waitForTimeout(500);
    
    let lastClubCount = 0;
    let noChangeCount = 0;
    const MAX_NO_CHANGE = 2; // Максимальное количество итераций без изменений
    
    for (let i = 0; i < iterations; i++) { 
      const currentClubCount = this.clubsData.length;
      
      // Проверяем, изменилось ли количество клубов
      
      if (currentClubCount === lastClubCount) {
        noChangeCount++;
        console.log(`⚠️ Количество клубов не изменилось (${noChangeCount}/${MAX_NO_CHANGE}): ${currentClubCount}`);
        console.log(`⚠️ Дергаем карту назад`);
        await this.scrollOnMapBackward();
        
        if (noChangeCount >= MAX_NO_CHANGE) {
          console.log('🛑 Количество клубов не изменялось 2 итерации подряд, завершаем сбор');
          break;
        }
      } else {
        noChangeCount = 0; // Сбрасываем счетчик, если количество изменилось
        console.log(`📈 Прогресс: +${currentClubCount - lastClubCount} клубов (всего: ${currentClubCount})`);
      }
      
      lastClubCount = currentClubCount;

      // Проверяем видимость элемента add-business-view
      const isAddBusinessVisible = await this.page.evaluate(() => {
        const addBusinessElement = document.querySelector('.add-business-view');
        if (addBusinessElement) {
          const rect = addBusinessElement.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= window.innerHeight;
        }
        return false;
      });

      // Если элемент виден, ждем 1 секунду и проверяем снова
      if (isAddBusinessVisible) {
        console.log('⏸️ Обнаружен элемент add-business-view, ждем 1 секунду...');
        await this.page.waitForTimeout(1000);
        
        const isStillVisible = await this.page.evaluate(() => {
          const addBusinessElement = document.querySelector('.add-business-view');
          if (addBusinessElement) {
            const rect = addBusinessElement.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
          }
          return false;
        });
        
        if (isStillVisible) {
          console.log('🗺️ Элемент add-business-view виден больше 1 секунды, переключаемся на карту...');
          
          // Переходим к работе с картой (скроллим назад)
          const mapScrollResult = await this.scrollOnMapBackward();
          
          if (mapScrollResult) {
            console.log('✅ Скролл назад по карте выполнен, возвращаемся к списку результатов...');
            
            // Возвращаем фокус на список результатов
            await this.returnToResultsList();
            
            // После скролла по карте ждем немного и продолжаем
            await this.page.waitForTimeout(2000);
            continue;
          } else {
            console.log('📍 Не удалось выполнить скролл по карте, завершаем сбор');
            break;
          }
        }
      }

      // Прокручиваем вниз в списке результатов
      await this.page.evaluate(() => {
        const searchResults = document.querySelector('.scroll__container');
        if (searchResults) {
          searchResults.scrollTo(0, searchResults.scrollHeight);
        }
      });

      console.log(`📈 Прокрутка ${i + 1}/${iterations}, собрано клубов: ${this.clubsData.length}`);
      
      // Ждем загрузки новых данных
      await this.page.waitForTimeout(1500);
    }

    console.log(`🏁 Завершение скролла. Итого собрано клубов: ${this.clubsData.length}`);
  }

  private async scrollOnMapBackward(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Ищем контейнер карты
      const mapContainer = await this.page.$('.map-container');
      
      if (!mapContainer) {
        console.log('⚠️ Контейнер карты .map-container не найден');
        return false;
      }

      console.log('🖱️ Наводим мышку на карту...');
      
      // Получаем размеры и позицию контейнера карты
      const mapBoundingBox = await mapContainer.boundingBox();
      
      if (!mapBoundingBox) {
        console.log('⚠️ Не удалось получить размеры контейнера карты');
        return false;
      }

      // Вычисляем центр карты
      const centerX = mapBoundingBox.x + mapBoundingBox.width / 2;
      const centerY = mapBoundingBox.y + mapBoundingBox.height / 2;

      // Наводим мышку на центр карты
      await this.page.mouse.move(centerX, centerY);
      await this.page.waitForTimeout(300);

      console.log('🔄 Выполняем скролл назад на карте для изменения области просмотра...');
      
      // Выполняем несколько скроллов назад на карте для значительного изменения области
      await this.page.mouse.wheel(0, 500); // Больший скролл назад
      await this.page.waitForTimeout(500);
      await this.page.mouse.wheel(0, 500); // Еще один скролл назад
      
      await this.page.waitForTimeout(1000);

      console.log('✅ Скролл назад по карте выполнен');
      return true;

    } catch (error) {
      console.log(`⚠️ Ошибка при работе с картой: ${error}`);
      return false;
    }
  }

  private async returnToResultsList(): Promise<void> {
    if (!this.page) return;

    try {
      console.log('↩️ Возвращаем фокус на список результатов...');
      
      // Ищем контейнер со списком результатов
      const resultsContainer = await this.page.$('.scroll__container');
      
      if (resultsContainer) {
        // Получаем размеры контейнера списка
        const resultsBoundingBox = await resultsContainer.boundingBox();
        
        if (resultsBoundingBox) {
          // Наводим мышку на центр списка результатов
          const centerX = resultsBoundingBox.x + resultsBoundingBox.width / 2;
          const centerY = resultsBoundingBox.y + resultsBoundingBox.height / 2;
          
          await this.page.mouse.move(centerX, centerY);
          await this.page.waitForTimeout(300);
          
          console.log('✅ Фокус возвращен на список результатов');
        }
      } else {
        console.log('⚠️ Контейнер списка результатов .scroll__container не найден');
      }

    } catch (error) {
      console.log(`⚠️ Ошибка при возврате к списку результатов: ${error}`);
    }
  }

  private filterNewClubs(clubs: ClubData[]): ClubData[] {
    const newClubs: ClubData[] = [];
    
    for (const club of clubs) {
      // Создаем ключ только по координатам для проверки дубликатов
      let coordinateKey = '';
      if (club.coordinates && club.coordinates.lat && club.coordinates.lon) {
        // Округляем координаты до 6 знаков для учета небольших погрешностей
        const lat = Number(club.coordinates.lat).toFixed(6);
        const lon = Number(club.coordinates.lon).toFixed(6);
        coordinateKey = `${lat},${lon}`;
      } else {
        // Если нет координат, пропускаем клуб (или можно добавить альтернативную логику)
        console.log(`⚠️ Пропускаем клуб без координат: ${club.name}`);
        continue;
      }
      
      // Проверяем дубликаты только по координатам
      if (this.processedCoordinates.has(coordinateKey)) {
        console.log(`🔄 Пропускаем дубликат по координатам: ${club.name} (${coordinateKey})`);
        continue;
      }
      
      // Если координаты новые - добавляем клуб и запоминаем координаты
      this.processedCoordinates.add(coordinateKey);
      newClubs.push(club);
    }
    
    return newClubs;
  }

  removeDuplicates(clubs: ClubData[]): ClubData[] {
    const seenCoordinates = new Set<string>();
    return clubs.filter(club => {
      if (!club.coordinates || !club.coordinates.lat || !club.coordinates.lon) {
        // Пропускаем клубы без координат
        return false;
      }
      
      const lat = Number(club.coordinates.lat).toFixed(6);
      const lon = Number(club.coordinates.lon).toFixed(6);
      const coordinateKey = `${lat},${lon}`;
      
      if (seenCoordinates.has(coordinateKey)) {
        return false;
      }
      seenCoordinates.add(coordinateKey);
      return true;
    });
  }

  private async saveRawNetworkData(data: any, filename: string) {
    const debugPath = path.join(process.cwd(), 'results', 'debug', filename);
    
    // Создаем папку debug если её нет
    const debugDir = path.dirname(debugPath);
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    fs.writeFileSync(debugPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async saveResults(result: ScrapingResult, filename: string = 'network-clubs-data.json') {
    const resultsPath = path.join(process.cwd(), 'results', filename);
    
    // Создаем папку results если её нет
    const resultsDir = path.dirname(resultsPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Сохраняем результаты
    fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`💾 Результаты сохранены в: ${resultsPath}`);
    
    // Создаем также CSV файл
    const csvContent = this.generateCSV(result.clubs);
    const csvPath = path.join(resultsDir, 'network-clubs-data.csv');
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    console.log(`📊 CSV файл сохранен в: ${csvPath}`);
  }

  private generateCSV(clubs: ClubData[]): string {
    const header = 'Название,Адрес,Полный адрес,Страна,Почтовый код,Телефон,Все телефоны,Сайт,Все сайты,Рейтинг,Отзывы,Количество оценок,Категории,Часы работы,Социальные сети,Широта,Долгота\n';
    const rows = clubs.map(club => {
      const lat = club.coordinates?.lat || '';
      const lon = club.coordinates?.lon || '';
      const phones = club.phones?.join('; ') || club.phone || '';
      const websites = club.websites?.join('; ') || club.website || '';
      const categories = club.categories?.join('; ') || '';
      const socialLinks = club.socialLinks?.map(link => `${link.type}: ${link.url}`).join('; ') || '';
      
      return `"${(club.name || '').replace(/"/g, '""')}","${(club.address || '').replace(/"/g, '""')}","${(club.fullAddress || '').replace(/"/g, '""')}","${(club.country || '').replace(/"/g, '""')}","${(club.postalCode || '').replace(/"/g, '""')}","${(club.phone || '').replace(/"/g, '""')}","${phones.replace(/"/g, '""')}","${(club.website || '').replace(/"/g, '""')}","${websites.replace(/"/g, '""')}","${club.rating || ''}","${club.reviews || ''}","${club.ratingCount || ''}","${categories.replace(/"/g, '""')}","${(club.workingHours || '').replace(/"/g, '""')}","${socialLinks.replace(/"/g, '""')}","${lat}","${lon}"`;
    }).join('\n');
    
    return header + rows;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // Метод для сброса данных при работе с новым регионом
  clearRegionData() {
    this.clubsData = [];
    this.networkRequests = 0;
    this.processedCoordinates.clear();
    console.log('🌍 Данные региона очищены для нового сбора');
  }

  printSummary(result: ScrapingResult) {
    console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА:');
    console.log('─'.repeat(50));
    console.log(`🎯 Всего клубов найдено: ${result.totalFound}`);
    console.log(`🌐 Network запросов: ${result.networkRequests}`);
    console.log(`📍 Обработано уникальных координат: ${this.processedCoordinates.size}`);
    console.log(`⏰ Время сбора: ${result.timestamp}`);
    console.log(`🔗 Источник: ${result.sourceUrl}`);
    console.log('─'.repeat(50));
    
    if (result.clubs.length > 0) {
      console.log('\n📋 Примеры найденных клубов:');
      result.clubs.slice(0, 5).forEach((club, index) => {
        console.log(`${index + 1}. ${club.name}`);
        console.log(`   📍 ${club.address}`);
        if (club.fullAddress && club.fullAddress !== club.address) {
          console.log(`   🏠 ${club.fullAddress}`);
        }
        if (club.phone) console.log(`   📞 ${club.phone}`);
        if (club.rating) console.log(`   ⭐ ${club.rating} (${club.reviews || 0} отзывов)`);
        if (club.categories) console.log(`   🏷️ ${club.categories.join(', ')}`);
        if (club.workingHours) console.log(`   🕐 ${club.workingHours}`);
        if (club.website) console.log(`   🌐 ${club.website}`);
        console.log('');
      });
    }
  }
}

// Экспорт функции для запуска
export async function runNetworkClubsScraping(
  parser: NetworkClubsParser, 
  scrollIterations: number = 10
) {
  const scraper = new NetworkClubsScraper(parser);
  
  try {
    await scraper.init();
    const result = await scraper.scrapeClubsFromNetwork(scrollIterations);
    await scraper.saveResults(result);
    scraper.printSummary(result);
    return result;
  } finally {
    await scraper.close();
  }
} 