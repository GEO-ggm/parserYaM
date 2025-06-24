import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Интерфейсы
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

// Встроенный список российских регионов
const EMBEDDED_REGIONS: RegionInfo[] = [
  {
    "id": 1,
    "name": "moscow-and-moscow-oblast",
    "url": "https://yandex.ru/maps/1/moscow-and-moscow-oblast/category/computer_club/"
  },
  {
    "id": 2,
    "name": "saint-petersburg",
    "url": "https://yandex.ru/maps/2/saint-petersburg/category/computer_club/"
  },
  {
    "id": 4,
    "name": "belgorod",
    "url": "https://yandex.ru/maps/4/belgorod/category/computer_club/"
  },
  {
    "id": 5,
    "name": "ivanovo",
    "url": "https://yandex.ru/maps/5/ivanovo/category/computer_club/"
  },
  {
    "id": 6,
    "name": "kaluga",
    "url": "https://yandex.ru/maps/6/kaluga/category/computer_club/"
  },
  {
    "id": 7,
    "name": "kostroma",
    "url": "https://yandex.ru/maps/7/kostroma/category/computer_club/"
  },
  {
    "id": 8,
    "name": "kursk",
    "url": "https://yandex.ru/maps/8/kursk/category/computer_club/"
  },
  {
    "id": 9,
    "name": "lipetsk",
    "url": "https://yandex.ru/maps/9/lipetsk/category/computer_club/"
  },
  {
    "id": 10,
    "name": "orel",
    "url": "https://yandex.ru/maps/10/orel/category/computer_club/"
  },
  {
    "id": 11,
    "name": "ryazan",
    "url": "https://yandex.ru/maps/11/ryazan/category/computer_club/"
  },
  {
    "id": 12,
    "name": "smolensk",
    "url": "https://yandex.ru/maps/12/smolensk/category/computer_club/"
  },
  {
    "id": 13,
    "name": "tambov",
    "url": "https://yandex.ru/maps/13/tambov/category/computer_club/"
  },
  {
    "id": 15,
    "name": "tula",
    "url": "https://yandex.ru/maps/15/tula/category/computer_club/"
  },
  {
    "id": 16,
    "name": "yaroslavl",
    "url": "https://yandex.ru/maps/16/yaroslavl/category/computer_club/"
  },
  {
    "id": 18,
    "name": "petrozavodsk",
    "url": "https://yandex.ru/maps/18/petrozavodsk/category/computer_club/"
  },
  {
    "id": 19,
    "name": "syktyvkar",
    "url": "https://yandex.ru/maps/19/syktyvkar/category/computer_club/"
  },
  {
    "id": 20,
    "name": "arkhangelsk",
    "url": "https://yandex.ru/maps/20/arkhangelsk/category/computer_club/"
  },
  {
    "id": 21,
    "name": "vologda",
    "url": "https://yandex.ru/maps/21/vologda/category/computer_club/"
  },
  {
    "id": 22,
    "name": "kaliningrad",
    "url": "https://yandex.ru/maps/22/kaliningrad/category/computer_club/"
  },
  {
    "id": 23,
    "name": "murmansk",
    "url": "https://yandex.ru/maps/23/murmansk/category/computer_club/"
  },
  {
    "id": 24,
    "name": "veliky-novgorod",
    "url": "https://yandex.ru/maps/24/veliky-novgorod/category/computer_club/"
  },
  {
    "id": 25,
    "name": "pskov",
    "url": "https://yandex.ru/maps/25/pskov/category/computer_club/"
  },
  {
    "id": 28,
    "name": "makhachkala",
    "url": "https://yandex.ru/maps/28/makhachkala/category/computer_club/"
  },
  {
    "id": 30,
    "name": "nalchik",
    "url": "https://yandex.ru/maps/30/nalchik/category/computer_club/"
  },
  {
    "id": 33,
    "name": "vladikavkaz",
    "url": "https://yandex.ru/maps/33/vladikavkaz/category/computer_club/"
  },
  {
    "id": 35,
    "name": "krasnodar",
    "url": "https://yandex.ru/maps/35/krasnodar/category/computer_club/"
  },
  {
    "id": 36,
    "name": "stavropol",
    "url": "https://yandex.ru/maps/36/stavropol/category/computer_club/"
  },
  {
    "id": 37,
    "name": "astrahan",
    "url": "https://yandex.ru/maps/37/astrahan/category/computer_club/"
  },
  {
    "id": 38,
    "name": "volgograd",
    "url": "https://yandex.ru/maps/38/volgograd/category/computer_club/"
  },
  {
    "id": 39,
    "name": "rostov-na-donu",
    "url": "https://yandex.ru/maps/39/rostov-na-donu/category/computer_club/"
  },
  {
    "id": 41,
    "name": "yoshkar-ola",
    "url": "https://yandex.ru/maps/41/yoshkar-ola/category/computer_club/"
  },
  {
    "id": 42,
    "name": "saransk",
    "url": "https://yandex.ru/maps/42/saransk/category/computer_club/"
  },
  {
    "id": 43,
    "name": "kazan",
    "url": "https://yandex.ru/maps/43/kazan/category/computer_club/"
  },
  {
    "id": 44,
    "name": "izhevsk",
    "url": "https://yandex.ru/maps/44/izhevsk/category/computer_club/"
  },
  {
    "id": 45,
    "name": "cheboksary",
    "url": "https://yandex.ru/maps/45/cheboksary/category/computer_club/"
  },
  {
    "id": 46,
    "name": "kirov",
    "url": "https://yandex.ru/maps/46/kirov/category/computer_club/"
  },
  {
    "id": 47,
    "name": "nizhny-novgorod",
    "url": "https://yandex.ru/maps/47/nizhny-novgorod/category/computer_club/"
  },
  {
    "id": 48,
    "name": "orenburg",
    "url": "https://yandex.ru/maps/48/orenburg/category/computer_club/"
  },
  {
    "id": 49,
    "name": "penza",
    "url": "https://yandex.ru/maps/49/penza/category/computer_club/"
  },
  {
    "id": 50,
    "name": "perm",
    "url": "https://yandex.ru/maps/50/perm/category/computer_club/"
  },
  {
    "id": 51,
    "name": "samara",
    "url": "https://yandex.ru/maps/51/samara/category/computer_club/"
  },
  {
    "id": 53,
    "name": "kurgan",
    "url": "https://yandex.ru/maps/53/kurgan/category/computer_club/"
  },
  {
    "id": 54,
    "name": "yekaterinburg",
    "url": "https://yandex.ru/maps/54/yekaterinburg/category/computer_club/"
  },
  {
    "id": 55,
    "name": "tyumen",
    "url": "https://yandex.ru/maps/55/tyumen/category/computer_club/"
  },
  {
    "id": 56,
    "name": "chelyabinsk",
    "url": "https://yandex.ru/maps/56/chelyabinsk/category/computer_club/"
  },
  {
    "id": 57,
    "name": "khanty-mansiysk",
    "url": "https://yandex.ru/maps/57/khanty-mansiysk/category/computer_club/"
  },
  {
    "id": 58,
    "name": "salekhard",
    "url": "https://yandex.ru/maps/58/salekhard/category/computer_club/"
  },
  {
    "id": 62,
    "name": "krasnoyarsk",
    "url": "https://yandex.ru/maps/62/krasnoyarsk/category/computer_club/"
  },
  {
    "id": 63,
    "name": "irkutsk",
    "url": "https://yandex.ru/maps/63/irkutsk/category/computer_club/"
  },
  {
    "id": 64,
    "name": "kemerovo",
    "url": "https://yandex.ru/maps/64/kemerovo/category/computer_club/"
  },
  {
    "id": 65,
    "name": "novosibirsk",
    "url": "https://yandex.ru/maps/65/novosibirsk/category/computer_club/"
  },
  {
    "id": 66,
    "name": "omsk",
    "url": "https://yandex.ru/maps/66/omsk/category/computer_club/"
  },
  {
    "id": 67,
    "name": "tomsk",
    "url": "https://yandex.ru/maps/67/tomsk/category/computer_club/"
  },
  {
    "id": 68,
    "name": "chita",
    "url": "https://yandex.ru/maps/68/chita/category/computer_club/"
  },
  {
    "id": 74,
    "name": "yakutsk",
    "url": "https://yandex.ru/maps/74/yakutsk/category/computer_club/"
  },
  {
    "id": 75,
    "name": "vladivostok",
    "url": "https://yandex.ru/maps/75/vladivostok/category/computer_club/"
  },
  {
    "id": 76,
    "name": "khabarovsk",
    "url": "https://yandex.ru/maps/76/khabarovsk/category/computer_club/"
  },
  {
    "id": 77,
    "name": "blagoveshchensk",
    "url": "https://yandex.ru/maps/77/blagoveshchensk/category/computer_club/"
  },
  {
    "id": 78,
    "name": "petropavlovsk",
    "url": "https://yandex.ru/maps/78/petropavlovsk/category/computer_club/"
  },
  {
    "id": 79,
    "name": "magadan",
    "url": "https://yandex.ru/maps/79/magadan/category/computer_club/"
  },
  {
    "id": 80,
    "name": "yuzhno-sakhalinsk",
    "url": "https://yandex.ru/maps/80/yuzhno-sakhalinsk/category/computer_club/"
  },
  {
    "id": 172,
    "name": "ufa",
    "url": "https://yandex.ru/maps/172/ufa/category/computer_club/"
  },
  {
    "id": 191,
    "name": "bryansk",
    "url": "https://yandex.ru/maps/191/bryansk/category/computer_club/"
  },
  {
    "id": 192,
    "name": "vladimir",
    "url": "https://yandex.ru/maps/192/vladimir/category/computer_club/"
  },
  {
    "id": 193,
    "name": "voronezh",
    "url": "https://yandex.ru/maps/193/voronezh/category/computer_club/"
  },
  {
    "id": 194,
    "name": "saratov",
    "url": "https://yandex.ru/maps/194/saratov/category/computer_club/"
  },
  {
    "id": 195,
    "name": "ulyanovsk",
    "url": "https://yandex.ru/maps/195/ulyanovsk/category/computer_club/"
  },
  {
    "id": 197,
    "name": "barnaul",
    "url": "https://yandex.ru/maps/197/barnaul/category/computer_club/"
  },
  {
    "id": 198,
    "name": "ulan-ude",
    "url": "https://yandex.ru/maps/198/ulan-ude/category/computer_club/"
  },
  {
    "id": 235,
    "name": "magnitogorsk",
    "url": "https://yandex.ru/maps/235/magnitogorsk/category/computer_club/"
  },
  {
    "id": 236,
    "name": "naberezhnye-chelny",
    "url": "https://yandex.ru/maps/236/naberezhnye-chelny/category/computer_club/"
  },
  {
    "id": 237,
    "name": "novokuznetsk",
    "url": "https://yandex.ru/maps/237/novokuznetsk/category/computer_club/"
  },
  {
    "id": 238,
    "name": "novocherkassk",
    "url": "https://yandex.ru/maps/238/novocherkassk/category/computer_club/"
  },
  {
    "id": 239,
    "name": "sochi",
    "url": "https://yandex.ru/maps/239/sochi/category/computer_club/"
  },
  {
    "id": 240,
    "name": "togliatti",
    "url": "https://yandex.ru/maps/240/togliatti/category/computer_club/"
  }
];

// Селекторы для Яндекс Карт
const YANDEX_MAPS_SELECTORS = {
  nameClub: '.search-business-snippet-view__title',
  adressClub: '.search-business-snippet-view__address',
};

export class ClubsParserSimple {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init() {
    this.browser = await chromium.launch({ 
      headless: false,
      timeout: 60000 
    });
    this.page = await this.browser.newPage();
    
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
      
      await this.page.goto(region.url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      await this.page.waitForTimeout(5000);

      // Проверяем, есть ли результаты поиска
      try {
        await this.page.waitForSelector(YANDEX_MAPS_SELECTORS.nameClub, { 
          timeout: 10000 
        });
        
        const clubs = await this.extractClubsData();
        
        result.clubs = clubs;
        result.clubsSum = clubs.length;
        result.status = 'success';
        
        console.log(`✅ ${region.name}: найдено ${clubs.length} клубов`);
        
      } catch (error) {
        result.status = 'success';
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

    console.log('📜 Прокручиваем для загрузки результатов...');
    
    // Прокручиваем несколько раз
    for (let i = 0; i < 10; i++) { 
      await this.page.evaluate(function() {
        const searchResults = document.querySelector('.scroll__container');
        if (searchResults) {
          searchResults.scrollTo(0, searchResults.scrollHeight);
        }
      });
      await this.page.waitForTimeout(1500);
    }

    // Получаем данные о клубах
    const clubNames = await this.page.$$eval(
      YANDEX_MAPS_SELECTORS.nameClub, 
      function(elements) { 
        return elements.map(function(el) { 
          return el.textContent ? el.textContent.trim() : ''; 
        }); 
      }
    );

    const clubAddresses = await this.page.$$eval(
      YANDEX_MAPS_SELECTORS.adressClub, 
      function(elements) { 
        return elements.map(function(el) { 
          return el.textContent ? el.textContent.trim() : ''; 
        }); 
      }
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

  async parseAllRegions(): Promise<ParseResult> {
    console.log(`🚀 Начинаем парсинг клубов в ${EMBEDDED_REGIONS.length} регионах...\n`);

    const results: RegionClubsData[] = [];
    let totalClubs = 0;

    for (const region of EMBEDDED_REGIONS) {
      const regionData = await this.parseRegionClubs(region);
      results.push(regionData);
      
      if (regionData.status === 'success') {
        totalClubs += regionData.clubsSum;
      }

      this.printRegionResult(regionData);
      
      await this.page?.waitForTimeout(2000);
    }

    const parseResult: ParseResult = {
      totalRegions: EMBEDDED_REGIONS.length,
      successfulRegions: results.filter(r => r.status === 'success').length,
      totalClubs: totalClubs,
      regionsData: results,
      timestamp: new Date().toISOString()
    };

    return parseResult;
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

  async saveCSVResults(result: ParseResult) {
    const resultsDir = path.join(process.cwd(), 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const csvContent = this.generateCSV(result.regionsData);
    const csvPath = path.join(resultsDir, `regions-clubs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`);
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
async function main() {
  const parser = new ClubsParserSimple();
  
  try {
    console.log('🎮 Запускаем простой парсер компьютерных клубов...\n');
    
    await parser.init();
    
    const result = await parser.parseAllRegions();
    
    await parser.saveCSVResults(result);
    
    parser.printSummary(result);
    
    console.log('\n✅ Парсинг завершен успешно!');
    
  } catch (error) {
    console.error('❌ Критическая ошибка при парсинге:', error);
    process.exit(1);
  } finally {
    await parser.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
} 