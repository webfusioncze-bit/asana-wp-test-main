# Asana Task Manager - WordPress Plugin

Kompletní task management systém pro WordPress s designem inspirovaným Asanou. Plugin poskytuje plnohodnotný systém pro správu úkolů, subtasků, komentářů, složek a email notifikací.

## Hlavní funkce

- **Moderní Asana-like design** - Čistý, minimalistický design
- **Složky a kategorie** - Organizujte úkoly do stromové struktury složek
- **Subtasky** - Neomezený počet subtasků pro každý úkol
- **Komentáře** - Diskutujte o úkolech přímo v systému
- **Priority a termíny** - Nastavte priority a due dates
- **Přidělování úkolů** - Přidělujte úkoly konkrétním uživatelům
- **Email notifikace** - Automatické notifikace o změnách
- **Oprávnění** - Řízení přístupu ke složkám a úkolům
- **Responsivní design** - Funguje na všech zařízeních

## Instalace

1. Nahrajte složku `asana-task-manager` do `/wp-content/plugins/`
2. Aktivujte plugin v administraci WordPress
3. Přejděte do **Task Manager > Nastavení**
4. Vyplňte Supabase údaje (URL, Anon Key, Service Role Key)
5. Nakonfigurujte email notifikace (volitelné)
6. Uložte nastavení

## Použití

### Zobrazení na stránce

Vložte shortcode na stránku nebo do příspěvku:

```
[asana_task_manager]
```

### Přístup k systému

- Pouze přihlášení uživatelé mohou používat task manager
- Každý uživatel vidí úkoly, které vytvořil nebo jsou mu přiděleny
- Vlastník složky může nastavit oprávnění pro ostatní uživatele

### Vytvoření úkolu

1. Klikněte na "Přidat úkol"
2. Zadejte název úkolu
3. Vyplňte detaily v bočním panelu (popis, termín, priorita, kategorie, složka)
4. Přidejte subtasky nebo komentáře podle potřeby

### Organizace složek

1. V levém panelu klikněte na ikonu "+"
2. Zadejte název složky
3. Vytvořte stromovou strukturu složek pomocí drag & drop

### Email notifikace

Systém automaticky odesílá notifikace při:
- Přidělení nového úkolu
- Změně stavu úkolu
- Přidání komentáře
- Blížícím se termínu
- Po termínu

## Technické požadavky

- WordPress 5.0+
- PHP 7.4+
- Aktivní Supabase databáze

## Supabase nastavení

Plugin používá Supabase jako databázi. Databázové schéma je automaticky vytvořeno při první instalaci.

### Potřebné údaje

1. **Supabase URL** - Najdete v Project Settings > API
2. **Anon Key** - Najdete v Project Settings > API
3. **Service Role Key** - Najdete v Project Settings > API (použijte opatrně!)

## Vývojářská dokumentace

### Struktura pluginu

```
asana-task-manager/
├── asana-task-manager.php      # Hlavní soubor pluginu
├── includes/                    # PHP třídy
│   ├── class-atm-supabase.php  # Supabase API wrapper
│   ├── class-atm-api.php       # REST API endpoints
│   ├── class-atm-shortcodes.php# Shortcode handler
│   ├── class-atm-admin.php     # Admin panel
│   ├── class-atm-notifications.php # Email notifikace
│   └── class-atm-ajax.php      # AJAX handlery
├── assets/
│   ├── src/                    # React source kód
│   │   ├── main.tsx           # Entry point
│   │   ├── App.tsx            # Hlavní komponenta
│   │   ├── types.ts           # TypeScript typy
│   │   ├── components/        # React komponenty
│   │   └── styles/            # CSS styly
│   ├── dist/                  # Build output
│   └── admin/                 # Admin assets
├── package.json               # NPM dependencies
├── vite.config.ts            # Vite konfigurace
└── tsconfig.json             # TypeScript konfigurace
```

### Build procesu

```bash
cd asana-task-manager
npm install
npm run build
```

### Databázové schéma

Plugin vytváří následující tabulky v Supabase:
- `users_meta` - Metadata WordPress uživatelů
- `folders` - Stromová struktura složek
- `folder_permissions` - Oprávnění ke složkám
- `categories` - Kategorie úkolů
- `tasks` - Úkoly a subtasky
- `task_comments` - Komentáře k úkolům
- `notifications` - Notifikace

## Podpora

Pro podporu a dotazy kontaktujte autora pluginu.

## Licence

GPL v2 or later

## Autor

Your Name

## Changelog

### 1.0.0
- První veřejné vydání
- Plná funkcionalita task managementu
- Asana-like design
- Email notifikace
- Supabase integrace
