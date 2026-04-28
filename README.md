<h1> Sławek Kruszyński - Konrad Klautzsch - Matvii Hniezdilov - Wojtek Artymiak - Antoni Barczak - Oskar Kurzyna</h1>

# Increderion Backend - Dokumentacja Projektu

Increderion Backend to silnik analityczny oparty na NestJS, służący do automatycznej weryfikacji kontrahentów (KYC) oraz analizy reputacji firm. System integruje dane rejestrowe z dynamiczną analizą treści internetowych przy użyciu sztucznej inteligencji.

## 🚀 Architektura Systemu

Projekt jest zbudowany w oparciu o framework **NestJS** i wykorzystuje architekturę modularną.

### Kluczowe Moduły:
- **AiModule**: Integracja z OpenRouter (nvidia/nemotron-3-super-120b-a12b:free /  Gemini 2.0 Flash) do analizy treści i generowania podsumowań.
- **AuthModule**: Autoryzacja oparta na Supabase JWT.
- **CompaniesModule**: Zarządzanie danymi firm, wyszukiwanie i autouzupełnianie.
- **ReportsModule**: Obsługa procesów generowania raportów KYC.
- **ScraperModule**: Zaawansowany potok (pipeline) zbierania danych z wielu źródeł.
- **DatabaseModule**: Komunikacja z bazą danych Supabase (PostgreSQL).

---

## 🛠 Stos Technologiczny

- **Backend**: NestJS (Node.js)
- **Baza danych**: Supabase (PostgreSQL)
- **Autentykacja**: Supabase Auth (JWT)
- **AI**: OpenRouter (nvidia/nemotron-3-super-120b-a12b:free / Google Gemini)
- **Scraping**: Firecrawl (opcjonalnie), customowe kroki scrapujące.

---

## 🛰 API Endpoints

### 🔑 Autentykacja (`/auth`)
- `POST /auth/register` - Rejestracja nowego użytkownika.
- `POST /auth/login` - Logowanie i uzyskanie tokenu JWT.

### 🏢 Firmy (`/companies`)
- `POST /companies/search` - Wyszukiwanie firmy po NIP/KRS/Nazwie. Zwraca dane podstawowe.
- `GET /companies/autocomplete/:query` - Sugestie nazw firm dla UI.
- `GET /companies/:id` - Szczegółowe dane firmy.

### 📊 Raporty KYC (`/reports`)
- `POST /reports` - Zlecenie wygenerowania nowego raportu. Uruchamia asynchroniczny potok analizy.
- `GET /reports` - Lista raportów użytkownika.
- `GET /reports/:id` - Pełny raport wraz ze znaleziskami (findings) i podsumowaniem AI.
- `DELETE /reports/:id` - Usunięcie raportu z historii.

---

## 🔄 Potok Analizy (Scraper Pipeline)

Gdy użytkownik zleca raport, system uruchamia `ScraperPipelineService`, który wykonuje następujące kroki:

1.  **RegistryStep**: Pobieranie i aktualizacja danych z oficjalnych rejestrów (KRS, NIP).
2.  **OpinionsStep**: Analiza opinii o firmie w sieci (pracownicy, klienci).
3.  **NewsStep**: Przeszukiwanie serwisów informacyjnych (np. Bankier, PAP) pod kątem wzmianek o firmie.
4.  **ManagementStep**: Analiza powiązań osobowych i historii zarządu.
5.  **AI Enrichment**: 
    - Agregacja wszystkich znalezisk.
    - Generowanie czytelnego podsumowania przez LLM.
    - Tworzenie paneli wydarzeń (events_panels) dla osi czasu.

---

## 🗄 Struktura Bazy Danych (Supabase)

Główne tabele:
- `companies`: Dane podstawowe firm (nazwa, NIP, KRS, REGON, branża).
- `reports`: Nagłówki raportów (status, data, podsumowanie AI).
- `report_findings`: Detale znalezione podczas scrapingu (linki, treści, kategoria, sentyment).

---

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Auth API (Supabase)

Set these env vars before running app:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (preferred)
- `SUPABASE_ANON_KEY` (legacy fallback)

Endpoints:

- `POST /auth/register`
  - body: `{ "email": "user@example.com", "password": "min8chars" }`
- `POST /auth/login`
  - body: `{ "email": "user@example.com", "password": "min8chars" }`

Both endpoints return `user` and `tokens` object. Register response may return empty tokens when email confirmation is required in Supabase project settings.

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
