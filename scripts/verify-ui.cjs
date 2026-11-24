// Проверка интерфейса в скрытом Chromium из установленного Electron.
// Перед запуском: npm run dev -- --port 5173.
const electron = require('electron');
// Окружение редактора может запускать Electron как Node; дочерний процесс должен быть браузером.
if (typeof electron === 'string') {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = require('node:child_process').spawnSync(electron, [__filename], {
    env, stdio: 'inherit', windowsHide: true,
  });
  if (result.error) console.error(result.error);
  process.exit(result.status ?? 1);
}
const { app, BrowserWindow } = electron;
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cardioatlas-ui-'));
app.setPath('userData', path.join(outputDir, 'profile'));
app.commandLine.appendSwitch('force-device-scale-factor', '1');
const errors = [];
let win;
const timeout = setTimeout(() => {
  fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify({ errors: [...errors, 'Превышено время проверки'] }));
  app.exit(1);
}, 90000);

app.whenReady().then(async () => {
  try {
    win = new BrowserWindow({ show: false, width: 1440, height: 1050, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true } });
    win.webContents.on('console-message', (_event, level, message) => {
      if (level === 3) errors.push(message);
    });
    win.webContents.session.webRequest.onCompleted((details) => {
      if (details.statusCode >= 400) errors.push(`${details.statusCode} ${details.url}`);
    });
    win.webContents.session.webRequest.onErrorOccurred((details) => errors.push(`${details.error} ${details.url}`));
    await win.loadURL('http://localhost:5173/');
    const results = await win.webContents.executeJavaScript(`(async () => {
      const wait = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const click = async (text) => {
        const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
        check(button, 'Не найдена кнопка: ' + text); button.click(); await wait();
      };
      const text = () => document.body.innerText;
      await wait(3500);
      check(text().includes('Клинические рекомендации РФ, 2024'), 'Нет обозначения источника');
      await click('ПМЖВ дист.');
      check(text().includes('Дистальный сегмент ПМЖВ (LAD)'), 'Нет правильного названия дистального сегмента');
      check(text().includes('ПМЖВ дист. (LAD)'), 'Нет подписи дистального сегмента на 3D-модели');
      check(!text().includes('Длинная ПМЖВ'), 'Осталось прежнее название случая');
      for (const label of ['ПКА прокс.', 'ПМЖВ прокс.', 'ОВ / ВТК', 'Задний ИМ', 'ПМЖВ прокс.']) await click(label);
      await click('ОКСбпST / паттерны');
      for (const label of ['ИМбпST нижн.', 'Велленс A', 'Велленс B', 'де Винтер', 'Ствол ЛКА']) await click(label);
      await click('ИМпST (STEMI)');
      await click('Левый тип'); await click('Правый тип');
      await click('Сравнить с ранней успешной реперфузией');
      check(text().includes('После ранней успешной реперфузии'), 'Нет ветки реперфузии');
      const slider = document.querySelector('input[type="range"][max="1"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(slider, '0.8');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      await wait();
      await click('После ранней успешной реперфузии · TIMI 3');
      const lead = (name) => [...document.querySelectorAll('button[title="Клик: ST↑ → ST↓ → T↓ → Сброс"]')].find(b => b.querySelector('span')?.textContent === name);
      for (let i = 0; i < 3; i++) { lead('V2').click(); await wait(); }
      check(text().includes('Паттерн пока не определён'), 'Одиночный T ошибочно определил сценарий');
      check(!text().includes('Нормальное русло задано'), 'Недостаточные данные показаны как нормальная анатомия');
      check(!text().includes('Совпадение'), 'Остались проценты');
      check(text().includes('не оценено'), 'Нет состояния неоценённых отведений');
      await click('Сброс');
      for (let i = 0; i < 2; i++) { lead('V1').click(); await wait(); }
      check(text().includes('Доснять: V7, V8, V9'), 'Нет задних отведений при неполных данных');
      await click('Показать на ленте');
      await click('Сброс');
      for (const name of ['II', 'III', 'aVF']) { lead(name).click(); await wait(); }
      check(text().includes('Учебная гипотеза'), 'Не сформирована гипотеза нижнего паттерна');
      check(text().includes('V4R'), 'Нет рекомендации оценить ПЖ');
      await click('Сброс');
      await click('КАГ (С-дуга)');
      await wait(500);
      await click('Центр');
      await click('Анатомия 3D');
      await click('ПКА прокс.');
      await wait(800);
      for (const label of ['Подпись', 'Подписи выкл.', 'Все подписи']) await click(label);
      const canvas = document.querySelector('canvas');
      const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
      canvas.dispatchEvent(menu);
      check(menu.defaultPrevented, 'Контекстное меню 3D не подавлено');
      const details = [...document.querySelectorAll('summary')].find(s => s.textContent.includes('Пороговые критерии'));
      details.click(); await wait();
      check(text().includes('≥2,5 мм'), 'Нет возрастного порога ST');
      return { scenarios: 'Переключения STEMI/ОКСбпST, дополнительных отведений, доминирования, реперфузии, ручного ввода, сброса и режима КАГ выполнены', canvases: document.querySelectorAll('canvas').length };
    })()`);
    const screenshot = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outputDir, 'interface.png'), screenshot.toPNG());
    const scrollY = await win.webContents.executeJavaScript(`(async () => {
      const heading = [...document.querySelectorAll('p')].find(p => p.textContent === 'Основа: клинические рекомендации РФ, 2024');
      heading.scrollIntoView({ block: 'start', behavior: 'instant' });
      await new Promise(resolve => setTimeout(resolve, 350));
      return window.scrollY;
    })()`);
    if (scrollY <= 0) throw new Error('Не удалось прокрутить к клиническому разбору');
    fs.writeFileSync(path.join(outputDir, 'clinical.png'), (await win.webContents.capturePage()).toPNG());
    for (const [id, filename] of [['normal', 'ecg-normal'], ['lad_prox', 'ecg-stemi'], ['de_winter', 'ecg-de-winter'], ['wellens_a', 'ecg-wellens-a'], ['wellens_b', 'ecg-wellens-b'], ['nstemi_antlat', 'ecg-depression']]) {
      const png = await win.webContents.executeJavaScript(`(async () => {
        const select = document.querySelector('select');
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, ${JSON.stringify(id)});
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 150));
        const buttons = [...document.querySelectorAll('button')];
        const caliper = buttons.find(b => b.textContent.trim() === 'Калипер');
        if (!document.body.innerText.includes('Tк — конец T')) caliper.click();
        buttons.find(b => b.textContent.trim() === '50 мм/с').click();
        await new Promise(resolve => setTimeout(resolve, 150));
        if (!document.body.innerText.includes('Интервалы модели:')) throw new Error('Нет подписи интервалов модели');
        const canvas = [...document.querySelectorAll('canvas')].at(-1);
        return canvas.toDataURL('image/png');
      })()`);
      fs.writeFileSync(path.join(outputDir, filename + '.png'), Buffer.from(png.split(',')[1], 'base64'));
    }
    await win.webContents.executeJavaScript(`(async () => {
      const wait = () => new Promise(r => setTimeout(r, 150));
      const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      button('Тренировка').click(); await wait();
      button('Начать случай').click(); await wait();
      check(button('Далее').disabled, 'Можно пропустить вопрос');
      check(button('Зафиксировать ответ').disabled, 'Можно отправить пустой ответ');
      check(!document.body.innerText.includes('Клинический разбор и тактика'), 'Открыт разбор атласа');
      check(!document.body.innerText.includes('Нижний ИМпST с вовлечением'), 'Рано раскрыт диагноз');
      check(!button('+ V3R/V4R, V7–V9'), 'Доступны преждевременные дополнительные отведения');
      check(!document.querySelector('input[type="range"]'), 'Можно изменить ЧСС пациента');
      button('Калипер').click(); await wait();
      document.querySelector('input[value="normal"]').click(); await wait();
      button('Зафиксировать ответ').click(); await wait();
      check(document.body.innerText.includes('Ответ требует пересмотра'), 'Ошибка ответа не разобрана');
      check(document.querySelector('fieldset').disabled, 'Можно заменить принятый ответ');
    })()`);
    await win.webContents.executeJavaScript('window.scrollTo(0, 0)');
    fs.writeFileSync(path.join(outputDir, 'training.png'), (await win.webContents.capturePage()).toPNG());
    await win.loadURL('http://localhost:5173/');
    await win.webContents.executeJavaScript(`(async () => {
      const wait = () => new Promise(r => setTimeout(r, 180));
      const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      await wait(); button('Тренировка').click(); await wait();
      check(document.body.innerText.includes('Ответ требует пересмотра'), 'Ответ не пережил перезагрузку');
      check(document.querySelector('input[value="normal"]').checked, 'Не восстановлен выбранный ответ');
      button('Далее').click(); await wait();
      document.querySelector('input[value="right"]').click(); await wait();
      button('Зафиксировать ответ').click(); await wait();
      button('Далее').click(); await wait();
      document.querySelector('input[value="primary-pci"]').click(); await wait();
      button('Зафиксировать ответ').click(); await wait();
      button('Далее').click(); await wait();
      check(document.body.innerText.includes('тромботическая окклюзия'), 'Не показан результат КАГ');
      button('Далее').click(); await wait();
      button('Завершить и открыть разбор').click(); await wait();
      check(document.body.innerText.includes('Верно 2 из 3'), 'Неверный итог');
      check(document.body.innerText.includes('Нижний ИМпST с вовлечением'), 'Нет итогового диагноза');
      window.scrollTo(0, 0); await wait();
    })()`);
    fs.writeFileSync(path.join(outputDir, 'training-result.png'), (await win.webContents.capturePage()).toPNG());
    await win.loadURL('http://localhost:5173/');
    await win.webContents.executeJavaScript(`(async () => {
      const wait = () => new Promise(r => setTimeout(r, 180));
      const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      await wait(); button('Тренировка').click(); await wait();
      check(document.body.innerText.includes('Верно 2 из 3'), 'Не восстановлен завершённый результат');
      button('Изучить анатомию в атласе').click(); await wait();
      check(document.querySelector('select').value === 'rca_prox', 'Открыт неверный атлас');
      button('Тренировка').click(); await wait();
      button('Пройти ещё раз').click(); await wait();
      check(document.body.innerText.includes('Этап 1 из 5'), 'Новая попытка не началась с первого этапа');
      const store = JSON.parse(localStorage.getItem('cardioatlas.training.v1'));
      check(store.attempts.length === 2 && store.attempts[0].completedAt && !store.attempts[1].completedAt, 'История попыток повреждена');
    })()`);
    results.training = 'Ошибка и верные ответы, блокировка пропуска, восстановление ответа и результата, новая попытка и переход в атлас проверены';
    win.setSize(390, 844);
    await win.webContents.executeJavaScript(`(async () => {
      const wait = () => new Promise(r => setTimeout(r, 250));
      const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
      await wait();
      button('К данным этапа').click(); await wait();
      button('V4–V6').click(); await wait();
      const viewport = document.querySelector('[data-ecg-viewport]');
      if (viewport.scrollLeft <= 0) throw new Error('Нет перехода к грудным отведениям');
      button('I–III').click(); await wait();
      button('Калипер').click(); await wait();
      viewport.scrollIntoView({block:'start'}); await wait();
      if (document.documentElement.scrollWidth > innerWidth + 1) throw new Error('Страница шире телефона');
    })()`);
    win.webContents.debugger.attach('1.3');
    const coordinates = await win.webContents.executeJavaScript(`(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      return { x: r.left + 80, y: r.top + 140 };
    })()`);
    await win.webContents.debugger.sendCommand('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:coordinates.x,y:coordinates.y,id:0}]});
    await win.webContents.debugger.sendCommand('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:coordinates.x+105,y:coordinates.y-42,id:0}]});
    await win.webContents.debugger.sendCommand('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
    await win.webContents.executeJavaScript('new Promise(r => setTimeout(r, 200))');
    const pinch = async (start, end) => {
      const points = ([x1, x2]) => [{x:coordinates.x+x1,y:coordinates.y,id:0},{x:coordinates.x+x2,y:coordinates.y,id:1}];
      await win.webContents.debugger.sendCommand('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:points(start)});
      await win.webContents.debugger.sendCommand('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:points(end)});
      await win.webContents.debugger.sendCommand('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
      await win.webContents.executeJavaScript('new Promise(r => setTimeout(r, 250))');
    };
    await pinch([0, 80], [-30, 110]);
    await win.webContents.executeJavaScript(`(() => {
      const readout = document.querySelector('[data-caliper-readout]').innerText;
      if (!readout.includes('1000 мс') || !readout.includes('1.00 мВ')) throw new Error('Жест изменил измерение: ' + readout);
      if (document.querySelector('canvas').getBoundingClientRect().width < 1700) throw new Error('Жест не увеличил ленту');
    })()`);
    await pinch([0, 100], [30, 70]);
    await win.webContents.executeJavaScript(`(() => {
      if (document.querySelector('canvas').getBoundingClientRect().width > 850) throw new Error('Жест не уменьшил ленту');
      document.querySelector('button[title="Увеличить"]').previousElementSibling.click();
    })()`);
    await win.webContents.executeJavaScript(`(async () => {
      const wait = () => new Promise(r => setTimeout(r, 200)); await wait();
      const readout = () => document.querySelector('[data-caliper-readout]').innerText;
      if (!readout().includes('1000 мс') || !readout().includes('1.00 мВ')) throw new Error('Касание: неверные единицы ' + readout());
      document.querySelector('button[title="Увеличить"]').click(); await wait();
      if (!readout().includes('1000 мс') || !readout().includes('1.00 мВ')) throw new Error('Масштаб изменил измерение');
      const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
      button('50 мм/с').click(); await wait();
      if (readout().includes('Δt')) throw new Error('Старая рамка осталась после смены скорости');
      button('Калипер').click(); await wait();
      if (!getComputedStyle(document.querySelector('canvas')).touchAction.includes('pan-x')) throw new Error('Прокрутка касанием заблокирована');
    })()`);
    await pinch([0, 80], [-20, 100]);
    await win.webContents.executeJavaScript(`(async () => {
      const wait = () => new Promise(r => setTimeout(r, 200));
      const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
      if (document.querySelector('canvas').getBoundingClientRect().width < 1600) throw new Error('Масштаб без калипера не изменился');
      button('К ответу').click(); await wait();
      const radio = document.querySelector('input[value="inferior-ste"]'); radio.click(); await wait();
      button('Зафиксировать ответ').click(); await wait();
      if (!document.body.innerText.includes('Ответ верный')) throw new Error('Не принят мобильный ответ');
      if (document.documentElement.scrollWidth > innerWidth+1) throw new Error('Ответ шире экрана');
      document.querySelector('nav[aria-label="Разделы учебного этапа"]').scrollIntoView({block:'start'}); await wait();
    })()`);
    fs.writeFileSync(path.join(outputDir, 'mobile-answer.png'), (await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript(`(async () => {
      const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
      button('ЭКГ').click();
      await new Promise(r=>setTimeout(r,250));
      if(document.documentElement.scrollWidth>innerWidth+1) throw new Error('ЭКГ расширяет страницу');
    })()`);
    fs.writeFileSync(path.join(outputDir, 'mobile-ecg.png'), (await win.webContents.capturePage()).toPNG());
    win.webContents.debugger.detach();
    results.mobile = '390 px: вкладки, прокрутка, группы отведений, касание калипера (1000 мс / 1 мВ), сохранение измерения при зуме и ответ проверены';
    fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify({ ...results, errors }, null, 2));
    console.log(JSON.stringify({ outputDir, ...results, errors }));
    clearTimeout(timeout);
    app.exit(errors.length ? 1 : 0);
  } catch (error) {
    clearTimeout(timeout);
    errors.push(String(error));
    fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify({ errors }, null, 2));
    console.error(JSON.stringify({ outputDir, errors }));
    app.exit(1);
  }
});
