# BOOK'D HAUS API

Base URL (local): `http://localhost:3000/api`  
Auth header: `Authorization: Bearer <accessToken>`

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register member/brand |
| POST | `/auth/login` | — | Login → `{ user, accessToken, refreshToken }` |
| POST | `/auth/refresh` | — | Body `{ refreshToken }` |
| GET | `/auth/me` | JWT | Current user + profile summary |

### Register body
```json
{
  "email": "you@example.com",
  "password": "secret12",
  "fullName": "Your Name",
  "professionalName": "Stage Name",
  "categorySlug": "photographers"
}
```

## Discovery

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/categories` | — | Professional categories |
| GET | `/search` | optional | Profiles (premium shuffled first) |
| GET | `/spotlight` | — | Randomized community spotlight |
| GET | `/hero-slides` | — | Shuffled hero slides |

### Search query params
`q`, `category`, `country`, `availability`, `verified`, `gender`, `ageMin`, `ageMax`, `page`, `limit`

## CMS

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/cms/settings` | — | All website settings |
| GET | `/cms/settings/:key` | — | One setting (`site`, `navigation`, `footer`, `contact`, `social`) |
| PUT | `/cms/settings/:key` | admin | Update setting JSON |
| GET | `/cms/theme` | — | Active theme colors |
| PUT | `/cms/theme` | admin | Update theme (live CSS vars on frontend) |
| GET | `/cms/pages/:slug` | optional | Page + meta |
| PUT | `/cms/pages/:slug` | admin | Update page |
| GET | `/cms/pages/:slug/sections` | optional | Page sections |
| PUT | `/cms/sections/:id` | admin | Update section content |

## Media (admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/media` | List (`folder`, `page`, `limit`) |
| GET | `/media/folders` | Folder list |
| POST | `/media` | Multipart `file` + optional `folder`, `altText` |
| PUT | `/media/:id` | Replace file |
| DELETE | `/media/:id` | Delete |

Uploaded files served at `http://localhost:3000/uploads/...`

## Contact

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/contact` | — | Submit message |
| GET | `/contact` | admin | List / filter by status |
| PATCH | `/contact/:id` | admin | Update status / notes |
| DELETE | `/contact/:id` | admin | Delete |
| GET | `/contact/export/csv` | admin | CSV export |

## Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/analytics/track` | optional | `{ path, eventType?, metadata? }` |
| GET | `/admin/analytics` | admin | Visitors, contacts, popular pages, activity |
| GET | `/admin/users` | admin | List users (`q`, `role`, `membership`, `verified`) |
| PATCH | `/admin/users/:id` | admin | Update `role`, `membership`, `is_verified`, `is_active` |

## Profiles

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/profiles/:idOrSlug` | optional | Public profile + portfolio |
| PATCH | `/profiles/me` | JWT | Update own profile |
| GET/POST/PATCH/DELETE | `/profiles/me/portfolio` | JWT | Portfolio CRUD |

## Announcements

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/announcements` | — | Approved listings |
| GET | `/announcements/:id` | optional | Detail |
| POST | `/announcements` | JWT | Create (pending moderation; brands/premium rules apply) |
| POST | `/announcements/:id/apply` | JWT | Apply |
| GET | `/announcements/mine` | JWT | My posts |
| GET | `/admin/announcements` | admin | Moderation queue |
| PATCH | `/admin/announcements/:id` | admin | Approve / reject / close |

## Bookings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/bookings` | JWT | Create booking request |
| GET | `/bookings/mine` | JWT | As client or creative |
| GET | `/bookings/:id` | JWT | Detail |
| POST | `/bookings/:id/accept` | JWT | Creative accept |
| POST | `/bookings/:id/decline` | JWT | Decline |
| POST | `/bookings/:id/negotiate` | JWT | Counter quote |
| PATCH | `/bookings/:id/status` | JWT | Stage updates |

Statuses: `pending` → `accepted` / `negotiating` → `in_progress` → `completed` → `reviewed` | `cancelled`

## Messaging

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/messages/conversations` | JWT | Inbox |
| POST | `/messages/conversations` | JWT | Start / get DM |
| GET | `/messages/conversations/:id` | JWT | Messages |
| POST | `/messages/conversations/:id` | JWT | Send |
| POST | `/messages/conversations/:id/read` | JWT | Mark read |
| GET | `/messages/saved` | JWT | Saved messages |
| PATCH | `/messages/:messageId/save` | JWT | Toggle saved |
| POST | `/messages/:messageId/report` | JWT | Report |

## Events / Learn / Testimonials / Pricing / Dashboard

| Method | Path | Auth |
|--------|------|------|
| GET | `/events`, `/events/:idOrSlug` | public |
| CRUD | `/admin/events` | admin |
| GET | `/learn`, `/learn/:idOrSlug` | public |
| CRUD | `/admin/learn` | admin |
| GET | `/testimonials` | public |
| CRUD | `/admin/testimonials` | admin |
| POST | `/pricing/estimate` | public |
| GET | `/dashboard/me` | JWT |

### Pricing estimate body
```json
{
  "categorySlug": "photographers",
  "projectType": "Fashion Shoot",
  "durationHours": 8,
  "shootingDays": 2,
  "location": "Los Angeles",
  "deliverables": 20,
  "commercialUsage": true,
  "travelRequired": false,
  "editingRequired": true,
  "teamSize": 1,
  "yearsExperience": 5
}
```

## Errors

```json
{ "error": "Message" }
```

Common status codes: `400` validation, `401` auth, `403` forbidden, `404` not found, `409` conflict, `429` rate limit.
