# Barbitch Admin Panel

Admin panel for Barbitch barbershop built with React + Vite.

## Tech Stack

- **React 19** - UI library
- **Vite 7** - Build tool and dev server
- **React Router 7** - Client-side routing
- **TypeScript 5** - Type safety
- **Tailwind CSS 3** - Styling
- **Axios** - HTTP client
- **Recharts** - Charts and data visualization
- **date-fns** - Date utilities
- **Sass** - CSS preprocessor

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm or yarn

### Installation

```bash
npm install
```

### Development

Start the development server on port 3001:

```bash
npm run dev
```

The admin panel will be available at `http://localhost:3001`

### Production Build

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:1337
```

For production (admin.barbitch.cz), set:

```env
VITE_API_URL=https://your-strapi-backend-url.com
```

## Project Structure

```
admin/
├── src/
│   ├── components/        # Shared components
│   ├── context/          # React context providers
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Third-party library configs
│   ├── pages/            # Page components
│   │   ├── admin/        # Admin dashboard pages
│   │   │   ├── components/  # Admin-specific components
│   │   │   ├── fetch/       # Data fetching functions
│   │   │   └── global/      # Global admin pages
│   │   └── Login.tsx     # Login page
│   ├── services/         # API services
│   ├── types/            # TypeScript types
│   ├── utils/            # Utility functions
│   ├── App.tsx           # Main App component
│   ├── index.css         # Global styles
│   └── main.tsx          # Entry point
├── .env                  # Environment variables
├── index.html            # HTML template
├── package.json          # Dependencies
├── tailwind.config.js    # Tailwind configuration
├── tsconfig.json         # TypeScript configuration
└── vite.config.ts        # Vite configuration
```

## Features

- **User Authentication** - Login system for staff and administrators
- **Personal Dashboard** - View personal work statistics and earnings
- **Financial Overview** - Track income, expenses, and profit
- **Client Management** - View and manage client reservations
- **Charts & Analytics** - Visualize business metrics
- **Responsive Design** - Works on desktop and mobile devices

## Deployment

The admin panel is designed to be deployed on a separate domain (admin.barbitch.cz).

### Build for Production

```bash
npm run build
```

### Deploy

Upload the contents of the `dist` directory to your hosting provider.

## License

Private - Barbitch Barbershop
