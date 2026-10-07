# Smart Disaster Early-Warning and Emergency Coordination System for Sri Lanka

> **BSc (Hons) Software Engineering Project**  
> Mobile Application (`disaster-warning-mobile`)

---

## 📌 Project Overview

The **Smart Disaster Early-Warning and Emergency Coordination System for Sri Lanka** is a mobile application developed to provide real-time disaster alerts, safety guidelines, hazard reporting, and emergency coordination across Sri Lanka.

This repository contains the mobile client built with **React Native** and **Expo**.

---

## 🛠️ Tech Stack

- **Framework:** React Native (Expo)
- **Language:** TypeScript (Strict Mode)
- **Routing:** Expo Router (File-based navigation)
- **Package Manager:** npm
- **Code Quality:** ESLint & Prettier

---

## 📋 Requirements

Before setting up the project, make sure you have the following installed on your machine:

- **Node.js** (v18.x or later)
- **npm** (v9.x or later)
- **Git**
- **Expo Go App** (installed on your physical iOS or Android device) **OR** an **Android Emulator** / **iOS Simulator**

---

## 🚀 Installation & Setup

Follow these steps to set up the project locally:

### 1. Clone the Repository

```bash
git clone <repository-url>
cd disaster-warning-mobile
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Copy `.env.example` to create your local `.env` file:

```bash
cp .env.example .env
```

_(Fill in local API keys or endpoints in `.env` if necessary. Never commit `.env` to Git)._

### 4. Start the Application

```bash
npm start
```

### 🏃 Running on Android / Expo Go

- **Using Expo Go on physical device:** Scan the QR code displayed in your terminal using the **Expo Go** app (Android) or the default Camera app (iOS).
- **Using Android Emulator:** Press `a` in the terminal after running `npm start`, or execute:
  ```bash
  npm run android
  ```

---

## 🌿 Git Branching Strategy

The repository follows a structured team branching model:

```text
main
  │
  └── develop
        ├── feature/member1-auth-screen
        ├── feature/member2-hazard-reports
        ├── feature/member3-shelter-map
        └── feature/member4-emergency-contacts
```

- **`main`**: Production branch representing the stable version.
- **`develop`**: Primary integration branch for team development.
- **`feature/*`**: Individual feature branches created from `develop`.

---

## ⚠️ Important Team Rules

1. ❌ **Never commit directly to `main`.**
2. ❌ **Never commit directly to `develop` unless explicitly agreed by the team.**
3. ✅ **Always create a new feature branch for your work.**

### Step-by-Step Feature Workflow:

1. **Switch to `develop` & pull latest changes:**

   ```bash
   git checkout develop
   git pull origin develop
   ```

2. **Create your feature branch:**

   ```bash
   git checkout -b feature/citizen-login
   ```

3. **Work on your feature & commit:**

   ```bash
   git add .
   git commit -m "feat: add citizen login screen UI"
   ```

4. **Push your branch to GitHub:**

   ```bash
   git push origin feature/citizen-login
   ```

5. **Open a Pull Request (PR):**
   - Target branch: `develop`
   - Request a review from at least one team member.
   - Merge into `develop` once approved.

---

## 🔄 Team Development Workflow

1. Clone the repository.
2. Create a feature branch from `develop`.
3. Work **only** on your assigned feature.
4. Keep commits small and meaningful.
5. Push the feature branch to GitHub.
6. Create a Pull Request into `develop`.
7. Have another team member review the PR.
8. Merge into `develop` after approval.

---

## 🎨 Code Style & Conventions

To maintain a clean codebase, follow these rules:

- Use **TypeScript** strictly without using `any`.
- Use **Functional Components** with **React Hooks**.
- Keep components small, modular, and reusable.
- **File & Naming Conventions:**
  - **Components:** `PascalCase.tsx` (e.g., `AlertCard.tsx`)
  - **Hooks:** `useSomething.ts` (e.g., `useLocation.ts`)
  - **Utilities:** `something.ts` (e.g., `formatDate.ts`)
  - **Types:** `something.types.ts` (e.g., `disaster.types.ts`)

---

## 📜 NPM Scripts

| Command                | Description                                          |
| :--------------------- | :--------------------------------------------------- |
| `npm start`            | Starts the Expo development server                   |
| `npm run android`      | Starts the app on connected Android emulator/device  |
| `npm run lint`         | Runs ESLint check across all project files           |
| `npm run format`       | Formats code automatically using Prettier            |
| `npm run format:check` | Checks code formatting without modifying files       |
| `npm run typecheck`    | Runs TypeScript type checking without emitting files |
| `npm run check`        | Runs both ESLint linting and TypeScript checking     |

---
