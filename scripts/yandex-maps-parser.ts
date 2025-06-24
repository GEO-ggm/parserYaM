import { NetworkClubsParser, ClubData, SearchInfo } from './network-clubs-scraper';

// Упрощенный парсер для Яндекс Карт на основе реальной структуры JSON
export class YandexMapsParser implements NetworkClubsParser {
  
  isTargetRequest(url: string, method: string): boolean {
    // Проверяем, что это GET запрос к API поиска Яндекс Карт
    if (method !== 'GET') return false;
    
    // Забираем все запросы к API поиска
    return url.includes('https://yandex.ru/maps/api/search');
  }

  parseClubsData(jsonData: any): ClubData[] {
    const clubs: ClubData[] = [];
    
    try {
      // Данные лежат в data -> items
      if (jsonData.data && jsonData.data.items && Array.isArray(jsonData.data.items)) {
        clubs.push(...this.parseYandexItems(jsonData.data.items));
      }
      
    } catch (error) {
      console.log(`⚠️ Ошибка парсинга JSON: ${error}`);
    }
    
    return clubs;
  }

  private parseYandexItems(items: any[]): ClubData[] {
    return items
      .filter(item => this.isValidYandexItem(item))
      .map(item => this.parseYandexItem(item))
      .filter(club => club !== null) as ClubData[];
  }

  private isValidYandexItem(item: any): boolean {
    if (!item || typeof item !== 'object') return false;
    
    // Проверяем, что есть базовые поля
    return !!(item.title && (item.address || item.description || item.fullAddress));
  }

  private urlSeoname(item: any): string {
    return item.seoname;
  }

  private urlId(item: any): string {
    return item.id;
  }

  private findPhotoInObject(obj: any): string[] {
    const photos: string[] = [];
    
    if (!obj || typeof obj !== 'object') return photos;

    // Если это массив, ищем в каждом элементе
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const foundPhotos = this.findPhotoInObject(item);
        photos.push(...foundPhotos);
      }
      return photos;
    }

    // Если есть поле photo, добавляем его
    if (obj.photo) photos.push(obj.photo);

    // Ищем в дочерних объектах
    for (const key of Object.keys(obj)) {
      const foundPhotos = this.findPhotoInObject(obj[key]);
      photos.push(...foundPhotos);
    }

    return photos;
  }

  private parseYandexItem(item: any): ClubData | null {
    try {
      const club: ClubData = {
        name: item.title || 'Название не найдено',
        address: item.address || item.description || item.fullAddress || 'Адрес не найден',
        rawData: item
      };

      // Извлекаем seoname и id для формирования ссылки
      if (item.seoname) {
        club.urlSeoname = item.seoname;
      }
      if (item.id) {
        club.urlId = item.id;
      }

      // Ищем фото в порядке приоритета
      if (item.photo) {
        club.photo = item.photo;
        console.log(`📸 Найдено фото в основном хендлере для ${club.name}: ${club.photo}`);
      }
      else if (item.photos && item.photos.urlTemplate) {
        club.photo = item.photos.urlTemplate.replace('%s', 'L_height');
        console.log(`📸 Найдено фото в urlTemplate для ${club.name}: ${club.photo}`);
      }
      else if (item.advert && item.advert.photo) {
        club.photo = item.advert.photo;
        console.log(`📸 Найдено фото в рекламе для ${club.name}: ${club.photo}`);
      }

      // Для отладки
      console.log('Данные о фото:', {
        name: club.name,
        foundPhoto: club.photo || 'не найдено'
      });

      // Извлекаем дополнительные поля из структуры Яндекс Карт
      
      // Полный адрес
      if (item.fullAddress) {
        club.fullAddress = item.fullAddress;
      }

      // Страна и почтовый код
      if (item.country) {
        club.country = item.country;
      }
      
      if (item.postalCode) {
        club.postalCode = item.postalCode;
      }

      // Координаты (приходят как массив [lon, lat])
      if (item.coordinates && Array.isArray(item.coordinates) && item.coordinates.length >= 2) {
        club.coordinates = {
          lat: Number(item.coordinates[1]),
          lon: Number(item.coordinates[0])
        };
      }

      // Рейтинг и отзывы
      if (item.ratingData) {
        club.rating = item.ratingData.ratingValue;
        club.reviews = item.ratingData.reviewCount;
        club.ratingCount = item.ratingData.ratingCount;
      }

      // Категории
      if (item.categories && Array.isArray(item.categories)) {
        club.categories = item.categories.map((cat: any) => cat.name || cat).filter(Boolean);
      }

      // Телефоны
      if (item.phones && Array.isArray(item.phones) && item.phones.length > 0) {
        club.phone = item.phones[0].number || item.phones[0].value;
        club.phones = item.phones.map((phone: any) => phone.number || phone.value).filter(Boolean);
      }

      // Рабочее время
      if (item.workingTimeText) {
        club.workingHours = item.workingTimeText;
      } else if (item.workingTime) {
        club.workingHours = this.formatWorkingTime(item.workingTime);
      }

      // Социальные сети
      if (item.socialLinks && Array.isArray(item.socialLinks)) {
        club.socialLinks = item.socialLinks.map((link: any) => ({
          type: link.type,
          url: link.href
        }));
      }

      // Веб-сайты
      if (item.urls && Array.isArray(item.urls) && item.urls.length > 0) {
        club.website = item.urls[0];
        club.websites = item.urls;
      }

      return club;
    } catch (error) {
      console.log(`⚠️ Ошибка парсинга клуба из Яндекс Карт:`, error);
      return null;
    }
  }

  private formatWorkingTime(workingTime: any): string {
    if (!workingTime || !Array.isArray(workingTime)) return '';
    
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const formattedDays: string[] = [];
    
    workingTime.forEach((day, index) => {
      if (Array.isArray(day) && day.length > 0) {
        const schedule = day[0];
        if (schedule.from && schedule.to) {
          const from = `${schedule.from.hours}:${schedule.from.minutes.toString().padStart(2, '0')}`;
          const to = `${schedule.to.hours}:${schedule.to.minutes.toString().padStart(2, '0')}`;
          if (from === '0:00' && to === '0:00') {
            formattedDays.push(`${dayNames[index]}: круглосуточно`);
          } else {
            formattedDays.push(`${dayNames[index]}: ${from}-${to}`);
          }
        }
      }
    });
    
    return formattedDays.join(', ');
  }



  parseSearchInfo?(jsonData: any): SearchInfo {
    return {
      totalFound: jsonData.total || jsonData.totalCount || 0,
      searchQuery: jsonData.query || jsonData.searchQuery || 'компьютерные клубы',
      region: jsonData.region || jsonData.location || undefined
    };
  }
}

// Экспорт готового к использованию парсера
export const yandexMapsParser = new YandexMapsParser(); 