
# LocalLink

**LocalLink** is a community-focused platform that connects citizens, local service providers, municipal civic officers, and platform administrators in one place.

**Developed by:** Jayant Bansal

## Core Modules

- **Consumer Mode:** Citizens discover local service providers, save profiles, and submit service requests. Vendors receive requests and manage work through completion.
- **Community Mode:** Citizens report civic issues with photo evidence, support community reports, and track issues through escalation and municipal resolution.
- **Government Operations:** Municipal civic officers review escalated issues and update inspection, progress, resolution, and closure records.
- **Platform Administration:** Administrators view platform-wide analytics, manage accounts, provision Government Officers, and verify provider profiles.

## Technology Stack

- **Backend:** Node.js, Express.js
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Data Storage:** JSON file persistence
- **Authentication:** PBKDF2 password hashing and cookie or bearer-token sessions
- **File Uploads:** Multer for civic issue evidence

## Project Structure

```text
LocalLink/
├── data/
│   └── legacy/
├── docs/
├── middleware/
├── pages/
│   ├── admin/
│   ├── auth/
│   ├── community/
│   │   └── legacy/
│   ├── consumer/
│   │   └── legacy/
│   ├── contact/
│   ├── dashboard/
│   └── home/
├── public/
│   ├── assets/
│   ├── css/
│   ├── js/
│   └── uploads/
│       └── issues/
├── routes/
├── services/
├── package.json
└── server.js
```

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm

### Installation

Clone the repository and navigate to the project directory:

```bash
git clone <your-repository-url>
cd LocalLink
```

Install dependencies:

```bash
npm install
```

Start the application:

```bash
npm start
```

Open the application in your browser:

http://localhost:3000

## Key Features

- Role-based access for Citizens, Vendors, Government Officers, and Platform Administrators.
- Local service discovery and provider profiles.
- Service request management.
- Civic issue reporting with photo evidence.
- Community support and issue tracking.
- Municipal review and issue-status management.
- Platform analytics and administrative account management.
- Responsive layouts for desktop and mobile devices.

## Data Storage

- Application records are stored in JSON files under `data/`.
- Civic issue evidence images are stored under `public/uploads/issues/`.
- Inactive legacy files are preserved separately and are not part of the active application workflow.

Back up persistent data and uploaded files before performing maintenance or deployment operations.

## Security

- Passwords are hashed using PBKDF2.
- Protected operations rely on server-side authentication and role-based authorization.
- Administrative and Government Officer functionality must remain protected from unauthorized access.

## Project Scope

LocalLink focuses on local service discovery, community civic issue reporting, municipal issue management, and platform administration.

Tender and Procurement functionality is outside the current project scope.

## Author

**Jayant Bansal**

GitHub: [JayantBansal900](https://github.com/JayantBansal900)
