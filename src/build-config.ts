import * as path from 'path';
import * as fs from 'fs';

// Расширяем типизацию process для поддержки pkg
declare global {
  namespace NodeJS {
    interface Process {
      pkg?: any;
    }
  }
}

export function getRegionsPath(): string {
  // Проверяем, работаем ли мы из скомпилированного EXE
  if (process.pkg) {
    // В EXE файле ищем regions-simple.json рядом с исполняемым файлом
    const exePath = process.execPath;
    const exeDir = path.dirname(exePath);
    // Пробуем найти файл в нескольких местах
    const possiblePaths = [
      path.join(exeDir, 'regions-simple.json'),
      path.join(exeDir, 'results', 'regions-simple.json'),
      path.join(process.cwd(), 'results', 'regions-simple.json')
    ];
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return possiblePath;
      }
    }
    
    // Если не нашли, используем путь относительно EXE
    return path.join(exeDir, 'regions-simple.json');
  } else {
    // В режиме разработки используем стандартный путь
    return path.join(process.cwd(), 'results', 'regions-simple.json');
  }
} 