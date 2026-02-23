// ── i18n – Minimal PL/EN translation module ──────────────────────────────────

const pl: Record<string, string> = {
    // Screen titles
    'screen.home': 'Strona główna',
    'screen.plan': 'Plan zajęć',
    'screen.grades': 'Oceny',
    'screen.info': 'Dane studenta',
    'screen.news': 'Aktualności',
    'screen.newsDetail': 'Aktualność',
    'screen.links': 'Przydatne strony',
    'screen.settings': 'Ustawienia',
    'screen.about': 'O aplikacji',

    // Drawer items
    'drawer.home': 'Strona główna',
    'drawer.plan': 'Plan zajęć',
    'drawer.grades': 'Oceny',
    'drawer.info': 'Dane studenta',
    'drawer.news': 'Aktualności',
    'drawer.links': 'Przydatne strony',
    'drawer.settings': 'Ustawienia',
    'drawer.about': 'O aplikacji',
    'drawer.logout': 'Wyloguj się',

    // Plan
    'plan.day': 'Dzień',
    'plan.week': 'Tydzień',
    'plan.month': 'Miesiąc',
    'plan.today': 'Dziś',
    'plan.prev': 'Poprzedni',
    'plan.next': 'Następny',
    'plan.loading': 'Pobieranie planu…',
    'plan.emptyDay': 'Brak zajęć',
    'plan.emptyDayLong': 'Brak zajęć w wybranym dniu',
    'plan.emptyWeek': 'Brak danych tygodnia',
    'plan.filter': 'Filtr',
    'plan.viewDay': 'Widok dnia',
    'plan.viewWeek': 'Widok tygodnia',
    'plan.viewMonth': 'Widok miesiąca',
    'plan.hour': 'Godz.',
    'plan.search': 'Szukaj w planie',
    'plan.refresh': 'Odśwież',
    'plan.legend': 'Legenda',
    'plan.eventTypes': 'Typy zajęć',
    'plan.periodMarkers': 'Markery okresów',

    // Plan search sheet
    'search.title': 'Szukaj w planie',
    'search.category': 'Kategoria',
    'search.catAlbum': 'Numer albumu',
    'search.catTeacher': 'Nauczyciel',
    'search.catRoom': 'Sala',
    'search.catSubject': 'Przedmiot',
    'search.queryPlaceholder': 'Szukaj...',
    'search.queryLabel': 'Fraza',
    'search.search': 'Szukaj',
    'search.clear': 'Wyczyść',
    'search.noResults': 'Brak wyników wyszukiwania',

    // Grades
    'grades.refreshLabel': 'Odśwież',
    'grades.groupToggle': 'Grupowanie przedmiotów',
    'grades.noData': 'Brak ocen',
    'grades.semester': 'Semestr',
    'grades.ects': 'ECTS',
    'grades.enableGrouping': 'Włącz grupowanie',
    'grades.disableGrouping': 'Wyłącz grupowanie',

    // Settings
    'settings.refresh': 'Odświeżanie',
    'settings.refreshSub': 'Interwał synchronizacji',
    'settings.compactPlan': 'Kompaktowy plan',
    'settings.compactPlanSub': 'Mniejsza wysokość godzin',
    'settings.gradeGroup': 'Grupowanie ocen',
    'settings.gradeGroupSub': 'Widok ocen pogrupowany po przedmiocie',
    'settings.language': 'Język',
    'settings.languageSub': 'Język interfejsu',

    // General
    'general.loading': 'Ładowanie danych…',
    'general.ok': 'OK',
    'general.cancel': 'Anuluj',
    'general.back': 'Wróć',
    'general.openMenu': 'Otwórz menu',
    'general.closeMenu': 'Zamknij menu',
    'general.sessionExpired': 'Sesja wygasła, zaloguj się ponownie',
    'general.pressAgainToExit': 'Naciśnij ponownie, aby wyjść',
    'general.logoutConfirm': 'Czy na pewno chcesz się wylogować?',

    // Home
    'home.hello': 'Cześć,',
    'home.tiles': 'Skróty',
    'home.quickActions': 'Szybkie akcje',

    // Login
    'login.title': 'Zaloguj się',
    'login.username': 'Nazwa użytkownika',
    'login.password': 'Hasło',
    'login.submit': 'Zaloguj',
    'login.info': 'Zaloguj się swoimi danymi z ePortalu ZUT',

    // Periods
    'period.session': 'Sesja',
    'period.examSession': 'Sesja egzaminacyjna',
    'period.retakeSession': 'Sesja poprawkowa',
    'period.break': 'Przerwa',
    'period.summerBreak': 'Przerwa letnia',
    'period.winterBreak': 'Przerwa zimowa',
    'period.holiday': 'Święto',
    'period.independenceDay': 'Święto Niepodległości',
    'period.christmas': 'Święta Bożego Narodzenia',
    'period.easter': 'Wielkanoc',
    'period.allSaints': 'Wszystkich Świętych',
    'period.corpusChristi': 'Boże Ciało',
    'period.freeDay': 'Dzień wolny',

    // Weekday short names
    'weekday.mon': 'Pon',
    'weekday.tue': 'Wt',
    'weekday.wed': 'Śr',
    'weekday.thu': 'Czw',
    'weekday.fri': 'Pt',
    'weekday.sat': 'Sob',
    'weekday.sun': 'Nd',

    // Install tip
    'install.tip': 'Wiesz, że możesz zainstalować tę stronę jako skrót i korzystać jak ze zwykłej aplikacji systemowej?',
    'install.now': 'Zainstaluj teraz',
    'install.howIos': 'Jak zainstalować?',
    'install.dismiss': 'Odrzuć',
    'install.iosTitle': 'Instalacja na iOS',
    'install.iosStep1': 'Naciśnij ikonę <strong>Udostępnij</strong> (kwadrat ze strzałką) w dolnym pasku Safari',
    'install.iosStep2': 'Wybierz <strong>„Dodaj do ekranu początkowego"</strong>',
    'install.iosStep3': 'Naciśnij <strong>„Dodaj"</strong> w prawym górnym rogu',
    'install.iosOk': 'Rozumiem',

    // Event sheet
    'event.details': 'Szczegóły zajęć',
    'event.time': 'Czas',
    'event.room': 'Sala',
    'event.teacher': 'Prowadzący',
    'event.group': 'Grupa',
    'event.type': 'Typ',

    // Login (extra)
    'login.loggingIn': 'Logowanie…',
    'login.loginBtn': 'Zaloguj się',
    'login.infoText': 'Zaloguj się swoimi danymi z systemu ZUT. Aplikacja nie przechowuje haseł - logowanie odbywa się bezpośrednio na serwerach uczelni.',

    // Home tiles
    'home.offlineMode': 'Tryb offline',
    'home.quickAccess': 'Szybki dostęp',
    'home.tilePlan': 'Plan zajęć',
    'home.tilePlanDesc': 'Dzień / Tydzień / Miesiąc',
    'home.tileGrades': 'Oceny',
    'home.tileGradesDesc': 'Średnia i punkty ECTS',
    'home.tileInfo': 'Dane studenta',
    'home.tileInfoDesc': 'Kierunek i przebieg',
    'home.tileNews': 'Aktualności',
    'home.tileNewsDesc': 'Komunikaty uczelni',
    'home.tileLinks': 'Linki',
    'home.tileLinksDesc': 'Przydatne strony ZUT',
    'home.tileSettings': 'Ustawienia',
    'home.tileSettingsDesc': 'Konfiguracja aplikacji',

    // Grades (extra)
    'grades.avg': 'Średnia',
    'grades.ectsSem': 'ECTS semestr',
    'grades.ectsTotal': 'ECTS łącznie',
    'grades.studyField': 'Kierunek',
    'grades.semLabel': 'Semestr',
    'grades.semOption': 'Sem.',
    'grades.loading': 'Pobieranie ocen…',
    'grades.noGrades': 'Brak ocen dla wybranego semestru',
    'grades.finalGrade': 'Ocena końcowa',
    'grades.component': 'Składowa',
    'grades.subject': 'Przedmiot',

    // Info
    'info.studentPhoto': 'Zdjęcie studenta',
    'info.userId': 'ID użytkownika',
    'info.studyField': 'Kierunek',
    'info.loading': 'Ładowanie danych…',
    'info.album': 'Album',
    'info.faculty': 'Wydział',
    'info.field': 'Kierunek',
    'info.form': 'Forma',
    'info.level': 'Poziom',
    'info.speciality': 'Specjalność',
    'info.specialization': 'Specjalizacja',
    'info.status': 'Status',
    'info.academicYear': 'Rok akadem.',
    'info.semester': 'Semestr',
    'info.studyHistory': 'Przebieg studiów',
    'info.noData': 'Brak danych studenta',

    // News
    'news.loading': 'Pobieranie aktualności…',
    'news.empty': 'Brak aktualności',
    'news.noContent': 'Brak treści',
    'news.openInBrowser': 'Otwórz w przeglądarce ↗',

    // Links
    'links.faculty': 'Twój wydział',
    'links.university': 'Zasoby uczelni',

    // About
    'about.pwaNote': 'Wersja progresywnej aplikacji webowej',
    'about.installApp': 'Zainstaluj aplikację',
    'about.installIos': 'Dodaj do ekranu głównego przez menu Udostępnij',
    'about.installAndroid': 'Dodaj mZUT v2 do ekranu głównego',
    'about.rateApp': 'Oceń aplikację',
    'about.rateDesc': 'Twoja opinia pomaga nam rozwijać mZUT!',
    'about.sourceCode': 'Kod źródłowy',
    'about.sourceDesc': 'Sprawdź projekt na GitHubie',

    // Period display names
    'periodName.sesja_zimowa': 'Sesja zimowa',
    'periodName.sesja_letnia': 'Sesja letnia',
    'periodName.sesja_poprawkowa': 'Sesja poprawkowa',
    'periodName.przerwa_dydaktyczna_zimowa': 'Przerwa dydaktyczna',
    'periodName.przerwa_dydaktyczna_letnia': 'Przerwa dydaktyczna',
    'periodName.przerwa_dydaktyczna': 'Przerwa dydaktyczna',
    'periodName.wakacje_zimowe': 'Wakacje zimowe',
    'periodName.wakacje_letnie': 'Wakacje letnie',
    'period.end': 'Koniec',
    'period.start': 'Początek',

    // Global banners
    'banner.loading': 'Ładowanie danych…',
};

const en: Record<string, string> = {
    // Screen titles
    'screen.home': 'Home',
    'screen.plan': 'Schedule',
    'screen.grades': 'Grades',
    'screen.info': 'Student Info',
    'screen.news': 'News',
    'screen.newsDetail': 'Article',
    'screen.links': 'Useful Links',
    'screen.settings': 'Settings',
    'screen.about': 'About',

    // Drawer items
    'drawer.home': 'Home',
    'drawer.plan': 'Schedule',
    'drawer.grades': 'Grades',
    'drawer.info': 'Student Info',
    'drawer.news': 'News',
    'drawer.links': 'Useful Links',
    'drawer.settings': 'Settings',
    'drawer.about': 'About',
    'drawer.logout': 'Log out',

    // Plan
    'plan.day': 'Day',
    'plan.week': 'Week',
    'plan.month': 'Month',
    'plan.today': 'Today',
    'plan.prev': 'Previous',
    'plan.next': 'Next',
    'plan.loading': 'Loading schedule…',
    'plan.emptyDay': 'No classes',
    'plan.emptyDayLong': 'No classes on this day',
    'plan.emptyWeek': 'No week data',
    'plan.filter': 'Filter',
    'plan.viewDay': 'Day view',
    'plan.viewWeek': 'Week view',
    'plan.viewMonth': 'Month view',
    'plan.hour': 'Hour',
    'plan.search': 'Search schedule',
    'plan.refresh': 'Refresh',
    'plan.legend': 'Legend',
    'plan.eventTypes': 'Class types',
    'plan.periodMarkers': 'Period markers',

    // Plan search sheet
    'search.title': 'Search schedule',
    'search.category': 'Category',
    'search.catAlbum': 'Student ID',
    'search.catTeacher': 'Teacher',
    'search.catRoom': 'Room',
    'search.catSubject': 'Subject',
    'search.queryPlaceholder': 'Search...',
    'search.queryLabel': 'Query',
    'search.search': 'Search',
    'search.clear': 'Clear',
    'search.noResults': 'No search results',

    // Grades
    'grades.refreshLabel': 'Refresh',
    'grades.groupToggle': 'Subject grouping',
    'grades.noData': 'No grades',
    'grades.semester': 'Semester',
    'grades.ects': 'ECTS',
    'grades.enableGrouping': 'Enable grouping',
    'grades.disableGrouping': 'Disable grouping',

    // Settings
    'settings.refresh': 'Refresh',
    'settings.refreshSub': 'Sync interval',
    'settings.compactPlan': 'Compact schedule',
    'settings.compactPlanSub': 'Reduced hour height',
    'settings.gradeGroup': 'Grade grouping',
    'settings.gradeGroupSub': 'Group grades by subject',
    'settings.language': 'Language',
    'settings.languageSub': 'Interface language',

    // General
    'general.loading': 'Loading data…',
    'general.ok': 'OK',
    'general.cancel': 'Cancel',
    'general.back': 'Back',
    'general.openMenu': 'Open menu',
    'general.closeMenu': 'Close menu',
    'general.sessionExpired': 'Session expired, please log in again',
    'general.pressAgainToExit': 'Press again to exit',
    'general.logoutConfirm': 'Are you sure you want to log out?',

    // Home
    'home.hello': 'Hello,',
    'home.tiles': 'Shortcuts',
    'home.quickActions': 'Quick actions',

    // Login
    'login.title': 'Log in',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.submit': 'Log in',
    'login.info': 'Log in with your ePortal ZUT credentials',

    // Periods
    'period.session': 'Exam session',
    'period.examSession': 'Exam session',
    'period.retakeSession': 'Retake session',
    'period.break': 'Break',
    'period.summerBreak': 'Summer break',
    'period.winterBreak': 'Winter break',
    'period.holiday': 'Holiday',
    'period.independenceDay': 'Independence Day',
    'period.christmas': 'Christmas',
    'period.easter': 'Easter',
    'period.allSaints': 'All Saints\' Day',
    'period.corpusChristi': 'Corpus Christi',
    'period.freeDay': 'Day off',

    // Weekday short names
    'weekday.mon': 'Mon',
    'weekday.tue': 'Tue',
    'weekday.wed': 'Wed',
    'weekday.thu': 'Thu',
    'weekday.fri': 'Fri',
    'weekday.sat': 'Sat',
    'weekday.sun': 'Sun',

    // Install tip
    'install.tip': 'Did you know you can install this page as a shortcut and use it like a regular app?',
    'install.now': 'Install now',
    'install.howIos': 'How to install?',
    'install.dismiss': 'Dismiss',
    'install.iosTitle': 'Install on iOS',
    'install.iosStep1': 'Tap the <strong>Share</strong> icon (square with arrow) in Safari\'s toolbar',
    'install.iosStep2': 'Choose <strong>"Add to Home Screen"</strong>',
    'install.iosStep3': 'Tap <strong>"Add"</strong> in the top right corner',
    'install.iosOk': 'Got it',

    // Event sheet
    'event.details': 'Class details',
    'event.time': 'Time',
    'event.room': 'Room',
    'event.teacher': 'Teacher',
    'event.group': 'Group',
    'event.type': 'Type',

    // Login (extra)
    'login.loggingIn': 'Logging in…',
    'login.loginBtn': 'Log in',
    'login.infoText': 'Log in with your ZUT system credentials. The app does not store passwords – authentication is done directly on university servers.',

    // Home tiles
    'home.offlineMode': 'Offline mode',
    'home.quickAccess': 'Quick access',
    'home.tilePlan': 'Schedule',
    'home.tilePlanDesc': 'Day / Week / Month',
    'home.tileGrades': 'Grades',
    'home.tileGradesDesc': 'Average and ECTS credits',
    'home.tileInfo': 'Student info',
    'home.tileInfoDesc': 'Field of study and history',
    'home.tileNews': 'News',
    'home.tileNewsDesc': 'University announcements',
    'home.tileLinks': 'Links',
    'home.tileLinksDesc': 'Useful ZUT websites',
    'home.tileSettings': 'Settings',
    'home.tileSettingsDesc': 'App configuration',

    // Grades (extra)
    'grades.avg': 'Average',
    'grades.ectsSem': 'ECTS sem.',
    'grades.ectsTotal': 'Total ECTS',
    'grades.studyField': 'Field of study',
    'grades.semLabel': 'Semester',
    'grades.semOption': 'Sem.',
    'grades.loading': 'Loading grades…',
    'grades.noGrades': 'No grades for selected semester',
    'grades.finalGrade': 'Final grade',
    'grades.component': 'Component',
    'grades.subject': 'Subject',

    // Info
    'info.studentPhoto': 'Student photo',
    'info.userId': 'User ID',
    'info.studyField': 'Field of study',
    'info.loading': 'Loading data…',
    'info.album': 'Album',
    'info.faculty': 'Faculty',
    'info.field': 'Field of study',
    'info.form': 'Form',
    'info.level': 'Level',
    'info.speciality': 'Speciality',
    'info.specialization': 'Specialization',
    'info.status': 'Status',
    'info.academicYear': 'Academic year',
    'info.semester': 'Semester',
    'info.studyHistory': 'Study history',
    'info.noData': 'No student data available',

    // News
    'news.loading': 'Loading news…',
    'news.empty': 'No news available',
    'news.noContent': 'No content',
    'news.openInBrowser': 'Open in browser ↗',

    // Links
    'links.faculty': 'Your faculty',
    'links.university': 'University resources',

    // About
    'about.pwaNote': 'Progressive web app version',
    'about.installApp': 'Install app',
    'about.installIos': 'Add to home screen via Share menu',
    'about.installAndroid': 'Add mZUT v2 to home screen',
    'about.rateApp': 'Rate the app',
    'about.rateDesc': 'Your feedback helps us improve mZUT!',
    'about.sourceCode': 'Source code',
    'about.sourceDesc': 'Check the project on GitHub',

    // Period display names
    'periodName.sesja_zimowa': 'Winter exam session',
    'periodName.sesja_letnia': 'Summer exam session',
    'periodName.sesja_poprawkowa': 'Retake session',
    'periodName.przerwa_dydaktyczna_zimowa': 'Winter break',
    'periodName.przerwa_dydaktyczna_letnia': 'Summer break',
    'periodName.przerwa_dydaktyczna': 'Teaching break',
    'periodName.wakacje_zimowe': 'Winter holidays',
    'periodName.wakacje_letnie': 'Summer holidays',
    'period.end': 'End',
    'period.start': 'Start',

    // Global banners
    'banner.loading': 'Loading data…',
};

const dictionaries = { pl, en } as const;

export type Language = 'pl' | 'en';

export type TFunction = (key: string) => string;

export function createT(lang: Language): TFunction {
    const dict = dictionaries[lang] ?? dictionaries.pl;
    return (key: string) => dict[key] ?? dictionaries.pl[key] ?? key;
}
