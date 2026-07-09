import pc from 'picocolors';

export function printHelp(): void {
  console.log(`
  ${pc.bold('wakaba content')} — управление учебным контентом

  ${pc.cyan('ИСПОЛЬЗОВАНИЕ')}
    npm run content -- <команда> [опции]

  ${pc.cyan('КОМАНДЫ')}
    check            Проверить контент (целостность, дубли, уникальность id). Без записи.
    status           Обзор: счётчики, сироты, аудио-пробелы. Без записи.
    audio            Список аудио к записи (файл + что произнести). Без записи.
                        --voice m|f      Только один голос.
                        --lesson <id>    Ограничить охватом урока (напр. language-barrier).
                        --track <id>     Ограничить охватом трека (напр. communication).
                        -i, --interactive  Пошагово: пишешь файл → Enter → перепроверка.
    bundle           Собрать LessonBundle из content/ (для preview / вычитки). Без БД.
                        --lesson <id>  один урок (по умолчанию — все)
                        --out <dir>    куда писать (по умолчанию ./bundles)
    where <id>       Что это за id и кто на него ссылается. Без записи.


  ${pc.cyan('ОБЩИЕ')}
    --help, -h       Показать эту справку.
  `);
}
