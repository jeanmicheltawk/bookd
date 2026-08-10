# BOOK'D HAUS

International creative networking and booking platform for fashion, beauty, advertising, and content creation.

**Slogan:** BOOK AND GET BOOK'D  
**Brand:** Bold · Expressive · Fearless · Creative · Inclusive · Energetic

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Angular 19, Angular Material, SCSS, RxJS, standalone + lazy routes |
| Backend | Node.js, Express, JWT, bcrypt, Multer, Helmet, CORS, rate limiting |
| Database | PostgreSQL 16 |
| Ops | Docker Compose (optional), nginx for production frontend |

## Quick start (local)

### 1. Start PostgreSQL

**Option A — Docker Compose**

```bash
docker compose up -d db
```

Postgres is exposed on **port 5433** (avoids clashes with other local installs).

**Option B — Local PostgreSQL**

Create a database and user matching `backend/.env` (default port in `.env` is `5433`; change if needed):

```sql
CREATE USER bookd WITH PASSWORD 'bookd_secret';
CREATE DATABASE bookd_haus OWNER bookd;
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # already present for local dev
npm install
npm run setup          # migrate + seed
npm run dev            # http://localhost:3000
```

Health check: `GET http://localhost:3000/health`

### 3. Frontend

```bash
cd frontend
npm install
npm start              # http://localhost:4200
```

### Admin login

| Field | Value |
|-------|-------|
| Email | `admin@bookd.com` |
| Password | `bookdadmin` |

Password is stored with bcrypt. Demo creatives use `*@bookd.demo` / `demo1234`.

## Full stack with Docker

```bash
docker compose up --build
```

- Web: http://localhost:8080  
- API: http://localhost:3000  
- Postgres: localhost:5433

## Troubleshooting

**Docker engine not ready / API 500**  
Open Docker Desktop and wait until the engine is fully running, then:

```bash
docker compose up -d db
cd backend && npm run setup && npm run dev
```

**Port conflicts**  
Compose exposes Postgres on **5433**. Point `DB_PORT` in `backend/.env` at your own Postgres if you prefer.

## Project structure

```
bookd-haus/
├── frontend/          Angular 19 app (public site, user dashboard, admin CMS)
├── backend/           Express REST API + migrations + seeds
├── docker-compose.yml Postgres + API + Web
├── docs/API.md        REST API reference
└── README.md
```

## Brand colors

| Name | Hex |
|------|-----|
| Acid Lime | `#C6FF00` |
| Nuclear Yellow | `#FFF500` |
| Hyper Pink | `#FF00A8` |
| Toxic Orange | `#FF4D00` |
| Electric Blue | `#0047FF` |
| Laser Cyan | `#00F5FF` |
| UV Purple | `#8F00FF` |
| Ink Black | `#09000F` |

Theme colors are editable live from **Admin → Theme** and applied via CSS variables.

## Features

### Public platform
- Fixed nav + category bar (Models, Photographers, … Brand/Client hidden from search)
- Hero slides (shuffled every load)
- Announcements marketplace with moderation
- Community spotlight (randomized)
- Search with premium-first randomized ranking
- Profiles with BOOK NOW
- Challenges / events, Learning Hub, Pricing + estimator
- Contact form, About, SEO (meta, OG, robots, sitemap)

### Membership tiers
Visitor → Free → Basic (7-day trial) → Premium (2-week trial)

### User dashboard
Bookings, messages, portfolio, announcements, settings, analytics summary

### Booking flow
Select creative → project type → date → location → brief → moodboard → budget → send  
Creative: Accept / Decline / Negotiate → project stages through Reviewed

### Admin CMS
- Edit home/sections, navigation, footer, contact, social
- Live theme editor (primary/secondary/accent/background/text/gradients/badge)
- Media library (upload, folders, replace, delete)
- Contact inbox (status, delete, CSV export)
- Analytics (visitors, contacts, popular pages, activity)
- Moderate announcements, manage events/learning/testimonials
- User management (verify, membership, suspend)

## Environment variables

See `backend/.env.example`.

## Scripts

**Backend**

| Script | Description |
|--------|-------------|
| `npm run dev` | Nodemon API |
| `npm run migrate` | Apply SQL migrations |
| `npm run seed` | Seed admin, categories, CMS, demo data |
| `npm run setup` | migrate + seed |

**Frontend**

| Script | Description |
|--------|-------------|
| `npm start` | Dev server :4200 |
| `npm run build` | Production build |

## API documentation

See [docs/API.md](docs/API.md).

## Security

- JWT auth + optional refresh
- bcrypt password hashing
- Helmet, CORS, rate limiting
- Parameterized SQL (pg)
- Input validation (express-validator)
- Multer upload limits + type filter
- Route guards on admin/user dashboards

## License

Proprietary — BOOK'D HAUS
