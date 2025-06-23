#!/usr/bin/env node

// Простой скрипт для быстрого тестирования регионов
// Использование: npx ts-node scripts/test-region.ts 10

import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface RegionData {
  id: number;
  name: string;
  url: string;
}

function loadRegions(): RegionData[] {
  const regionsPath = path.join(process.cwd(), 'results', 'regions-simple.json');
  
  if (!fs.existsSync(regionsPath)) {
    console.error(`❌ Файл с регионами не найден: ${regionsPath}`);
    console.log(`💡 Сначала запустите: npm run collect-regions`);
    process.exit(1);
  }
  
  const regionsData = fs.readFileSync(regionsPath, 'utf-8');
  return JSON.parse(regionsData);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🎯 Быстрый тест региона');
    console.log('💡 Использование:');
    console.log('  npx ts-node scripts/test-region.ts 10    # Тест региона с ID 10');
    console.log('  npx ts-node scripts/test-region.ts list  # Показать список регионов');
    process.exit(0);
  }
  
  if (args[0] === 'list') {
    console.log('📋 Доступные регионы:');
    const regions = loadRegions();
    regions.forEach(region => {
      console.log(`  ${region.id.toString().padStart(3)}: ${region.name}`);
    });
    process.exit(0);
  }
  
  const regionId = parseInt(args[0], 10);
  
  if (isNaN(regionId)) {
    console.error('❌ ID региона должно быть числом');
    process.exit(1);
  }
  
  const regions = loadRegions();
  const region = regions.find(r => r.id === regionId);
  
  if (!region) {
    console.error(`❌ Регион с ID ${regionId} не найден`);
    console.log('💡 Используйте: npx ts-node scripts/test-region.ts list');
    process.exit(1);
  }
  
  console.log(`🚀 Запуск тестирования региона: ${region.name} (ID: ${regionId})`);
  console.log(`🔗 URL: ${region.url}`);
  console.log('');
  
  // Запускаем основной скрипт с аргументом
  const command = `npm run network-scraper ${regionId}`;
  
  const child = exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Ошибка выполнения: ${error}`);
      return;
    }
    
    if (stderr) {
      console.error(`⚠️ Предупреждения: ${stderr}`);
    }
    
    console.log(stdout);
  });
  
  // Передаем вывод в реальном времени
  if (child.stdout) {
    child.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
  }
  
  if (child.stderr) {
    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  }
}

if (require.main === module) {
  main();
} 