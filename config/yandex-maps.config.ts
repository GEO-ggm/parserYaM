export interface YandexMapsConfig {
  startUrl: string;
  maxResults?: number;
}

export const yandexMapsConfig: YandexMapsConfig = {
  // Регион для поиска (можно изменить на любой город)
  startUrl: 'https://yandex.ru/maps/?display-text=%D0%9A%D0%BE%D0%BC%D0%BF%D1%8C%D1%8E%D1%82%D0%B5%D1%80%D0%BD%D1%8B%D0%B9%20%D0%BA%D0%BB%D1%83%D0%B1&ll=-167.588027%2C-3.537040&mode=search&sctx=ZAAAAAgBEAAaKAoSCb75DRMNzFdAEZYmpaDbSwzAEhIJAAAAAIBphkART7LV5ZS%2FZUAiBgABAgMEBSgKOABAkE5IAWIlcmVsZXZfcmFua2luZ19mb3JtdWxhPWwyX2RjODA3NTY5X2V4cGIscmVsZXZfcnVicmljX3JhbmtpbmdfZm9ybXVsYT1sMl9kYzgwNzU2OV9leHBiH3JhbmtpbmdfZm9ybXVsYT1sMl9kYzgwNzU2OV9leHBqAnJ1nQHNzMw9oAEAqAEAvQEToT8hwgEG%2B8G1lJIEggIdKChjYXRlZ29yeV9pZDooOTc1NTA4NTY1MDYpKSmKAgs5NzU1MDg1NjUwNpICAJoCDGRlc2t0b3AtbWFwc6oC%2FwExMTU1NzU3MDAwMTUsMTU4Mjg0NDUyNDA3LDE2ODc0OTg2MTAzMiwxMDg5MzY4OTk4MDcsMTcyNjg5NjI1MDE2LDE4NzAyNDc2MzMzNCw3NzA3OTU2ODc0MiwyMDI2MTU2NjA1OTcsMTg2OTQwMDEwMTAsNTY4OTc1OTE4MTYsMTUzOTg0NjA1MzY5LDE2MzAyNDg3NzYxMiwxOTY5MTgzMjgzNTMsMjMzNTY2MTc0MzcyLDIxNDYxNjM3Mzk5MiwxNTQ2NzMxMDQwODksMTU2NTcwMTQ5Njc3LDE4ODY1NzAyNzc2MSwyMDkyMjMyNDIxNjYsMjI0ODYwODA3ODM%3D&sll=60.600967%2C56.830011&sspn=2.801514%2C0.892172&text=%7B%22text%22%3A%22%D0%9A%D0%BE%D0%BC%D0%BF%D1%8C%D1%8E%D1%82%D0%B5%D1%80%D0%BD%D1%8B%D0%B9%20%D0%BA%D0%BB%D1%83%D0%B1%22%2C%22what%22%3A%5B%7B%22attr_name%22%3A%22category_id%22%2C%22attr_values%22%3A%5B%2297550856506%22%5D%7D%5D%7D&z=2',
  
  // Максимальное количество результатов для обработки
  maxResults: 8000
};



// Селекторы для Яндекс Карт
export const YANDEX_MAPS_SELECTORS = {
  nameClub: '.search-business-snippet-view__title',
  adressClub: '.search-business-snippet-view__address',
}; 