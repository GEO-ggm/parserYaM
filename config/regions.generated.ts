// Автоматически сгенерированный список регионов России
// Сгенерирован: 2025-06-23T15:08:56.425Z

export interface RegionInfo {
  id: string;
  name: string;
  url: string;
}

export const RUSSIAN_REGIONS: RegionInfo[] = [

];

export const getRegionUrl = (regionId: string): string => {
  return `https://yandex.ru/maps/${regionId}`;
};

export const findRegionById = (id: string): RegionInfo | undefined => {
  return RUSSIAN_REGIONS.find(region => region.id === id);
};

export const findRegionByName = (name: string): RegionInfo | undefined => {
  return RUSSIAN_REGIONS.find(region => 
    region.name.toLowerCase().includes(name.toLowerCase())
  );
};
