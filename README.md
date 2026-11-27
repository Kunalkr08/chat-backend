# Connectify — Real-Time Chat Backend

The backend that powers **Connectify**, a real-time messaging application built with NestJS and TypeScript. It provides authentication, email verification, persistent message storage, and real-time communication between users.

**Frontend:** [chat-frontend](https://github.com/Kunalkr08/chat-frontend)

## Features

- **User Authentication:** Registration and login with password hashing and JWT-based authentication.
- **Email Verification:** Email verification flow for newly registered users using OTP-based verification.
- **Secure Sessions:** HTTP-only cookies for managing authentication tokens.
- **REST APIs:** Endpoints for authentication, user information, and chat-related operations.
- **Real-Time Messaging:** Socket.IO-based communication for sending and receiving messages.
- **Message Persistence:** Store messages in PostgreSQL using Prisma ORM.
- **Read Receipts:** Track message read status and notify users when messages are read.
- **Database Migrations:** Manage database schema changes with Prisma Migrate.
- **Input Validation:** Validate incoming requests using class-validator.

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js |
| Backend framework | NestJS |
| Language | TypeScript |
| Database | PostgreSQL (Neon supported) |
| ORM | Prisma |
| Real-time communication | Socket.IO |
| Authentication | JWT, HTTP-only cookies |
| Password hashing | bcryptjs |
| Email delivery | Resend |
| Testing | Vitest |

## Architecture

Connectify uses REST APIs for standard application operations and Socket.IO for real-time events.

```text
React Native App
       |
       | REST API requests
       | Socket.IO events
       v
NestJS Backend
       |
       +---- Authentication & Authorization
       |
       +---- User & Messaging Logic
       |
       +---- Socket.IO Gateway
       |
       v
Prisma ORM
       |
       v
PostgreSQL Database
```

The backend handles application logic and database operations, while the frontend is responsible for displaying the chat interface and handling user interactions.

## Getting Started

### Prerequisites

- Node.js and npm
- PostgreSQL database (local PostgreSQL or Neon)
- Git
- Email service credentials for testing email verification

### 1. Clone the repository

```bash
git clone https://github.com/Kunalkr08/chat-backend.git
cd chat-backend
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root. Configure the variables required by your current backend implementation.

Typical configuration includes:

```env
DATABASE_URL="your_postgresql_connection_string"
JWT_SECRET="your_long_random_secret"
JWT_REFRESH_SECRET="another_long_random_secret"
OTP_HASH_SECRET="another_long_random_secret"
JWT_ACCESS_TOKEN_TTL_SECONDS=900
JWT_REFRESH_TOKEN_TTL_SECONDS=86400
```

Also configure the email provider credentials and any frontend/CORS settings required by your implementation.

**Important:** Use your own credentials, never commit `.env`, and do not copy production secrets into public files.

### 3. Set up the database

Generate the Prisma Client:

```bash
npx prisma generate
```

For an existing database with committed migrations, apply them with:

```bash
npx prisma migrate deploy
```

For local development when creating a new migration, use:

```bash
npx prisma migrate dev
```

Use the migration workflow appropriate to your environment. Do not run development migrations against production without reviewing the changes.

### 4. Start the server

```bash
npm run start:dev
```

The backend runs on the configured port. If using the default configuration, the application is expected to be available at `http://localhost:3000`.

### 5. Connect the frontend

Clone and configure the [Connectify frontend](https://github.com/Kunalkr08/chat-frontend). Set its API and Socket.IO URLs to point to this backend.

For a physical Android device, use your computer's reachable LAN IP or a deployed backend URL instead of `localhost`.

## Authentication and email verification

`POST /auth/register` creates a pending account and returns `202` with
`message`, `deliveryStatus`, and `resendAfterSeconds`. The delivery status is
`accepted` when the email provider accepts the request, `failed` when the
request could not be sent, or `cooldown` when another request was made too
recently. Provider acceptance does not guarantee inbox delivery.

`POST /auth/resend-verification` accepts `{ "email": "user@example.com" }` and
returns the same response shape. Resends have a 60-second cooldown and replace
the previous OTP when a new request is prepared. The response is generic when
the address has no pending verification.

`POST /auth/verify-email` accepts an email address and a four-digit `otp`.
Codes expire after 10 minutes and are consumed after successful verification.
Repeating signup for an unverified account returns the user to this flow
instead of blocking them with a duplicate-account error.

`POST /auth/login` returns an `accessToken` in the response body and sets the
refresh token in an HTTP-only cookie. Send the access token as
`Authorization: Bearer <accessToken>` for protected HTTP routes, or as
`auth.token` when connecting to the Socket.IO gateway.

## Development Commands

| Command | Purpose |
|---|---|
| `npm run start:dev` | Start in watch mode |
| `npm run build` | Build the application |
| `npm run start:prod` | Run the production build |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:cov` | Generate test coverage |

## Related Repository

- **Mobile application:** [github.com/Kunalkr08/chat-frontend](https://github.com/Kunalkr08/chat-frontend)

## License

Refer to the repository's license and usage terms.
