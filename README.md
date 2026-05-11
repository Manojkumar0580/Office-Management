# Office Management (Backend)

## Prerequisites

- Node.js (LTS recommended)

## Setup

1. Install dependencies:
   - `npm install`
2. Create your env file:
   - Copy `.env.example` → `.env` and update values

## Run (development)

- `npm run dev`

## Build + Run (production)

- `npm run build`
- `npm run start`

## Lint & format

- `npm run lint`
- `npm run format:check`
- `npm run format`

## Environment variables

- `PORT`: Server port (default: 3000)
- `MONGODB_URI`: Mongo connection string
- `JWT_SECRET`: Secret for signing JWTs
- `BOOTSTRAP_SUPER_ADMIN_KEY`: One-time key to create the first SUPER_ADMIN (bootstrap endpoint)

## API (v1)

### Auth

- `POST /api/v1/auth/bootstrap-super-admin`
- `POST /api/v1/auth/register/staff`
- `POST /api/v1/auth/register/trainee`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/change-password`
- `GET /api/v1/me`

### Staff approval

- `GET /api/v1/staff`
- `POST /api/v1/staff/:id/approve`
- `POST /api/v1/staff/:id/reject`

### Staff profiles

- `GET /api/v1/staff/:id/profile`
- `PUT /api/v1/staff/:id/profile` (creates profile-change request)
- `POST /api/v1/staff/:id/photo` (multipart, field: `photo`)
- `POST /api/v1/staff/:id/documents` (multipart, field: `document`)

- `GET /api/v1/profile-change-requests` (SUPER_ADMIN)
- `POST /api/v1/profile-change-requests/:id/review` (SUPER_ADMIN)

### Stock / utensils

- `POST /api/v1/stock/items`
- `GET /api/v1/stock/items`
- `PUT /api/v1/stock/items/:id`
- `DELETE /api/v1/stock/items/:id` (soft delete)

- `POST /api/v1/stock/movements/add`
- `POST /api/v1/stock/movements/issue`
- `POST /api/v1/stock/movements/damage`
- `POST /api/v1/stock/movements/replace`

- `POST /api/v1/stock/maintenance/start`
- `POST /api/v1/stock/maintenance/close`

- `GET /api/v1/stock/reports/current`

### Work dashboard

- `POST /api/v1/work` (assign)
- `GET /api/v1/work`
- `GET /api/v1/work/:id`
- `POST /api/v1/work/:id/attachments` (multipart, field: `file`)
- `POST /api/v1/work/:id/submit`
- `POST /api/v1/work/:id/review`
- `GET /api/v1/work/reports/daily`
