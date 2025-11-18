# Instalační příručka - Asana Task Manager

## Krok 1: Nastavení Supabase

### 1.1 Vytvoření projektu
1. Přejděte na [supabase.com](https://supabase.com)
2. Vytvořte nový projekt
3. Poznamenejte si údaje o projektu

### 1.2 Získání API klíčů
1. V Supabase dashboardu přejděte do **Project Settings**
2. V sekci **API** najdete:
   - **Project URL** (např. `https://xxxxx.supabase.co`)
   - **anon public** klíč
   - **service_role** klíč (tajný, nikdy nesdílejte!)

### 1.3 Databáze je připravena
Databázové schéma bylo automaticky vytvořeno během nastavení. Obsahuje všechny potřebné tabulky pro task management.

## Krok 2: Instalace pluginu do WordPress

### 2.1 Nahrání souborů
1. Stáhněte celou složku `asana-task-manager`
2. Nahrajte ji do `/wp-content/plugins/` na vašem WordPress serveru
3. Struktura by měla být: `/wp-content/plugins/asana-task-manager/asana-task-manager.php`

### 2.2 Build frontend aplikace (nutné!)
Před aktivací pluginu musíte sestavit React aplikaci:

```bash
cd wp-content/plugins/asana-task-manager
npm install
npm run build
```

Tento příkaz vytvoří složku `assets/dist/` s zkompilovanými soubory.

### 2.3 Aktivace pluginu
1. V WordPress administraci přejděte na **Pluginy**
2. Najděte "Asana Task Manager"
3. Klikněte na **Aktivovat**

## Krok 3: Konfigurace pluginu

### 3.1 Základní nastavení
1. V administraci přejděte na **Task Manager > Nastavení**
2. Vyplňte údaje z Supabase:
   - **Supabase URL**: Vaše Project URL
   - **Supabase Anon Key**: Veřejný anon klíč
   - **Supabase Service Role Key**: Tajný service role klíč

### 3.2 Email notifikace (volitelné)
1. Zaškrtněte **Povolit email notifikace**
2. Vyplňte:
   - **Odesílatel (jméno)**: např. "Task Manager"
   - **Odesílatel (email)**: např. "noreply@vasedomena.cz"
3. Klikněte na **Uložit nastavení**

## Krok 4: Použití

### 4.1 Vložení na stránku
1. Vytvořte novou stránku nebo upravte existující
2. Vložte shortcode:
   ```
   [asana_task_manager]
   ```
3. Publikujte stránku

### 4.2 První použití
1. Přihlaste se na webu
2. Přejděte na stránku s task managerem
3. Systém automaticky vytvoří váš uživatelský profil v Supabase
4. Začněte vytvářet úkoly!

## Řešení problémů

### Plugin se nezobrazuje
- Zkontrolujte, že jste provedli `npm run build`
- Ověřte, že složka `assets/dist/` obsahuje soubory `main.js` a `main.css`

### Chyba při načítání
- Zkontrolujte Supabase údaje v nastavení
- Ověřte, že jsou klíče správně zkopírované (bez mezer)

### Email notifikace nefungují
- Zkontrolujte, že je zaškrtnuto "Povolit email notifikace"
- Ověřte nastavení WordPress `wp_mail()` funkce
- Některé hostingy vyžadují SMTP plugin

### Žádné úkoly se nezobrazují
- Zkontrolujte, že jste přihlášeni
- První spuštění může trvat několik sekund
- Zkontrolujte konzoli prohlížeče (F12) pro chyby

## Bezpečnostní doporučení

1. **NIKDY nesdílejte Service Role Key**
2. Používejte HTTPS pro produkční prostředí
3. Pravidelně aktualizujte WordPress a plugin
4. Omezte přístup k admin panelu pomocí firewallu

## Aktualizace pluginu

Při aktualizaci pluginu:

1. Zálohujte databázi a soubory
2. Nahrajte nové soubory
3. Spusťte `npm install && npm run build`
4. Zkontrolujte funkčnost

## Podpora

Pro technickou podporu kontaktujte autora pluginu nebo vytvořte issue na GitHubu.
