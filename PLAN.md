# Project Plan - Employee Time Tracking System (Employee Tracker)

## 1. Project Overview

The Employee Time Tracking System is a full-stack web application designed to track employee working hours in an organization.

Employees can clock in and out throughout the day, including lunch breaks, while managers can monitor attendance and generate weekly and monthly reports.

The purpose of this project is to demonstrate full-stack software engineering principles including authentication, database design, CRUD operations, and role-based access control.

---

## 2. Problem Statement

Organizations need a simple and reliable system to track employee working hours accurately.

Manual tracking systems are error-prone and inefficient, especially when calculating total hours, lunch breaks, and monthly summaries.

This application solves that problem by providing a structured and automated time tracking system.

---

## 3. Objectives

- Implement secure user authentication
- Allow employees to track working time accurately
- Support lunch break tracking (out/in)
- Provide managers with aggregated reports
- Store and retrieve structured attendance data
- Demonstrate full-stack development workflow

---

## 4. Scope

### Included Features
- User registration and login
- Role-based access (Employee / Manager)
- Clock In / Clock Out system
- Lunch Out / Lunch In tracking
- Daily attendance records
- Weekly and monthly reporting
- Manager dashboard

### Excluded Features
- Payroll integration
- External HR system integration
- Mobile application
- Biometric authentication

---

## 5. Tech Stack

### Frontend
- Next.js (React framework)
- Tailwind CSS

### Backend
- Next.js API routes
- Prisma ORM

### Database
- SQLite (development environment)

### Authentication
- NextAuth.js (credential-based authentication)

---

## 6. Data Model

### User
Stores authentication and role information.

Fields:
- id (UUID)
- name (string)
- email (string)
- role (EMPLOYEE | MANAGER)

---

### TimeEntry
Stores employee attendance actions.

Fields:
- id (UUID)
- userId (UUID)
- type (CLOCK_IN | LUNCH_OUT | LUNCH_IN | CLOCK_OUT)
- timestamp (datetime)

---

## 7. System Design

The system follows a layered architecture:

Frontend (Next.js UI)
        ↓
API Routes (Server Logic)
        ↓
Prisma ORM
        ↓
SQLite Database

Authentication is handled via NextAuth.js sessions.

---

## 8. Development Plan (Incremental Steps)

1. Initialize project with Next.js
2. Configure authentication system
3. Design and implement database schema
4. Implement employee time tracking features
5. Build manager dashboard
6. Implement reporting system (weekly/monthly)
7. Test full application workflow
8. Final documentation and cleanup

---

## 9. Expected Outcome

A fully functional employee attendance system that:
- Tracks employee working hours accurately
- Supports role-based access control
- Provides meaningful reporting for managers
- Demonstrates full-stack development best practices
