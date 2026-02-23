
## Architecture

- **Backend**: Node.js + Express + MongoDB
- **Frontend**: React + TypeScript + Vite
- **Auth**: OAuth 2.0 (Client Credentials) → JWT access tokens
- **Encryption**: AES-256-CBC (data) + RSA-2048-OAEP (key wrapping)

## Quick Start

### Backend Setup

```bash
cd backend
npm install

```

Edit `.env` with your values:

```env
PORT=5000
MONGO_URI=uri
OAUTH_CLIENT_ID=my-client-id
OAUTH_CLIENT_SECRET=my-client-secret
JWT_SECRET=your-super-secret-jwt-key
```

Then start the server:

```bash
 node server.js
```

Server runs on `http://localhost:5000`

### Frontend Setup

```bash
cd frontend
npm install

```

Edit `.env`:

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_CLIENT_ID=my-client-id
VITE_CLIENT_SECRET=my-client-secret
```

Then start the dev server:

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

