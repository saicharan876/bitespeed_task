# Bitespeed Identity Reconciliation Service

A backend service that intelligently links customer contact information (email + phone number) across multiple purchases. When a customer uses different combinations of email and phone, the service recognizes them as the same person and consolidates their identity.

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** SQLite (local dev) / PostgreSQL (production)
- **ORM:** Prisma

## Live Endpoint

> **`https://bitespeed-identity.onrender.com/identify`**

*(Update this URL after deploying to Render)*

## How to Run Locally

```bash
# 1. Clone the repo
git clone https://github.com/saicharan876/bitespeed-identity.git
cd bitespeed-identity

# 2. Install dependencies
npm install

# 3. Set up the database
npx prisma migrate dev --name init

# 4. Start the dev server
npm run dev
```

Server runs at `http://localhost:3000`.

## API Usage

### `POST /identify`

**Request:**
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

**Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

### Linking Example

After the first request above, sending:
```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "123456"
}
```

Returns the consolidated identity:
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["mcfly@hillvalley.edu", "lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

## Project Structure

```
├── prisma/
│   └── schema.prisma
├── src/
│   ├── index.ts
│   ├── routes/identify.ts
│   ├── controllers/identifyController.ts
│   ├── services/contactService.ts
│   └── db/prismaClient.ts
├── .env
├── package.json
└── README.md
```
