# Employee Time Tracking System (Employee Tracker)

## 🚀 Live Demo
https://employee-tracker-six-omega.vercel.app/login

## Project Overview

The Employee Time Tracking System is a full-stack web application designed to manage employee attendance and work hour tracking in organizations.

Employees can clock in and out during the workday, including lunch breaks, while managers can monitor daily, weekly, and monthly work activity.

---

## Features

### Employee Features
- Secure login/logout authentication
- Clock In / Clock Out system
- Lunch Out / Lunch In tracking
- View personal attendance history
- View weekly and monthly worked hours

### Manager Features
- View all employees
- Access attendance reports
- Weekly and monthly summaries
- Employee-specific breakdowns

---

## Technology Stack

### Frontend
- Next.js 16 (React)
- Tailwind CSS

### Backend
- Next.js API routes
- Prisma ORM
- SQLite database (development)

### Authentication
- NextAuth.js (credential-based authentication)

---

## Database Design

### User
- id
- name
- email
- role (EMPLOYEE | MANAGER)

### TimeEntry
- id
- userId
- type (CLOCK_IN, LUNCH_OUT, LUNCH_IN, CLOCK_OUT)
- timestamp

---

## Architecture

Client (Next.js Frontend)
↓
API Routes
↓
Prisma ORM
↓
SQLite Database

Authentication handled via NextAuth.js sessions.

---

## Installation

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev