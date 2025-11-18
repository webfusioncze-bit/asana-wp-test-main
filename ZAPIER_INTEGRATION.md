# Zapier Integrace - Dokumentace

## Přehled

Systém umožňuje automatický import poptávek z Zapier webhooků. Podporuje neomezený počet různých formulářů a zdrojů, každý s vlastním mapováním polí.

## Jak to funguje

### 1. Architektura

- **Edge Function**: `zapier-webhook` - Univerzální endpoint pro příjem dat ze všech Zapů
- **Databázové tabulky**:
  - `zapier_sources` - Evidence jednotlivých webhook integrací
  - `zapier_webhooks_log` - Log všech příchozích požadavků
- **Admin rozhraní**: Správa webhook integrací a mapování polí

### 2. Proces integrace nového Zapu

#### Krok 1: Vytvoření Zapu v Zapier

1. V Zapieru vytvořte nový Zap
2. Jako trigger použijte váš formulář (např. WP Forms, Contact Form 7, apod.)
3. Jako akci zvolte **"Webhooks by Zapier"** → **"POST"**

#### Krok 2: Konfigurace webhooku v Zapieru

1. **URL webhooku**:
   ```
   https://[SUPABASE_URL]/functions/v1/zapier-webhook?token=UNIQUE_TOKEN
   ```

2. **Token**: Použijte jedinečný identifikátor pro tento formulář, například:
   - `kontaktni-formular-homepage`
   - `poptavka-eshop`
   - `kalkulacka-cen`

3. **Payload Type**: `JSON`

4. **Data**: Namapujte pole z formuláře do JSON objektu, například:
   ```json
   {
     "name": "{{name_field}}",
     "email": "{{email_field}}",
     "phone": "{{phone_field}}",
     "message": "{{message_field}}",
     "budget": "{{budget_field}}"
   }
   ```

#### Krok 3: První testovací požadavek

1. Pošlete **testovací požadavek** z Zapieru
2. Systém automaticky:
   - Vytvoří nový záznam v `zapier_sources`
   - Uloží ukázková data z požadavku
   - Nastaví integraci jako **neaktivní** (čeká na mapování)
   - Zaloguje požadavek se statusem `pending_mapping`

#### Krok 4: Konfigurace mapování v admin rozhraní

1. Přihlaste se jako admin
2. Otevřete **Admin Dashboard**
3. V sekci **"Zapier Integrace"** najděte nově vytvořenou integraci
4. Klikněte na ikonu **"Upravit mapování"** (tužka)
5. V dialogu:
   - Pojmenujte integraci (např. "Kontaktní formulář - Homepage")
   - Klikněte na pole z webhooku (např. "name")
   - Vyberte odpovídající pole poptávky (např. "Jméno klienta")
   - Opakujte pro všechna potřebná pole
6. Klikněte **"Uložit mapování"**
7. Integrace se automaticky aktivuje

### 3. Automatický import

Po dokončení mapování:
- Každý nový požadavek z Zapieru automaticky vytvoří poptávku
- Poptávka se zobrazí v sekci **"Nové poptávky"**
- Status: `new`
- Priorita: `medium` (výchozí)

## Dostupná pole pro mapování

| Pole poptávky | Klíč | Popis |
|---------------|------|-------|
| Název poptávky | `title` | Hlavní název/předmět poptávky |
| Popis | `description` | Detailní popis požadavku |
| Jméno klienta | `client_name` | Jméno nebo název firmy klienta |
| Email klienta | `client_email` | Kontaktní email |
| Telefon klienta | `client_phone` | Kontaktní telefon |
| Počet podstránek | `subpage_count` | Počet podstránek webu (číslo) |
| Zdroj | `source` | Identifikace zdroje poptávky |
| URL úložiště | `storage_url` | Link na dokumenty/soubory |
| URL současného webu | `current_website_url` | Link na stávající web klienta |
| Rozpočet | `budget` | Odhadovaný rozpočet (text nebo číslo) |
| Další poptávané služby | `additional_services` | Dodatečné požadavky nebo služby (text) |
| Akceptovaná cena | `accepted_price` | Finální dohodnutá cena v Kč (číslo) |

## Příklady mapování

### Jednoduchý kontaktní formulář

**Webhook data:**
```json
{
  "jmeno": "Jan Novák",
  "email": "jan@example.com",
  "telefon": "+420 123 456 789",
  "zprava": "Potřebuji nový web pro e-shop"
}
```

**Mapování:**
- `jmeno` → `client_name`
- `email` → `client_email`
- `telefon` → `client_phone`
- `zprava` → `description`

### Komplexní kalkulačka webu

**Webhook data:**
```json
{
  "company_name": "Web s.r.o.",
  "contact_email": "info@web.cz",
  "pages": "15",
  "current_site": "https://old-web.cz",
  "budget_range": "150000",
  "project_description": "Redesign firemního webu"
}
```

**Mapování:**
- `company_name` → `client_name`
- `contact_email` → `client_email`
- `pages` → `page_count`
- `current_site` → `current_website_url`
- `budget_range` → `budget`
- `project_description` → `description`

## Správa integrací

### Aktivace/Deaktivace

- **Zelený badge "Aktivní"**: Integrace funguje, vytváří poptávky
- **Šedý badge "Neaktivní"**: Integrace je pozastavena, požadavky se pouze logují
- Klikněte na ikonu ✓/✕ pro změnu stavu

### Úprava mapování

- Klikněte na ikonu tužky (Edit)
- Upravte název nebo mapování polí
- Uložte změny

### Kopírování URL

- Klikněte na ikonu kopírování
- URL se zkopíruje do schránky
- Použijte v Zapieru

### Smazání integrace

- Klikněte na ikonu koše (Trash)
- Potvrďte smazání
- Všechny logy této integrace budou také smazány

## Log požadavků

V dolní části stránky najdete **"Poslední webhook požadavky"**:
- Zelený status: Poptávka úspěšně vytvořena
- Červený status: Chyba při vytváření
- Žlutý status: Čeká na dokončení mapování

## Bezpečnost

- Každá integrace má **jedinečný token**
- Tokeny jsou automaticky generovány
- Endpoint **nevyžaduje autentizaci** (veřejný webhook)
- **RLS policies** zajišťují, že pouze admini vidí webhook správu
- Logy jsou dostupné pouze pro adminy

## Troubleshooting

### Poptávka se nevytvořila

1. Zkontrolujte log požadavků - jaký je status?
2. Je integrace **aktivní**?
3. Je **mapování kompletní**?
4. Obsahuje webhook všechna namapovaná pole?

### Chybí pole v poptávce

1. Zkontrolujte názvy polí ve webhooku (case-sensitive!)
2. Ověřte mapování v admin rozhraní
3. Podívejte se na ukázková data v detailu integrace

### Token nefunguje

1. Token musí být přesně stejný v URL i v databázi
2. Zkontrolujte, že URL je správně: `?token=VALUE`
3. Token je case-sensitive

## Technické detaily

### Edge Function

- **Endpoint**: `/functions/v1/zapier-webhook`
- **Metoda**: POST
- **Parametr**: `token` (query string)
- **Body**: JSON objekt s daty z formuláře
- **Odpověď**: JSON s informací o úspěchu/chybě

### Databázové schéma

```sql
-- Zdroje webhooků
zapier_sources (
  id uuid,
  name text,
  webhook_token text UNIQUE,
  is_active boolean,
  sample_data jsonb,
  field_mapping jsonb,
  created_at timestamptz,
  updated_at timestamptz
)

-- Log požadavků
zapier_webhooks_log (
  id uuid,
  source_id uuid,
  payload jsonb,
  request_id uuid,
  status text,
  error_message text,
  created_at timestamptz
)
```

## Podpora

Pro více informací nebo pomoc s integrací kontaktujte administrátora systému.
