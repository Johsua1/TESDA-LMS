# HYTech Learning Management System

## User Manual

### Super Admin · Trainer · Trainee

---

**Version 1.0**
**October 2026**

**HYT Global Institute**

---

<div align="center">

*This manual is written for the web-based HYTech Learning Management System (LMS). It covers every screen that exists in the current build for the three user roles: Super Admin, Trainer, and Trainee.*

</div>

---

## Document Information

| Item | Details |
|---|---|
| Document title | HYTech Learning Management System — User Manual |
| Document code | HGI-LMS-UM-001 |
| Version | 1.0 |
| Status | Released for review |
| Date issued | 21 October 2026 |
| System name | HYTech Learning Management System (HYTech LMS) |
| Institution | HYT Global Institute |
| Intended readers | Super Admins, Trainers, Trainees, onboarding staff, IT support |
| Basis of content | Direct review of the application source code (routes, navigation, screens, and validation rules) as of the date of issue |
| Screenshots | Placeholders only — see the note in Section 3 |

### Version History

| Version | Date | Author | Summary of changes |
|---|---|---|---|
| 0.1 | 21 October 2026 | Documentation Team | Initial outline and role inventory |
| 1.0 | 21 October 2026 | Documentation Team | First complete release: all three role manuals, permissions matrix, troubleshooting, glossary |

### Review and Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Prepared by | Documentation Team | | |
| Reviewed by | System Administrator | | |
| Approved by | Institution Head | | |

---

## Table of Contents

1. Introduction
2. Purpose and Scope
3. System Requirements
4. How to Access the System
5. General Login and Logout Instructions
6. Super Admin User Manual
   - 6.1 Understanding the Super Admin workspace
   - 6.2 The Dashboard
   - 6.3 Managing trainee accounts
   - 6.4 Managing trainer accounts
   - 6.5 Managing courses (training programs)
   - 6.6 Reviewing competencies
   - 6.7 Reviewing lessons, quizzes, and exams
   - 6.8 Processing enrollment applications
   - 6.9 Managing class schedules
   - 6.10 Monitoring attendance
   - 6.11 Recording payments (Accounting)
   - 6.12 Reports and analytics
   - 6.13 Trainer feedback (read, correct, export)
   - 6.14 Announcements
   - 6.15 System settings
   - 6.16 Account security and MFA
   - 6.17 Changing your own password
   - 6.18 Troubleshooting for Super Admins
7. Trainer User Manual
   - 7.1 Understanding the Trainer workspace
   - 7.2 The Dashboard
   - 7.3 Viewing assigned courses
   - 7.4 Viewing enrolled trainees
   - 7.5 Creating and managing lessons
   - 7.6 Creating and managing quizzes
   - 7.7 Creating and managing exams
   - 7.8 Handling quiz access requests
   - 7.9 Managing class schedules
   - 7.10 Recording attendance
   - 7.11 Evaluating trainee performance
   - 7.12 Reviewing typing test results
   - 7.13 Monitoring trainee progress
   - 7.14 Posting announcements
   - 7.15 Updating your profile and password
   - 7.16 Troubleshooting for Trainers
8. Trainee User Manual
   - 8.1 Understanding the Trainee workspace
   - 8.2 The Dashboard
   - 8.3 Viewing your courses
   - 8.4 Enrolling in a program
   - 8.5 Studying a lesson and downloading materials
   - 8.6 Taking a quiz
   - 8.7 Taking an exam
   - 8.8 Requesting late access or a retake
   - 8.9 Viewing class schedules
   - 8.10 Viewing your attendance
   - 8.11 Viewing grades and results
   - 8.12 Taking the typing test
   - 8.13 Submitting trainer feedback
   - 8.14 Making a payment
   - 8.15 Reading announcements
   - 8.16 Updating your profile and password
   - 8.17 Troubleshooting for Trainees
9. Role-Based Permissions and Access Comparison
10. Common Errors and Troubleshooting
11. Security Guidelines and Best Practices
12. Frequently Asked Questions
13. Glossary of Terms
14. Support and Contact Information
15. Appendix A — Screenshot Checklist
16. Appendix B — Items To Be Confirmed

---

## 1. Introduction

The HYTech Learning Management System (LMS) is the web portal of HYT Global Institute for planning, delivering, and tracking training programs. It replaces paper class records and scattered spreadsheets with one shared workspace.

The system has **three roles**, and each role sees a different menu:

| Role | Who they are | Main responsibility |
|---|---|---|
| **Super Admin** | The institution's system owner or administrator | Creates accounts, sets up programs, approves enrollments, monitors the whole institution, and is the only role that can read trainee feedback |
| **Trainer** | The person who teaches a program | Builds lessons and assessments, schedules classes, records attendance, evaluates trainees, and monitors progress |
| **Trainee** | The learner | Enrolls, studies lessons, takes quizzes and exams, checks grades and attendance, pays fees, and submits trainer feedback |

Everything a user can see is controlled by their role and, for trainers, by **which programs are assigned to them**. A trainer cannot open a program they are not assigned to, and a trainee cannot open a program they are not enrolled in.

> **Note**
> The system uses the words **program** and **course** for the same thing. The menu calls the module **Courses**, while records inside it are called *training programs*. This manual uses both terms interchangeably and always means the same record.

### Document conventions

| Style | Meaning |
|---|---|
| **Bold** | A menu item, button, tab, field label, or page name exactly as it appears on screen |
| `Monospace` | Text you type, a value, or a file name |
| 1. 2. 3. | Steps that must be done in order |
| > **Note** | Extra information that helps you understand the step |
| > **Tip** | A faster or safer way to do something |
| > **Warning** | Something that cannot be undone, or that affects other users |
| *To Be Confirmed (TBC)* | The system does not currently define this, or the answer depends on your institution's setup |

---

## 2. Purpose and Scope

### 2.1 Purpose

This manual helps a first-time user operate the system without constant help from an administrator. It explains:

- what each role can and cannot do;
- where each feature is located in the menu;
- which fields must be filled in, and in what format;
- what confirmation appears when an action succeeds;
- what to do when an action fails.

### 2.2 Scope — what this manual covers

- Signing in, signing out, first-time account setup, password reset, and two-factor authentication.
- All Super Admin screens: dashboard, trainees, trainers, courses, competencies, lessons, quizzes, exams, enrollment, schedules, attendance, accounting, reports, trainer feedback, announcements, and system settings.
- All Trainer screens: dashboard, courses, trainees, lessons, quizzes, exams, schedules, attendance, evaluations, typing tests, progress monitoring, and announcements.
- All Trainee screens: dashboard, courses, lessons, quizzes, exams, schedules, attendance, grades, typing test, trainer feedback, enrollment, payments, announcements, and profile.

### 2.3 Out of scope — what this manual does not cover

- Server installation, database migration, and deployment. These are covered in the technical documentation `docs/BACKEND.md` and `docs/FEEDBACK_AND_TIMERS.md`.
- Institutional policy on grading, fees, or scholarship eligibility.
- Email server configuration.
- Payroll, HR, or accounting systems outside this portal.

### 2.4 Assumptions

This manual assumes that:

1. Your institution has a working deployment of the system and a valid web address.
2. Your account has already been created by the Super Admin (trainers and trainees) or provisioned during system setup (Super Admin).
3. You have a stable internet connection and a modern web browser.
4. Your institution uses the default assessment thresholds unless your Super Admin has changed them: passing score **75%**, typing test passing rate **40%**, attendance requirement **80%**.

If any of these is not true, contact your Super Admin before following the steps in this manual.

---

## 3. System Requirements

### 3.1 Device and browser

| Item | Minimum | Recommended |
|---|---|---|
| Device | Desktop or laptop | Desktop or laptop (mobile works but tables are easier on a wide screen) |
| Screen width | 1024 px | 1366 px or wider |
| Browser | Current version of Chrome, Edge, Firefox, or Safari | Latest Chrome or Edge |
| JavaScript | Must be enabled | Enabled |
| Internet | Required at all times | Wired or stable Wi-Fi |
| PDF reader | Required to open downloadable materials | Any built-in viewer |

> **Note**
> There is nothing to install. The system runs in the browser.

### 3.2 Accounts and credentials

| Requirement | Who needs it |
|---|---|
| Institutional email address | All roles — this is your login name |
| Password rated **Good** or higher | All roles |
| Access to the email inbox | Trainers and trainees (to open the activation link), anyone resetting a password |
| Authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.) | Super Admin, when two-factor authentication is switched on |

### 3.3 Network and email

- The portal must be reachable from your network. If the page does not load at all, ask your IT contact whether the site is blocked.
- Activation and password-reset emails are sent by the system. If they do not arrive, check the **Spam** or **Junk** folder first.

### 3.4 Supported file types for learning materials

Trainers can attach materials to a lesson in two ways: by **uploading a file** or by **pasting a link**. Uploaded files are stored with the lesson record, so keep them small (a few megabytes at most). Large files should be placed in your institution's shared drive and added as a link instead.

---

## 4. How to Access the System

### 4.1 Web address

1. Open your browser.
2. Type the portal address provided by your institution.
3. Press **Enter**.

> **Note — To Be Confirmed**
> The production web address is deployment-specific and is not stored inside the application. Ask your Super Admin or IT contact for the exact URL, then write it here for your records:
>
> Institution portal URL: ______________________________________________

The first screen you see is the **Sign in** page.

[Insert Screenshot: Login Page]
**Caption:** Sign-in page of the HYTech LMS.
**What to look for:** (1) the institution logo and the tagline panel on the left; (2) the **Email address** field; (3) the **Password** field with the eye icon that shows or hides what you typed; (4) the **Forgot password?** link; (5) the **Sign in** button; (6) the **Sign up** link at the bottom, which is for trainees who do not yet have an account.

### 4.2 First-time access (trainers and trainees)

New trainer and trainee accounts are created by the Super Admin. The system does **not** issue a temporary password. Instead:

1. The Super Admin creates your account and enters your email address.
2. The system sends you an **activation email** containing a secure link.
3. You open the link and land on the **Account setup** page.
4. You create your own password (rated **Good** or higher) and confirm it.
5. You are taken straight to your dashboard — no second sign-in needed.

> **Warning**
> The activation link can only be used once and expires. If it has expired, the page shows *"This link is invalid or has expired."* Ask your Super Admin to resend the invitation, then open the **newest** email. Older links will not work.

### 4.3 Self-registration (trainees only)

If your institution allows public registration, a person can create a trainee account from the **Sign up** page.

1. On the Sign in page, click **Sign up**.
2. Complete **First Name**, **Last Name**, **Email**, **Contact Number**, **Password**, **Confirm Password**, **Date of Birth**, **Profile Picture** (optional), and **Address**.
3. Tick the agreement box for the Terms and Conditions and Privacy Policy.
4. Click **Create Account**.
5. The message *"Account created successfully! You can now sign in."* appears and you are returned to the Sign in page.

> **Note**
> Self-registration creates a **trainee** account only. Trainer and Super Admin accounts are always created by the administrator.

---

## 5. General Login and Logout Instructions

These steps are the same for all three roles. After signing in, the system opens the dashboard that belongs to your role.

### 5.1 Signing in

1. Open the portal address in your browser.
2. In **Email address**, type the email address registered to your account.
3. In **Password**, type your password. Click the eye icon to check what you typed if needed.
4. Click **Sign in**.
5. Wait for the page to load. A green message *"Welcome back, [First name]!"* confirms success.
6. You land on:
   - Super Admin → **Dashboard** at `/admin`
   - Trainer → **Dashboard** at `/trainer`
   - Trainee → **Dashboard** at `/trainee`

**If sign-in fails:** a red message appears under the Password field. Check for a mistyped email, a stuck Caps Lock, or an extra space copied with the password. If the message says the credentials are invalid, use **Forgot password?**.

[Insert Screenshot: Login Page with error message]
**Caption:** A failed sign-in.
**What to look for:** the red error text directly below the **Password** field. The form does not clear your email address, so you only need to retype the password.

### 5.2 Signing in with two-factor authentication (Super Admin)

If your Super Admin account has two-factor authentication switched on, a second step appears after the password.

1. Complete **Email address** and **Password**, then click **Sign in**.
2. The page changes to **Two-factor authentication**.
3. Open your authenticator app and read the current 6-digit code.
4. Type the code in **Verification code**. The field accepts digits only and stops at six.
5. Click **Verify & sign in**.
6. You land on the Super Admin dashboard.

> **Tip**
> The code changes every 30 seconds. If it is rejected, wait for the next code and try again.

> **Note**
> Clicking **Use a different account** returns you to the email and password step without closing the browser.

### 5.3 Forgot password

1. On the Sign in page, click **Forgot password?**.
2. In the **Reset your password** dialog, type the email address of your account.
3. Click **Send reset link**.
4. The message *"If an account exists for that email, a reset link is on its way."* appears. For security, the system shows the same message whether or not the address exists.
5. Open the email and click the reset link.
6. On the **Choose a new password** page, type your new password. It must be rated **Good** or higher.
7. Re-type it in **Confirm new password**.
8. Click **Update password**.
9. The message *"Your password has been updated. Please sign in."* appears and you are returned to the Sign in page.
10. Sign in with your new password.

> **Warning**
> A reset link that is opened after it expires shows *"This reset link is invalid or has expired."* Request a new one from the Sign in page.

### 5.4 Signing out

1. Click your **name or avatar** at the top-right corner of any dashboard.
2. In the menu, click **Sign out**.
3. You are returned to the Sign in page.

> **Tip**
> Always sign out on a shared or laboratory computer. Closing the browser tab alone may leave your session active.

### 5.5 Changing your password (while signed in)

1. Open your profile: top-right menu → **My Profile**.
2. Scroll to the **Account Security** card.
3. In **Current Password**, type the password you used to sign in.
4. In **New Password**, type the new password. The strength meter must read **Good**, **Strong**, or **Very strong**.
5. In **Confirm New Password**, type it again.
6. Click **Update Password**.
7. The fields clear, which confirms the change. Use the new password the next time you sign in.

> **Note**
> If the new password is rated below **Good**, or the two entries do not match, a red message explains the problem and nothing is changed.

### 5.6 Reading the dashboard layout

Every role shares the same layout:

| Area | Location | What it does |
|---|---|---|
| Sidebar | Left edge | Role-specific menu, grouped under headings (Overview, People, Curriculum, Operations, Administration for the Super Admin) |
| Menu toggle | Top-left | Opens or closes the sidebar; on small screens it opens the menu as an overlay |
| Page title | Top of the content area | Names the page you are on, with a short description and the main action button on the right |
| Notification bell | Top-right | Announcements you have not read yet; the red dot clears once they are marked read |
| User menu | Top-right | **My Profile** and **Sign out** |
| Toast messages | Bottom-right | Green = success, red = error, amber = warning, blue = information |

[Insert Screenshot: Dashboard Layout with callouts]
**Caption:** The shared layout used by all three roles.
**What to look for:** (1) the grouped sidebar; (2) the page title and description; (3) the primary action button on the right of the title; (4) the bell icon; (5) the user menu with **My Profile** and **Sign out**.

---

## 6. Super Admin User Manual

The Super Admin is the highest role in the system. Only the Super Admin can create trainer and trainee accounts, set up courses, approve enrollments, view institution-wide reports, and read trainee feedback about trainers.

> **Note**
> The system stores the Super Admin role internally as `admin`, but every screen labels it **Super Admin**. Treat the two names as identical.

### 6.1 Understanding the Super Admin workspace

After signing in you land on `/admin`. The sidebar contains five groups:

| Group | Menu item | Opens |
|---|---|---|
| Overview | **Dashboard** | Institution summary and recent activity |
| People | **Trainees** | Trainee directory, accounts, program assignments |
| People | **Trainers** | Trainer directory, accounts, program assignments |
| Curriculum | **Courses** | Training programs (courses) |
| Curriculum | **Competencies** | Competency structure per program (read-only) |
| Curriculum | **Lessons** | Lesson library across all programs (read-only) |
| Curriculum | **Quizzes** | Quiz bank across all programs (read-only) |
| Curriculum | **Exams** | Exam registry across all programs (read-only) |
| Operations | **Enrollment** | Review and process applications |
| Operations | **Schedules** | Class schedules for all programs |
| Operations | **Attendance** | Attendance monitoring across all programs |
| Operations | **Accounting** | Fees, payments, and balances |
| Administration | **Reports** | Analytics and CSV export |
| Administration | **Trainer Feedback** | Trainee feedback about trainers |
| Administration | **Announcements** | Post and manage announcements |
| Administration | **System Settings** | Institution details, thresholds, preferences, MFA |

> **Tip**
> The sidebar collapses on narrow screens. Use the menu icon at the top-left to open it.

### 6.2 The Dashboard

The dashboard is a read-only overview. Nothing on this page changes data.

**What you see**

1. **Four summary cards** at the top:
   - **Total Trainees** — number of trainee accounts.
   - **Total Trainers** — number of trainer accounts.
   - **Training Programs** — number of courses.
   - **Collections** — total amount collected from paying trainees.
2. **Enrollment by Program** — a bar chart comparing enrolled, completed, and pending counts per program.
3. **Enrollment Distribution** — a donut chart of enrollment statuses.
4. **Recent Enrollment Applications** — the newest applications, with status badges.
5. **System Health** — two progress bars: **Overall attendance** and **Fee collection rate**.
6. **Latest Announcements** — the most recent posts.

**Actions on this page**

1. Click **Review Enrollments** to jump to the Enrollment page.
2. Click **View Reports** to jump to Reports & Analytics.

[Insert Screenshot: Super Admin Dashboard]
**Caption:** Super Admin dashboard.
**What to look for:** (1) the four summary cards across the top; (2) the **Enrollment by Program** bar chart; (3) **System Health** with its two progress bars; (4) **Recent Enrollment Applications**; (5) the **Review Enrollments** and **View Reports** buttons in the page header.

---

### 6.3 Managing trainee accounts

Open **Trainees** in the sidebar.

**What the page shows**

- Three cards: **Total Trainees**, **With Active Enrollment**, **Avg Progress**.
- A searchable **Trainee Directory** table with columns: Trainee (name and email), Programs, Trainer, Progress, Attendance, Enrolled Since, and row actions.

#### 6.3.1 Creating a trainee account

1. Click **Add Trainee** (top-right).
2. In the **Add New Trainee** dialog, complete:

| Field | Required | Notes |
|---|---|---|
| **Full Name** | Yes | As it should appear on records |
| **Email Address** | Yes | Becomes the login name; the activation email is sent here |
| **Phone Number** | No | Must be exactly **11 digits** if entered |
| **Date of Birth** | No | Date picker |
| **Gender** | No | Male / Female |
| **Education** | No | Defaults to High School Graduate |
| **Address** | No | Free text |
| **Program Assignments** | No | Tick each program the trainee should take |

3. For every program you tick, choose a **trainer** in the drop-down beside it.
4. Click **Create Trainee**.
5. A **Trainee account created** dialog appears. Read the green or amber banner:
   - Green: *"An activation email has been sent. The trainee will create their OWN password from the link…"*
   - Amber: *"Account created, but the activation email could not be sent. Check the email/SMTP settings, then resend it below."*
6. If the email failed, click **Resend email**.
7. Click **Done**.

> **Warning**
> A program can only be assigned together with a trainer. If you tick a program that has no trainer assigned, the system stops you with *"Select a trainer for: [program]. Uncheck any course with no assigned trainer."* Assign a trainer to that course first (Section 6.4), or untick the course.

> **Note**
> There is no temporary password to give out. The trainee chooses their own password from the email link. Assigning programs also creates the trainee's enrollments, so the assigned programs immediately appear as their courses.

#### 6.3.2 Viewing a trainee's record

1. In the row, click the **eye** icon.
2. The detail dialog shows attendance rate, progress, number of programs, contact details, education, and the list of enrollments with their statuses.
3. Click **Close**.

#### 6.3.3 Editing a trainee

1. Click the **pencil** icon in the row.
2. Change any field, including program assignments and the trainer per program.
3. Click **Save Changes**.

> **Note**
> Editing reconciles the trainee's courses with the ticked programs. Unticking a program removes that course from the trainee's assignments; existing enrollment records are kept for audit.

#### 6.3.4 Deleting a trainee

1. Click the **trash** icon.
2. Read the confirmation: *"[Name] and their account will be permanently removed."*
3. Click **Delete** to confirm, or close the dialog to cancel.

> **Warning**
> Deleting an account cannot be undone. If a trainee has simply finished training, do not delete the account — their completion record and feedback history would be lost.

#### 6.3.5 Searching the directory

Type a name or email in the search box above the table. The table filters as you type. Use the column headers to sort, and the paging controls under the table to move between pages (10 rows per page).

[Insert Screenshot: Trainee Directory and Add Trainee dialog]
**Caption:** Trainee management.
**What to look for:** (1) the three summary cards; (2) the search box; (3) the eye, pencil, and trash icons at the end of each row; (4) the **Add Trainee** button; (5) inside the dialog, the **Program Assignments** section where each ticked program needs a trainer.

---

### 6.4 Managing trainer accounts

Open **Trainers** in the sidebar.

**What the page shows**

- Cards: **Total Trainers**, **Programs Assigned**, **Avg Rating** (with a hint showing how many trainers have been rated).
- A **Trainer Directory** table: Trainer (name, position, and an **Awaiting activation** badge when relevant), Assigned Programs, Trainees, Rating (stars and count), Since, and row actions.

#### 6.4.1 Creating a trainer account

1. Click **Add Trainer**.
2. Complete:

| Field | Required | Notes |
|---|---|---|
| **Full Name** | Yes | |
| **Email Address** | Yes | Login name; activation email is sent here |
| **Phone Number** | No | Exactly **11 digits** if entered |
| **Position** | No | For example `Trainer / Assessor` |
| **Specialization** | No | For example `Housekeeping NC II` |
| **Address** | No | |
| **Assigned Programs** | No | Tick every program this trainer will handle |

3. Click **Create Trainer**.
4. The **Trainer account created** dialog appears. If the banner is amber, click **Resend email**.
5. Click **Done**.

> **Note**
> A trainer's **Rating** is never typed in by an administrator. It is calculated automatically from the star ratings that trainees submit after completing a program.

#### 6.4.2 Handling "Awaiting activation"

A trainer who has not yet opened the invitation email shows an amber **Awaiting activation** badge.

1. Find the row with the badge.
2. Click the **envelope** icon at the end of the row. It only appears for accounts awaiting activation.
3. The message *"Activation email sent to [email]."* confirms the resend.

#### 6.4.3 Viewing, editing, and deleting a trainer

1. **View:** click the **eye** icon to see programs, trainee count, rating, contact details, specialization, and account status.
2. **Edit:** click the **pencil** icon, change details or tick/untick **Assigned Programs**, then click **Save Changes**.
3. **Delete:** click the **trash** icon, read the warning, and click **Delete**.

> **Warning**
> Unticking a program removes the trainer from that course. Trainees already assigned to that trainer keep their enrollment but lose their trainer link for that program until a new trainer is assigned.

#### 6.4.4 Assigning a trainer to a program

There are two equivalent routes:

- **From the trainer record:** **Trainers** → pencil icon → tick **Assigned Programs** → **Save Changes**.
- **From the course record:** **Courses** → open a course → **Edit** → change **Assigned Trainer** → **Save Changes**.

> **Tip**
> A program can have more than one qualified trainer. The trainer a trainee actually belongs to is chosen per trainee in **Trainees → Program Assignments**.

[Insert Screenshot: Trainer Directory]
**Caption:** Trainer management, including activation status.
**What to look for:** (1) the **Awaiting activation** badge under a trainer's name; (2) the envelope icon that resends the invitation; (3) the **Rating** column showing stars and the number of ratings; (4) the **Avg Rating** card.

---

### 6.5 Managing courses (training programs)

Open **Courses** in the sidebar. Cards show **Total Programs**, **Total Lessons**, **Total Enrollments**. Below them is the course list with search and filters.

#### 6.5.1 Creating a course

1. Click **Add Course**.
2. Complete the form:

| Field | Required | Notes |
|---|---|---|
| **Course Title** | Yes | For example `Bread and Pastry Production NC II` |
| **Course Code** | Yes | Short code, for example `BP-201` |
| **Category** | Yes | Free text, for example `Tourism & Hospitality` |
| **Level** | Yes | NC level or equivalent |
| **Training Fee (₱)** | Yes | Used by Accounting and self-pay enrollment |
| **Duration** | Yes | For example `3 months` |
| **Total Hours** | Yes | Numeric |
| **Assigned Trainer** | No | The trainer who owns the course |
| **Description** | No | Short text shown to trainees |

3. Click **Create Course**.
4. The new course appears in the list.

> **Note**
> A new course starts empty. Add lessons, quizzes, and exams afterwards from the Trainer account, or review what exists in the read-only Curriculum pages.

#### 6.5.2 Opening and editing a course

1. Click a course card or row.
2. The detail dialog shows the course banner (title, code, category, duration, hours), the overview text, and key values: **Trainer**, **Training Fee**, **Lessons**, **Quizzes**, plus the competency structure and admission requirements.
3. Click **Edit**, change the values, and click **Save Changes**.

#### 6.5.3 Deleting a course

1. Open the course.
2. Click **Delete** in the dialog header area.
3. Confirm with **Delete course**.

> **Warning**
> Deleting a course removes it from the catalogue. Trainees who were enrolled in it lose access to its lessons and assessments. Prefer leaving a finished course in place.

[Insert Screenshot: Courses list and Add Course form]
**Caption:** Course (training program) management.
**What to look for:** (1) the summary cards; (2) the **Add Course** button; (3) the field group that defines fee, duration, and hours; (4) the **Assigned Trainer** selector.

---

### 6.6 Reviewing competencies

Open **Competencies**.

- Cards: **Competency Groups**, **Total Lessons**, **Total Quizzes**.
- Each program is listed with its competency groups and the lessons and quizzes attached to each group.

> **Note**
> This page is **read-only** for the Super Admin. Competencies, lessons, quizzes, and exams are authored by trainers inside their assigned programs.

### 6.7 Reviewing lessons, quizzes, and exams

These three pages are institution-wide registries. They are **read-only**.

| Page | Cards | Table |
|---|---|---|
| **Lessons** | Total Lessons, Core Lessons, With Materials | Lesson Library — lesson, program, competency, materials, order |
| **Quizzes** | Total Quizzes, Total Attempts, Avg Score | Quiz Bank — quiz, program, questions, time limit, passing score, attempts |
| **Exams** | Total Exams, Attempts, Avg Score | Exam Registry — exam, program, questions, time limit, passing score, exam date |

1. Type in the search box to find a record by title or program.
2. Read the row. There are no edit or delete controls on these pages.

> **Note**
> If a lesson, quiz, or exam needs a change, ask the trainer assigned to that program. This separation is deliberate: the Super Admin oversees, the trainer authors.

---

### 6.8 Processing enrollment applications

Open **Enrollment**. Four cards summarise the pipeline: **Pending Review**, **Enrolled**, **Completed**, **Rejected / Cancelled**.

The page is divided into four tabs:

| Tab | Contains |
|---|---|
| **Pending Review** | Applications with status Pending or Under Review |
| **Enrolled** | Status Approved or Enrolled |
| **Completed** | Status Completed |
| **Rejected / Cancelled** | Status Rejected or Cancelled |

Each row shows the trainee, program, type (**Scholarship** or **Self-Pay**), payment status, applied date, status, and a **Review** button.

#### 6.8.1 Approving an application

1. Open the correct tab (usually **Pending Review**).
2. Find the application. Use **Search by trainee…** if the list is long.
3. Click **Review**.
4. Read the dialog: trainee, program, type, applied date, training fee, and — for scholarship applications — the voucher name, number, sponsor, and date; or — for self-pay applications — fee, amount paid, balance, reference number, and payment date.
5. Click **Approve**.
6. The status badge changes to **Approved** and the toast *"Status updated to…"* confirms the change.

> **Tip**
> Use **Mark Under Review** while you are still checking documents. This keeps the application out of the "new" pile without approving it.

#### 6.8.2 Rejecting or cancelling

1. Open the application.
2. For a new application, click **Reject**. For an approved or enrolled one, click **Cancel**.
3. Confirm in the dialog.

> **Warning**
> A rejected or cancelled application blocks the trainee's access to that course and stops further payments on it. Reject only after the trainee has been informed.

#### 6.8.3 Marking a program complete

Completion is normally automatic: when a trainee finishes every lesson and passes every quiz and exam, the system changes the enrollment to **Completed** on its own.

To complete an enrollment manually:

1. Open the application from the **Enrolled** tab.
2. Click **Mark Completed**.
3. Confirm the status badge changes to **Completed**.

> **Note**
> A program with no lessons can never auto-complete. If a course has no content yet, use **Mark Completed** deliberately, or add the content first.

#### 6.8.4 Recording a full payment from the enrollment record

1. Open a self-pay application with a remaining balance.
2. In the **Payment Details** block, click **Record Full Payment**.
3. The balance becomes zero and the payment status becomes **Fully Paid**.

#### 6.8.5 Changing status with the status chips

Inside the review dialog there is an **Update Status** row with every status: Pending, Under Review, Approved, Enrolled, Completed, Rejected, Cancelled.

1. Click the chip for the status you need.
2. The current status is highlighted, and the toast confirms the update.

[Insert Screenshot: Enrollment review dialog]
**Caption:** Reviewing an enrollment application.
**What to look for:** (1) the four tabs with counts; (2) the **Review** button at the end of each row; (3) the **Update Status** chips; (4) the **Approve**, **Mark Under Review**, and **Reject** buttons in the dialog footer; (5) the **Record Full Payment** button for self-pay applications.

---

### 6.9 Managing class schedules

Open **Schedules**. Cards show **Total Sessions**, **Upcoming**, **Online / Hybrid**. The **Class Schedule** table lists every session across all programs.

#### 6.9.1 Creating a schedule

1. Click **New Schedule**.
2. Complete:

| Field | Required | Notes |
|---|---|---|
| **Program** | Yes | Which course the session belongs to |
| **Lesson / Session** | Yes | The lesson or topic covered |
| **Trainer** | Yes | Who teaches it |
| **Room / Venue** | No | Room name or address |
| **Date** | Yes | |
| **Start Time** | Yes | |
| **End Time** | Yes | Must be after the start time |
| **Class Type** | Yes | Online, Face-to-Face, or Hybrid |
| **Google Meet Link** | For online classes | Paste the full meeting URL |

3. Save the schedule.
4. If any required field is empty, the message *"Please complete the required fields."* appears and nothing is saved.
5. If the end time is not after the start time, the dialog **Invalid schedule date/time** appears. Correct the times and save again.

#### 6.9.2 Editing, copying the link, and deleting

1. **Edit:** click **Edit** on the row, change values, save.
2. **Copy Meet link:** click **Copy Meet link**. The toast *"Meeting link copied."* confirms it is on your clipboard.
3. **Delete:** click **Delete**, read the confirmation, click **Delete** again.

> **Note**
> Trainers can also create schedules, but only for their own programs. Sessions created by a trainer appear in this table immediately.

---

### 6.10 Monitoring attendance

Open **Attendance**. This page is **read-only**.

- Cards: **Present**, **Late**, **Absent**, **Excused**.
- **Overall Attendance Rate** and **Attendance Rate by Program**.
- **Attendance Records** table with trainee, program, session date, status, time in, and time out.

1. Use the table search to find a trainee.
2. Read the rate per program to spot a program with low attendance.
3. If a record looks wrong, ask the trainer of that session to correct it in **Trainer → Attendance**.

---

### 6.11 Recording payments (Accounting)

Open **Accounting**.

- Cards: **Total Billed**, **Collected**, **Outstanding**, **Paying Trainees**.
- **Collections by Program** chart: billed versus collected versus balance.
- **Payment Records** table: trainee, program, fee, paid, balance, status, and a **Record Payment** button.

#### 6.11.1 Recording a payment

1. Find the trainee in **Payment Records**. Click **Record Payment**.
2. In the dialog, review **Training Fee**, **Amount Paid**, and **Balance**.
3. In **Amount to Pay (₱)**, type the amount received.
4. Click **Save Payment**.
5. The paid amount increases, the balance decreases, and the status is recalculated automatically:
   - balance is zero → **Fully Paid**
   - some amount paid → **Partially Paid**
   - nothing paid → **Unpaid**

> **Warning**
> If the amount is empty or zero, the message *"Enter a valid amount."* appears and nothing is saved. An amount larger than the balance is capped at the balance, so a record can never be overpaid.

> **Tip**
> For a payment that settles the whole balance at once, **Enrollment → Review → Record Full Payment** is faster.

---

### 6.12 Reports and analytics

Open **Reports**. This page combines every report in one place.

**Filters (top of the page)**

| Filter | Effect |
|---|---|
| **From date** | Start of the reporting period |
| **To date** | End of the reporting period |
| **Course** | Limit to one program |
| **Search** | Match a course or trainer name |
| **Export CSV** | Download the current report as a spreadsheet file |

**Summary cards:** Total Enrollments, Active Trainees, Attendance Rate, Total Revenue.

**Charts:** Enrollment by Course (approved, pending, completed) and Attendance Distribution.

**Report tables**

| Report | Contents |
|---|---|
| **Enrollment Report** | Total, Pending, Approved, Completed, Rejected |
| **Trainee Report** | Total Trainees, Active, Avg Progress |
| **Trainer Report** | Total Trainers, Assignments |
| **Attendance Report** | Present, Late, Absent, Excused, Rate |
| **Performance Report** | Quiz Average, Exam Average, Completion, Passed, Failed |
| **Accounting Report** | Paid, Partially Paid, Unpaid, Outstanding |

1. Set **From date** and **To date** to the period you need.
2. Optionally choose a **Course** or type in **Search**.
3. Read the cards and tables. They all reflect the same filters.
4. Click **Export CSV** to download `lms-report-YYYY-MM-DD.csv`. The toast *"Report exported as CSV."* confirms the download started.

> **Tip**
> Export before you change the filters. The file always contains exactly what is on screen at the moment you click.

[Insert Screenshot: Reports and Analytics]
**Caption:** Reports page with filters and the six report tables.
**What to look for:** (1) the filter bar including **From date**, **To date**, **Course**, and **Search**; (2) the four summary cards; (3) the **Export CSV** button; (4) the separate report sections, each with its own mini statistics.

---

### 6.13 Trainer feedback (read, correct, export)

Open **Trainer Feedback**. This is the only place in the system where the written feedback trainees give about trainers can be read.

> **Note**
> Trainers never see feedback about themselves — not the stars and not the text. Only the Super Admin can read it.

**Filters**

| Filter | Purpose |
|---|---|
| **Trainer** | Show feedback about one trainer |
| **Program** | Show feedback for one program |
| **Search** | Find words in the feedback text |
| **Submitted from** / **Submitted to** | Date range |
| **Apply filters** | Run the query |
| **Reset** | Clear every filter |

**The table** shows one row per submission with the trainee, trainer, program, date, and star rating. Pages hold 25 rows; use the paging controls to move on.

#### 6.13.1 Reading one submission

1. Click **View** on a row.
2. The **Feedback detail** dialog shows:
   - **Feedback** — the main written comment
   - **Learning experience**
   - **Trainer strengths**
   - **Areas for improvement**
   - **Recommendation**
   - the star rating, and a note if the record was ever corrected
3. Click **Close**.

#### 6.13.2 Correcting a submission

Use this only to fix a factual error (for example, a typo reported by the trainee). The original values are archived.

1. Click **View** on the row, then **Correct feedback**.
2. Edit the text fields. **Feedback** cannot be empty.
3. In **Reason for correction**, type why the change is being made. This field is required and is stored in the audit trail.
4. Click **Save correction**.
5. The message *"Correction saved. The original values were kept in the revision history."* confirms the change.

> **Warning**
> Do not rewrite a trainee's opinion. A correction must preserve meaning; the reason field exists so the change can be reviewed later.

#### 6.13.3 Exporting feedback to CSV

1. Apply the filters you need.
2. Click **Export CSV**.
3. The message *"Export started. The download was recorded in the audit log."* appears and the file downloads.

> **Note — two-factor authentication required**
> Exporting feedback and saving corrections are protected operations. If two-factor authentication is not active on your session, the page shows an MFA notice instead of the data. Sign in with your authenticator code (Section 5.2) and try again. Every export is recorded in the audit log.

[Insert Screenshot: Trainer Feedback page]
**Caption:** Super Admin view of trainee feedback.
**What to look for:** (1) the filter row; (2) the star rating column; (3) the **View** button; (4) the **Export CSV** button in the header; (5) the MFA notice that appears when a second factor is required.

---

### 6.14 Announcements

Open **Announcements**. As Super Admin you can post to everyone.

#### 6.14.1 Creating an announcement

1. Click **New Announcement**.
2. Complete:

| Field | Required | Notes |
|---|---|---|
| **Title** | Yes | |
| **Message** | Yes | The body of the announcement |
| **Audience** | Yes | **Everyone (trainers & trainees)**, **All trainees**, or **Specific trainers** |
| **Trainers** | When Audience is *Specific trainers* | Tick the trainers who should see it |
| **Program (optional)** | No | Limit to one program; leave **All programs** otherwise |
| **Priority** | Yes | High, Normal, or Low |
| **Pin this announcement to the top** | No | Keeps it above newer posts |

3. Save. If the title or message is empty, *"Title and body are required."* appears.

#### 6.14.2 Editing, pinning, and deleting

1. Use the row menu: **Edit**, **Pin** / **Unpin**, or **Delete**.
2. Deleting asks for confirmation with **Delete**.

> **Note**
> A program-specific announcement is only visible to the trainers assigned to that program and the trainees enrolled in it.

> **Tip**
> High-priority announcements are highlighted in red. Use them only for deadlines and urgent changes, otherwise people stop noticing them.

---

### 6.15 System settings

Open **System Settings**. Changes take effect only after you click **Save Settings**, which stays disabled until something is modified.

#### 6.15.1 Institution Information

| Field | Meaning |
|---|---|
| **Institution Name** | Shown on documents and reports |
| **Academic Year** | Current school year label |

#### 6.15.2 Assessment Thresholds

| Field | Default | Effect |
|---|---|---|
| **Default Passing Score (%)** | 75 | Applied to quizzes and exams that do not set their own passing score |
| **Typing Test Passing Rate (%)** | 40 | Passing mark for the typing test |
| **Attendance Requirement (%)** | 80 | Attendance target used in monitoring |

> **Warning**
> Changing the default passing score affects how new assessments are interpreted. Agree the value with your academic head before changing it, and tell trainers.

#### 6.15.3 System Preferences

| Toggle | Effect when on |
|---|---|
| **Allow online self-enrollment** | Trainees can submit enrollment applications themselves |
| **Email notifications** | The system sends email notifications for enrollment and assessment updates |
| **Maintenance mode** | Restricts access for maintenance |

> **Note — To Be Confirmed**
> The visible effect of **Maintenance mode** in the current build has not been verified end to end. Test it outside working hours before relying on it.

#### 6.15.4 System Information

A read-only count of records: Users, Trainees, Trainers, Programs, Enrollments, Attendance Records, Quiz Attempts, Typing Tests. Use it to confirm that data was created or removed as expected.

#### 6.15.5 Data Management

The **Reset All Data** button restores the original demonstration dataset and discards changes.

> **Warning**
> This button is intended for demonstration environments. On a live installation, do not use it without written approval and a verified backup. There is no undo.

[Insert Screenshot: System Settings]
**Caption:** System Settings page.
**What to look for:** (1) **Institution Information**; (2) the three threshold fields; (3) the preference toggles; (4) **System Information** counts; (5) **Data Management** with the red reset button; (6) the **Two-factor authentication** card.

---

### 6.16 Account security and two-factor authentication (MFA)

The **Two-factor authentication** card sits at the bottom of System Settings. It protects sensitive Super Admin actions — exporting feedback and saving feedback corrections — with a 6-digit code from an authenticator app.

#### 6.16.1 Turning MFA on for the first time

1. Open **System Settings** and scroll to **Two-factor authentication**.
2. Switch the toggle on.
3. A QR code dialog opens. Scan it with your authenticator app (Google Authenticator, Microsoft Authenticator, Authy, or similar).
4. Type the 6-digit code shown in the app into the dialog.
5. Confirm.
6. The message *"MFA enabled. You will be asked for a code on each sign-in."* appears.

#### 6.16.2 Turning MFA off

1. Switch the toggle off.
2. The system removes the authenticator factor and confirms *"MFA disabled."*

> **Warning**
> Turning MFA off removes the second factor from every sensitive action. Only do this if you have lost the authenticator and cannot recover it, and switch it back on immediately afterwards.

> **Tip**
> If the code is rejected, check that your phone's clock is set to automatic time. A clock that is a minute behind produces codes the server rejects.

---

### 6.17 Changing your own password

1. Top-right menu → **My Profile**.
2. In **Account Security**, enter **Current Password**, **New Password**, and **Confirm New Password**.
3. Click **Update Password**.
4. The fields clear on success.

If you have forgotten the password entirely, sign out and use **Forgot password?** on the sign-in page (Section 5.3).

---

### 6.18 Troubleshooting for Super Admins

| Problem | Likely cause | What to do |
|---|---|---|
| "Select a trainer for: …" when saving a trainee | A ticked program has no trainer assigned | Assign a trainer to that course in **Courses**, or untick the course |
| Trainer still shows **Awaiting activation** | Invitation email not opened | Click the envelope icon to resend; ask the trainer to check Spam |
| Activation email never arrives | Email settings or spam filtering | Check SMTP configuration, resend, and ask the recipient to whitelist the sender |
| Trainee cannot see a course | No enrollment, or the enrollment is Pending/Rejected | Open **Enrollment** and approve the application |
| A program never becomes **Completed** | The program has no lessons, so completion cannot be calculated | Add lessons and assessments, or use **Mark Completed** |
| Trainer Feedback page shows an MFA notice instead of data | Session is not at the second-factor level | Sign out and sign in with your authenticator code |
| CSV export downloads an empty file | Filters excluded every row | Reset the filters, confirm rows are visible, export again |
| Rating column shows "No ratings yet" for a trainer | No trainee has submitted feedback for a completed program | Expected — ratings appear only after completion and submission |
| Cannot delete a course | Course is referenced by enrollments | Remove or reassign enrollments first, or keep the course for the record |

---

## 7. Trainer User Manual

The Trainer role delivers the training. You can author content, schedule classes, record attendance, evaluate trainees, and watch progress — but only inside the programs assigned to you.

> **Note**
> What you can see is limited by assignment, not just by role. If a course is not in **My Courses**, it has not been assigned to you. Ask the Super Admin to assign it.

### 7.1 Understanding the Trainer workspace

After signing in you land on `/trainer`. The sidebar contains four groups:

| Group | Menu item | Opens |
|---|---|---|
| Overview | **Dashboard** | Your teaching summary |
| Teaching | **My Courses** | Programs assigned to you |
| Teaching | **My Trainees** | Trainees enrolled in your programs |
| Teaching | **Lessons** | Lesson authoring for your programs |
| Teaching | **Quizzes** | Quiz authoring and access requests |
| Teaching | **Exams** | Exam authoring |
| Operations | **Schedules** | Class schedules for your programs |
| Operations | **Attendance** | Attendance recording per session |
| Operations | **Student Evaluation** | Competency evaluation of trainees |
| Operations | **Typing Test Evaluation** | Typing test results and remarks |
| Operations | **Progress Monitoring** | Progress, grades, and at-risk trainees |
| Communication | **Announcements** | Post announcements |

### 7.2 The Dashboard

**What you see**

1. Four cards: **My Programs**, **My Trainees**, **Upcoming Classes**, **Avg. Trainee Progress**.
2. **Recent Submissions** — the latest assessment submissions from your trainees.
3. **Typing Test Results** — recent typing test scores (Virtual Assistant program).
4. **Evaluations** — evaluations you have recorded.
5. **Upcoming classes** — your next sessions, with a **Manage** link.

**Actions**

1. **Record Attendance** — opens Attendance with a session preselected.
2. **View Trainees** — opens My Trainees.

> **Note**
> If the dashboard shows **No assigned programs**, your account has no program assignments yet. Contact the Super Admin.

[Insert Screenshot: Trainer Dashboard]
**Caption:** Trainer dashboard.
**What to look for:** (1) the four summary cards; (2) **Recent Submissions**; (3) **Upcoming classes**; (4) the **Record Attendance** and **View Trainees** buttons.

---

### 7.3 Viewing assigned courses

Open **My Courses**.

1. Each card shows the course title, code, and counts for **Trainees**, **Lessons**, **Quizzes**, and **Exams**.
2. Click **Manage Course** to open the course.
3. The course page has tabs: **Overview**, **Lessons**, **Quizzes**, **Exams**, and a **Trainees** section, plus values for **Avg Progress**, **Duration**, **Training Hours**, **Category**, **Fee**, **Exam Date**, and **Total Enrolled**.
4. From the header, use **Manage lessons**, **Manage quizzes**, or **Manage exams** to jump straight to authoring.

> **Note**
> An empty program shows **No assigned courses** only when nothing is assigned to you. A course you own but have not filled yet still appears, with zero counts.

---

### 7.4 Viewing enrolled trainees

Open **My Trainees**.

- Cards: **Total Trainees**, **Average Progress**, **Average Attendance**.
- **Trainee List** with one row per trainee. Open a row to see tabs:
  - **Progress** — lessons completed and overall percentage
  - **Scores** — quiz and exam results
  - **Typing** — typing test results (Virtual Assistant program)
  - **Profile** — email, phone, address, education

> **Tip**
> Use this page before a parent or supervisor meeting: it combines progress, scores, and attendance for the same person.

---

### 7.5 Creating and managing lessons

Open **Lessons**. The page lists lessons for your programs only.

#### 7.5.1 Creating a lesson

1. Click **New Lesson**.
2. Complete:

| Field | Required | Notes |
|---|---|---|
| **Program** | Yes | Only your assigned programs are listed |
| **Competency** | Yes | The competency this lesson belongs to |
| **Unit** | No | Sub-grouping inside the competency |
| **Lesson Title** | Yes | For example `Introduction to the Profession` |
| **Short Description** | No | One line shown on lesson cards |
| **Lesson Content** | Yes | Full notes, shown to trainees on the lesson page |
| **Duration (minutes)** | No | Estimated study time. Maximum **300** minutes (5 hours); the form rejects anything longer |
| **Lesson Order** | No | Controls the sequence in the course |
| **Video Link** | No | Full URL to a video |
| **Learning Materials** | No | Files or links (see below) |
| **Published (visible to enrolled trainees)** | — | Off by default; trainees cannot see an unpublished lesson |

3. Click **Save Lesson**. If the title is empty, *"Lesson title is required."* appears.

#### 7.5.2 Adding learning materials

1. In the **Learning Materials** section, click **Add material**.
2. For each material:
   - Type a **name** (this is what trainees see).
   - Either click **Choose file** to upload a document, or paste a link in the URL field.
   - Choose the type (PDF, document, image, video, link).
3. Add as many materials as the lesson needs.
4. Remove one with the **Remove material** (trash) button beside it.

> **Tip**
> Upload only small files. For large videos or manuals, host the file in your institution's shared drive and paste the link instead — links keep the lesson light and load faster for trainees.

#### 7.5.3 Editing and deleting a lesson

1. Click the lesson row to edit it, change the fields, and click **Save Lesson**.
2. To delete, use **Delete lesson** and confirm with **Delete**.

> **Warning**
> Deleting a lesson removes it from the trainee's course and can lower their completion percentage. Unpublish it instead if you only want to hide it temporarily.

[Insert Screenshot: Lesson editor with Learning Materials]
**Caption:** Authoring a lesson.
**What to look for:** (1) the **Program** and **Competency** selectors; (2) the **Lesson Content** editor; (3) **Learning Materials** with **Add material**; (4) the **Published** toggle; (5) **Save Lesson**.

---

### 7.6 Creating and managing quizzes

Open **Quizzes**.

- Cards: **Total Quizzes**, **Total Attempts**, **Average Score**.
- A **Quiz Access Requests** panel appears when trainees are waiting for approval.
- The quiz table lists each quiz with program, questions, time limit, passing score, and attempts.

#### 7.6.1 Creating a quiz

1. Click **New Quiz**.
2. Complete:

| Field | Required | Notes |
|---|---|---|
| **Program** | Yes | Your assigned programs only |
| **Quiz Title** | Yes | For example `Module 1 Assessment` |
| **Lesson** | No | Attach the quiz to one of your lessons. The trainee then sees the quiz state ("Quiz not taken", "Take Quiz", "Passed") on that lesson row. Leave it empty for a standalone quiz |
| **Passing Score (%)** | Yes | Defaults to the institution threshold (75) |
| **Start Date** / **Start Time** | Yes | When the quiz opens |
| **Deadline Date** / **Deadline Time** | Yes | When it closes |
| **Questions** | Yes | At least one question |
| **Published (visible to enrolled trainees)** | — | Trainees cannot take an unpublished quiz |

3. Build the questions:
   - Choose the question type (multiple choice, true/false, or identification).
   - Type the question text.
   - Add the answer options and mark the correct one.
   - Set the points if the builder asks for them.
   - Repeat with **Add question**.
4. Click **Save Quiz**.

**Validation messages**

- *"Quiz title is required."* — the title is blank.
- *"Add at least one question."* — the question list is empty.
- **Invalid schedule** — the start is in the past, the deadline is in the past, or the deadline is not after the start. Correct the dates and times.

> **Warning**
> A quiz with **no schedule at all** cannot be started by anyone. Always set both the start and the deadline.

> **Note**
> The time limit is per attempt. If you leave it empty, the attempt uses the standard quiz clock of 30 minutes.

#### 7.6.2 Editing and deleting a quiz

1. Open the quiz from the table, change fields or questions, and click **Save Quiz**.
2. Use **Delete quiz** and confirm with **Delete**.

> **Warning**
> Deleting a quiz deletes its questions. Existing attempt records stay in the grade history but no longer have a quiz to open.

---

### 7.7 Creating and managing exams

Open **Exams**. The form mirrors quizzes, with two differences: an exam belongs to a **Competency**, and it carries its own **Exam Title**.

1. Click **New Exam**.
2. Complete **Program**, **Competency**, **Exam Title**, **Passing Score (%)**, **Status**, **Start Date/Time**, **Deadline Date/Time**, **Questions**, and **Published**.
3. Build the questions the same way as for a quiz.
4. Click **Save Exam**.

**Validation messages**

- *"Exam title is required."*
- *"Passing score must be between 1 and 100."*
- *"Add at least one question."*
- **Incomplete question** — an exam cannot be saved while any question is unfinished:
  - *"Question N needs a question."*
  - *"Question N needs at least two answer options."* (multiple choice)
  - *"Question N needs a correct answer."* / *"…that matches one of its options."*
  - *"Question N needs True or False marked as the answer."*
  - *"Question N needs the correct identification answer."*
- **Invalid schedule** — same rules as quizzes.

> **Note**
> All of these checks run before the exam is written, so a half-built exam is never saved and never reaches a trainee.

> **Note**
> The exam attempt clock is 60 minutes unless a time limit is set on the exam.

> **Tip**
> Publish an exam only when you are ready for trainees to see it. Publishing is what makes it appear on the trainee's Exams tab.

---

### 7.8 Handling quiz access requests

Trainees get **one attempt** per quiz. If they miss the deadline, or need another try, they send a request that only you can approve.

**Where requests appear**

- **Quizzes** page → **Quiz Access Requests** panel.
- Inside a quiz → the **Access Requests** section, with a count.

**Each request shows:** the trainee's name, the type (**Late access** or **Retake**), and the date requested.

**To decide a request**

1. Read the request.
2. Click the green check (**Approve**) to grant one additional attempt, or the red cross (**Reject**).
3. The request moves to the decided list with an **Approved** or **Rejected** badge.

**What the trainee sees**

- While pending: *"Your late access request is waiting for trainer approval."*
- When approved: the quiz unlocks with a **Start Approved Attempt** button.
- When rejected: a notice that the request was rejected.

> **Tip**
> Approve late access only for a genuine reason (illness, connection outage). The request record keeps the decision visible to the Super Admin.

[Insert Screenshot: Quiz Access Requests]
**Caption:** Approving a retake or late-access request.
**What to look for:** (1) the request type (**Late quiz access** or **Retake request**); (2) the trainee name and request date; (3) the approve and reject icons; (4) the decided list with status badges.

---

### 7.9 Managing class schedules

Open **Schedules**. You can only schedule sessions for your own programs.

#### 7.9.1 Creating a session

1. Click **New Schedule**.
2. Complete **Program**, **Lesson / Session**, **Date**, **Start Time**, **End Time**, **Class Type** (Online, Face-to-Face, Hybrid), **Room / Venue**, and **Google Meet Link** for online classes.
3. Save.
4. *"Please complete the required fields."* means a required field is empty; **Invalid schedule date/time** means the end time is not after the start.

#### 7.9.2 Session actions

| Action | Result |
|---|---|
| **Take attendance** | Opens Attendance with this session selected |
| **Edit** | Reopens the session form |
| **Copy Meet link** | Copies the meeting URL; *"Meeting link copied."* confirms |
| **Delete** | Asks for confirmation, then removes the session |

---

### 7.10 Recording attendance

Open **Attendance**.

> **Note**
> Only sessions that have **already started** can be recorded. Future sessions do not appear in the session selector, and the page shows **No sessions to record** until a class begins.

**Steps**

1. In the session selector, choose the class session. Sessions are grouped by program.
2. The list shows every trainee enrolled in that program.
3. For each trainee, choose one status:

| Status | Meaning | Time fields |
|---|---|---|
| **Present** | Attended the whole session | Filled automatically from the schedule (start to end) |
| **Late** | Arrived after the start | Type the actual time in and time out |
| **Absent** | Did not attend | None |
| **Excused** | Absent with a valid reason | None |

4. For **Late**, the time in cannot be earlier than the session start, and the time out cannot be later than the session end. The system adjusts out-of-range entries automatically.
5. Use **Mark all present** to set everyone to Present, then change the exceptions.
6. Click **Save Attendance**.

**Validation**

- If any trainee is left unmarked, the message *"Please mark every trainee before saving."* appears and nothing is saved.
- If no trainees are enrolled, the page shows **No trainees enrolled in this program**.

> **Tip**
> Record attendance during or immediately after the class. Late entries are easy to forget, and attendance feeds the trainee's attendance rate and the institution's reports.

[Insert Screenshot: Attendance recording]
**Caption:** Recording attendance for a session.
**What to look for:** (1) the session selector; (2) the four status buttons per trainee; (3) the time-in and time-out fields that appear for Late; (4) **Mark all present**; (5) **Save Attendance**.

---

### 7.11 Evaluating trainee performance

Open **Student Evaluation**.

- Cards: **Evaluations**, **Average Rating**, **Trainees Evaluated**.
- The table lists each evaluation with trainee, program, period, overall rating, and remarks.

**Creating an evaluation**

1. Click **New Evaluation**.
2. Choose the **Trainee**. If none is chosen, *"Please select a trainee."* appears.
3. Choose the **Program**.
4. Type the **Evaluation Period**, for example `Mid-Term Evaluation` or `Final Evaluation`.
5. Rate each criterion from 1 to 5 stars:
   - **Work Attitude**
   - **Attendance & Punctuality**
   - **Skills & Competence**
   - **Safety Practices**
   - **Teamwork & Communication**
6. Check **Overall Rating** — it is the average of the five, shown out of 5.0.
7. Add **Remarks / Comments**.
8. Click **Submit Evaluation**.

Each **Evaluation Period** is stored as its own record, so a trainee can have a Mid-Term and a Final evaluation side by side. Editing an existing row updates that record only.

> **Note**
> Evaluations are private to the trainer who wrote them. You see only your own evaluations, and no other trainer can open or edit them.

> **Tip**
> Write remarks that a trainee can act on. "Improve speed on pastry shaping" is useful; "needs improvement" is not.

---

### 7.12 Reviewing typing test results

Open **Typing Test Evaluation**. This page covers the typing test used by the Virtual Assistant program.

- Cards: **Tests Taken**, **Pass Rate**, **Average WPM**, **Average Accuracy**.
- **Typing Test Scores** table: trainee, words per minute, accuracy, errors, total words, correct words, incorrect words, test duration, date, and result.

**Adding remarks**

1. Find the trainee's row and click **Evaluate**.
2. Review the scores: words per minute, accuracy, errors, total/correct/incorrect words, test duration, date, and result.
3. Type in **Trainer Remarks**.
4. Click **Save Remarks**. The remarks are stored on that result — no new row is created.

> **Note**
> The passing mark is **40%**. Trainees below it appear as failed in the results column and in their Grades page.

> **Note**
> You only see typing results that belong to you — that is, results of trainees whose enrollment is assigned to you. Another trainer's results are not listed and cannot be edited.

---

### 7.13 Monitoring trainee progress

Open **Progress Monitoring**.

- Cards: **Trainees**, **Avg Progress**, **At Risk**, **Avg Grade**.
- **Performance Comparison** chart: progress, grade, and attendance per trainee.
- **Trainee Progress** table with each trainee's progress bar, grade, and attendance.

1. Sort by progress or attendance to find the lowest rows.
2. Treat **At Risk** as your follow-up list: these trainees are behind on progress or attendance.
3. Contact the trainee, or raise the case with the Super Admin.

[Insert Screenshot: Progress Monitoring]
**Caption:** Progress monitoring for a trainer's programs.
**What to look for:** (1) the four cards, especially **At Risk**; (2) the comparison chart; (3) the per-trainee progress bars.

---

### 7.14 Posting announcements

Open **Announcements**. Trainers can create announcements for their own students only.

1. Click **New Announcement**.
2. Complete **Title**, **Message**, **Program** (one of your programs, or **All my programs**), **Priority**, and optionally **Pin this announcement to the top**. The audience is fixed to **My trainees (own programs)**.
3. Save.
4. Use the row menu to **Edit**, **Pin**/**Unpin**, or **Delete**.

> **Note**
> A trainer announcement is private to that trainer's students. Other trainers never see it — not even trainers of the same program — and trainees outside the selected program never see it either.

> **Tip**
> Choose the specific **Program** when the announcement only affects one class. It keeps other trainees from being notified about something irrelevant to them.

---

### 7.15 Updating your profile and password

1. Top-right menu → **My Profile**.
2. Edit **Full Name**, **Email Address**, **Phone Number**, and **Address**. **Position** and **Specialization** are managed by the Super Admin and appear read-only.
3. Click **Save Changes**.
4. Your **Assigned Programs** and your trainee rating summary are shown on the same page.
5. To change your password, use **Account Security** at the bottom: **Current Password**, **New Password**, **Confirm New Password**, then **Update Password**.

> **Note**
> You can see the average star rating trainees gave you, but **not** the written feedback or individual ratings. Feedback is visible only to the Super Admin.

---

### 7.16 Troubleshooting for Trainers

| Problem | Likely cause | What to do |
|---|---|---|
| A course is missing from **My Courses** | Not assigned to you | Ask the Super Admin to assign the program |
| Trainees cannot see a lesson | **Published** is off | Edit the lesson and switch **Published** on |
| Trainees cannot start a quiz or exam | No schedule set, or it is outside the window | Edit the assessment and set a valid start and deadline |
| "Invalid schedule" when saving | Start in the past, deadline in the past, or deadline before start | Correct the dates and times |
| "Please mark every trainee before saving" | A trainee has no status | Mark the remaining trainees, or use **Mark all present** |
| "No sessions to record" | No session has started yet | Wait for the class start time, or check the schedule date |
| A trainee says they already submitted | One attempt per quiz is enforced | Check **Quiz Access Requests**; approve a retake if justified |
| Evaluation will not save | No trainee selected | Choose a trainee in the **Trainee** field |
| Typing test page is empty | No Virtual Assistant trainee has taken the test | Expected; results appear after the first attempt |
| Cannot open another trainer's program | Assignment-based access | Ask the Super Admin for an assignment if you should have access |

---

## 8. Trainee User Manual

The Trainee role is where learning happens. You enroll, study, take assessments, and track your own progress.

### 8.1 Understanding the Trainee workspace

After signing in you land on `/trainee`. The sidebar contains two groups:

| Group | Menu item | Opens |
|---|---|---|
| Overview | **Dashboard** | Your learning summary |
| Learning | **My Courses** | Programs you are enrolled in |
| Learning | **Class Schedules** | Your sessions, with join links |
| Learning | **Attendance** | Your attendance record |
| Learning | **Grades & Scores** | Quiz, exam, and typing results |
| Learning | **Typing Test** | Typing test (Virtual Assistant program) |
| Learning | **Trainer Feedback** | Feedback form for completed programs |
| Account | **Enrollment** | Apply for a program, track applications |
| Account | **My Payments** | Fees, balances, and payment history |
| Account | **Announcements** | Notices from your trainer and the institution |
| Account | **Profile** | Personal details and password |

> **Note**
> You only see courses you are enrolled in. If a program is missing from **My Courses**, your application is probably still Pending, or it was rejected — check **Enrollment**.

### 8.2 The Dashboard

**What you see**

1. Cards: **My Course**, **Attendance**, **Lessons Completed**, **Enrollments**.
2. **Next Class** — the next session, with **Join next class** (or **Join Class** on the day).
3. **Upcoming Quiz** — the next quiz to take, with **Go to course**. When everything is done, it shows **All quizzes completed**.
4. **Latest Scores** — your most recent results.
5. **My Enrollments** — each program with its status and progress.
6. **Quiz Access Requests** — pending or decided requests.
7. **Announcements** — the newest posts.
8. **Pay Now** — appears when a payment is due.

**Actions**

1. **My Courses** — opens your course list.
2. **Join next class** — opens the meeting link for the next online session.
3. **Go to course** — opens the course containing the upcoming quiz.
4. **View all grades** — opens Grades & Scores.
5. **Pay Now** — opens the payment form.

[Insert Screenshot: Trainee Dashboard]
**Caption:** Trainee dashboard.
**What to look for:** (1) the four cards; (2) **Next Class** with its join button; (3) **Upcoming Quiz**; (4) **Latest Scores**; (5) **My Enrollments** with progress bars; (6) the **Pay Now** button when a balance exists.

---

### 8.3 Viewing your courses

Open **My Courses**.

1. Use the tabs to filter: **In Progress**, **Pending**, **Completed**.
2. Type in **Search course…** to find a program quickly.
3. Click a course card to open it.
4. Inside the course, use the tabs:
   - **Overview** — description, duration, training hours, level, start and end dates, trainer
   - **Competencies** — the competency structure and its lessons
   - **Quizzes** — every quiz with its status (**Not taken**, **Passed**, **Failed**, **Pending approval**, **In progress**)
   - **Exams** — every exam with its status and a **Take Exam** button when open

> **Note**
> If you open a course you are not enrolled in, the page shows **You are not enrolled in this program** with a **Browse programs** button.

---

### 8.4 Enrolling in a program

Open **Enrollment**.

**Part 1 — your applications**

The **My Applications** list shows each application with the program, type (**Scholarship / Voucher** or **Self-Pay**), applied date, status, and — for self-pay — a **Pay Now** button when a balance remains.

**Part 2 — applying for a new program**

1. Click **Enroll in another program** (or **Browse programs** if the list is empty).
2. In **Program Details**, read **Duration**, **Training Hours**, **Level**, **Category**, **Training Fee**, **Admission Requirements**, and **Competency Structure**.
3. Click **Continue**.
4. Under **Choose Enrollment Type**, select one:
   - **Scholarship / Voucher** — funded by TESDA or a sponsor. No payment is required.
   - **Self-Pay / Paying Trainee** — you pay the training fee shown.
5. Click **Continue**.
6. Complete the form for your chosen type.

**For Scholarship / Voucher**

| Field | Required |
|---|---|
| **Voucher / Scholarship Name** | Yes |
| **Voucher Number** | Yes |
| **Sponsor** | Yes |
| **Training Program** | Pre-filled |
| **Date** | Yes |
| **Full Name** | Yes |
| **Email** | Yes |
| **Contact Number** | Yes |
| **Date of Birth** | Yes |
| **Educational Background** | Yes |
| **Emergency Contact** | Yes |
| **Preferred Schedule** | No |
| **Address** | Yes |

**For Self-Pay**

| Field | Required |
|---|---|
| **Course** | Pre-filled |
| **Training Fee** | Pre-filled, read-only |
| **Amount Paid (₱)** | Yes |
| **Payment Date** | Yes |
| **Reference Number** | Yes |
| **Full Name**, **Email**, **Contact Number**, **Date of Birth**, **Educational Background**, **Emergency Contact**, **Preferred Schedule**, **Address** | Yes, except Preferred Schedule |

7. Click **Submit Enrollment**.
8. Your application appears in **My Applications** with status **Pending**.

> **Note**
> An application is not an enrollment. You get access to the course only after the Super Admin approves it. Until then the course shows as **Pending**.

> **Tip**
> Keep the voucher number and reference number exactly as printed. The reviewer matches them against the sponsor's or bank's record.

---

### 8.5 Studying a lesson and downloading materials

1. Open **My Courses** → your course → **Competencies** or **Overview**.
2. Click a lesson to open it. The **Course Lessons** list stays on the side so you can move between lessons.
3. Read **Lesson Content**. If the lesson has a video, it appears above the content.
4. In **Learning Materials**, each item shows a name and a download icon. Click it to open or download the file.
5. When you finish, click **Mark as Complete**.
6. The toast *"Lesson marked as complete!"* confirms it, and your progress increases.
7. Click **Mark as Incomplete** to undo the mark.

> **Note**
> Marking lessons complete is what moves your progress bar. Reading without marking keeps your progress unchanged, and the program cannot reach **Completed** status.

[Insert Screenshot: Lesson page]
**Caption:** A lesson with content and materials.
**What to look for:** (1) the **Course Lessons** list on the side; (2) the video area; (3) the **Learning Materials** list with download icons; (4) the **Mark as Complete** button; (5) the lesson quiz section when the lesson has one.

---

### 8.6 Taking a quiz

1. Open the course and go to the **Quizzes** tab.
2. Find the quiz. The card shows its status and schedule.
3. Click **Start Quiz** (or **Take Quiz** / **Resume Quiz** if you already started).
4. Read the quiz header: **Questions**, **Time limit**, and **Passing score**.
5. Answer each question. Use the question navigation to move between items.
6. Click **Submit** when you are done, and confirm.

**Rules you should know**

- **One attempt per quiz.** After you submit, the quiz shows **Done** and cannot be retaken without your trainer's approval.
- The quiz can only be started inside its **start** and **deadline** window. If the trainer has not scheduled it, the card shows **Not scheduled**.
- The countdown is **30 minutes** unless the trainer set a different time limit. The timer is checked against the server, so changing your device clock does not add time.
- If you close the page mid-attempt, the clock keeps running. Reopen the quiz and click **Resume Quiz** — you continue with the time that is left.
- If the time runs out, the attempt is forfeited. You can request a retake.
- After submitting, the result panel is marked **Verified by the server** and shows your correct answers, score, percentage, and incorrect answers.

> **Warning**
> Do not open the quiz in two tabs. Only one attempt session exists per quiz, and the newest tab wins.

[Insert Screenshot: Quiz runner with countdown]
**Caption:** Taking a quiz.
**What to look for:** (1) the quiz title and instructions; (2) **Questions**, **Time limit**, and **Passing score**; (3) the countdown and the **Server deadline** label; (4) the question navigation; (5) the **Submit** button.

---

### 8.7 Taking an exam

1. Open the course and go to the **Exams** tab.
2. Find the exam. The card shows **Exam Date**, passing score, and whether you have taken it.
3. Click **Take Exam**.
4. Answer all questions, then submit and confirm.
5. The result panel marked **Verified by the server** shows correct answers, score, percentage, and incorrect answers.

**Rules you should know**

- The exam must be open: before **Start Date/Time** it shows **This exam is not open yet**; after the **Deadline** it shows **The exam deadline has passed**.
- An exam with no schedule shows **Your trainer has not scheduled this exam yet**.
- The exam clock is **60 minutes** unless the trainer set a time limit.
- Every attempt is recorded. Your Grades page shows each attempt with its date, score, and pass/fail result.

> **Note**
> If the result cannot be saved because of a connection problem, the page offers **Retry save**. Use it before leaving the page, otherwise the attempt may not appear in your grades.

[Insert Screenshot: Exam result panel]
**Caption:** Exam result after submission.
**What to look for:** (1) the **Verified by the server** badge; (2) correct answers and total questions; (3) percentage and incorrect count; (4) **Back to course**.

---

### 8.8 Requesting late access or a retake

If you missed the deadline or used your attempt, you can ask your trainer for another chance.

1. Open the quiz from the **Quizzes** tab.
2. Read the reason shown on the card:
   - *"You have already taken this quiz. Request a retake from your trainer."*
   - *"Your attempt time is up. Request a retake from your trainer."*
   - Late access is offered when the deadline has passed and you never attempted the quiz.
3. Click **Request Retake** (or the late-access request button).
4. The card changes to **Retake request pending** or **Waiting for trainer approval**.
5. When your trainer decides, the card updates:
   - Approved → **Start Approved Attempt** becomes available.
   - Rejected → a notice explains that the request was rejected.

> **Tip**
> Request once, then wait. Sending several requests does not speed up approval and makes the queue harder for your trainer.

---

### 8.9 Viewing class schedules

Open **Class Schedules**.

1. Use the tabs: **Ongoing**, **Upcoming**, **Past Sessions**.
2. Each session shows the lesson or topic, date, start and end time, class type, room or venue, and trainer.
3. For an online session, click the meeting button to join. The dashboard also shows **Join next class** for the next session.

> **Note**
> Classes appear here only after your trainer or the Super Admin schedules them. If the list is empty, no session has been created yet.

---

### 8.10 Viewing your attendance

Open **Attendance**.

- Cards: **Present**, **Late**, **Absent**, **Excused**.
- **Attendance Rate** as a percentage.
- **Attendance Records** table: date, program, session, status, time in, time out.

1. Check the rate against the institution's requirement (default 80%).
2. If a record is wrong, tell your trainer — only the trainer can correct it.

---

### 8.11 Viewing grades and results

Open **Grades & Scores**.

- **Overall Grade** — the average of all your assessments, shown as a percentage. Green means 75% or above; amber means below.
- **Quizzes Taken** and **Exams Taken** — counts.
- **Performance Overview** — a chart of your results.
- **Quiz Results** — each quiz attempt with date, score, percentage, and pass/fail.
- **Exam Results** — each exam attempt with the same details.
- **Typing Test Results** — WPM, accuracy, errors, and pass/fail (passing is 40%).

> **Tip**
> If a result is missing, open the assessment again and use **Retry save** — an attempt that never reached the server cannot appear in your grades.

---

### 8.12 Taking the typing test

Open **Typing Test**.

> **Note**
> The typing test is exclusive to the **Virtual Assistant** program. If you are not enrolled in it, the page tells you so.

1. Read **Passing Requirement** (40%), **Best Score**, **Best WPM**, and **Attempts**.
2. Click the passage area to focus it.
3. Start typing. The timer starts with your first keystroke. *"Start typing to begin the test."* reminds you if you have not begun.
4. Type the passage as accurately and quickly as you can.
5. Click **Submit Test** when you finish (or when the time is up).
6. The result shows **Time**, **WPM**, **Accuracy**, **Errors**, **Score**, **Total Words**, **Correct Words**, **Incorrect Words**, and **Duration**.
7. Click **Take Another Test** to try again. Every attempt is listed in **My Typing Test History**.

> **Tip**
> Accuracy counts more than raw speed. Slow down slightly and your score usually improves.

---

### 8.13 Submitting trainer feedback

Open **Trainer Feedback**. This is where you rate the trainer of a program you have completed.

**When the form appears**

Feedback opens **only after a program is completed**. Programs still in progress show **Not yet available**. A completed program shows **Awaiting your feedback**.

**Submitting**

1. Find the program marked **Awaiting your feedback**.
2. Under **Your rating**, choose **1 to 5 stars**. This is required — the system stops with *"Please choose a star rating first."* if you skip it.
3. In **Your feedback**, write your main comment. This is required — *"Please write your feedback before submitting."*
4. Optionally complete:
   - **Learning experience** — what you learned and how the pace suited you
   - **Trainer strengths** — what your trainer did well
   - **Areas for improvement** — what could be better
   - **Recommendation** — whether you would recommend the trainer or program
5. Click **Submit feedback**.
6. The toast *"Thank you — your feedback was submitted."* confirms it.

**After submitting**

- The program moves to **Submitted**, showing your stars and the date.
- Click it to read **Your submitted feedback** in a read-only view.
- The form cannot be submitted again. You rate each trainer once, together with your written feedback.

> **Warning**
> Feedback is permanent once submitted. Check your stars and text before clicking **Submit feedback**. If something is factually wrong afterwards, contact the Super Admin — only they can correct a record, and the correction is logged.

> **Note**
> Your trainer cannot see your feedback — not the stars and not the text. Only the Super Admin can read it.

[Insert Screenshot: Trainer Feedback form]
**Caption:** Trainee feedback form for a completed program.
**What to look for:** (1) the **Awaiting your feedback** and **Submitted** counters; (2) the star selector marked with a red asterisk; (3) **Your feedback**; (4) the four optional sections; (5) **Submit feedback**.

---

### 8.14 Making a payment

Open **My Payments**.

- Cards: **Total Billed**, **Total Paid**, **Outstanding Balance**, **Pending Payments**.
- **My Payments** table: program, fee, paid, balance, status, and payment history with method, reference number, and date.

**Steps**

1. Find the program with a balance. Click **Pay Now** (also available on the dashboard and in **Enrollment**).
2. In the **Make a Payment** dialog, review the fee and balance.
3. In **Amount to Pay (₱)**, type the amount you are paying.
4. Choose the **Payment Method**: GCash, Maya, Bank Transfer, or Over-the-Counter.
5. Type the **Reference Number** from your receipt or transaction confirmation.
6. Set the **Payment Date**.
7. Check the preview: the new balance and the new status (**Unpaid**, **Partially Paid**, or **Fully Paid**).
8. Click **Pay Now** to confirm.
9. The payment appears in your history and the balance updates.

> **Warning**
> Type the reference number exactly. The institution matches it against the actual transaction; a wrong reference can delay confirmation of your payment.

> **Note**
> Payments can only be made on programs with a balance that are not **Cancelled** or **Rejected**. Scholarship enrollments show **Funded** and need no payment.

---

### 8.15 Reading announcements

Open **Announcements**.

1. Use the priority filter: **All priorities**, **High priority**, **Normal**, **Low**.
2. Read the cards. Pinned announcements appear at the top with a pin badge; unread ones are tinted and carry an **Unread** badge.
3. Click **Mark as read** on a card, or **Mark all as read** at the top, to clear the red dot on the notification bell.
4. High-priority posts are highlighted in red — read those first.

---

### 8.16 Updating your profile and password

1. Top-right menu → **My Profile**.
2. Edit **Full Name**, **Email Address**, **Phone Number**, **Date of Birth**, **Gender**, **Educational Attainment**, and **Address**.
3. Click **Save Changes**.
4. **My Enrolled Programs** on the same page shows each active program with its progress.
5. To change your password, scroll to **Account Security**: **Current Password**, **New Password**, **Confirm New Password**, then **Update Password**.

> **Note**
> Your password must be rated **Good** or higher. The strength meter updates as you type.

---

### 8.17 Troubleshooting for Trainees

| Problem | Likely cause | What to do |
|---|---|---|
| A program is missing from **My Courses** | Application pending or rejected | Open **Enrollment** and check the status; ask the Super Admin if it should have been approved |
| "You are not enrolled in this program" | Opened a course you are not enrolled in | Return to **My Courses** and open one of your own courses |
| A quiz shows **Not scheduled** | The trainer has not set a start and deadline | Wait for your trainer to schedule it |
| "This quiz is not open yet" | The start date and time have not arrived | Check the schedule on the quiz card and return later |
| "You have already taken this quiz" | One attempt per quiz | Use **Request Retake** |
| The countdown jumps or ends early | The timer follows the server clock | Do not change your device time; if it ends early, request a retake |
| **Retry save** appears after submitting | The result could not reach the server | Click **Retry save** before leaving the page |
| A lesson will not increase progress | Not marked complete | Open the lesson and click **Mark as Complete** |
| Typing test page says it is exclusive to Virtual Assistant | You are not in that program | Expected; the test is only for Virtual Assistant trainees |
| **Trainer Feedback** shows **Not yet available** | The program is not completed | Finish all lessons and pass the assessments; feedback opens automatically |
| "Please choose a star rating first" | Stars not selected | Choose 1–5 stars before submitting |
| Payment does not appear | Reference not yet matched, or the page was closed early | Check **My Payments**; contact the Super Admin with your reference number |

---

## 9. Role-Based Permissions and Access Comparison

### 9.1 Master permissions table

**Legend:** ✓ = available · — = not available · **Assigned** = only for programs assigned to the trainer · **Own** = only the user's own records

| Feature / Screen | Super Admin | Trainer | Trainee |
|---|---|---|---|
| Sign in and sign out | ✓ | ✓ | ✓ |
| Change own password | ✓ | ✓ | ✓ |
| Two-factor authentication setup | ✓ | — | — |
| View own profile | ✓ | ✓ | ✓ |
| Edit own profile details | ✓ | ✓ (position and specialization read-only) | ✓ |
| Dashboard | ✓ institution-wide | ✓ own programs | ✓ own learning |
| Create trainee accounts | ✓ | — | — |
| Edit / delete trainee accounts | ✓ | — | — |
| Create trainer accounts | ✓ | — | — |
| Edit / delete trainer accounts | ✓ | — | — |
| Resend activation email | ✓ | — | — |
| Assign a trainer to a program | ✓ | — | — |
| Assign a trainee to a program and trainer | ✓ | — | — |
| Create / edit / delete courses | ✓ | — | — |
| View course catalogue | ✓ | **Assigned** | **Own** enrollments |
| Author lessons | — | **Assigned** | — |
| Author quizzes | — | **Assigned** | — |
| Author exams | — | **Assigned** | — |
| Read-only lesson / quiz / exam registries | ✓ | — | — |
| Review competencies | ✓ | **Assigned** (in course view) | **Own** (in course view) |
| Submit an enrollment application | — | — | ✓ |
| Approve / reject / cancel enrollments | ✓ | — | — |
| Mark an enrollment completed | ✓ | — | — |
| Record a payment | ✓ | — | — |
| Make a payment | — | — | ✓ |
| View fees and balances | ✓ all | — | ✓ own |
| Create class schedules | ✓ all programs | **Assigned** | — |
| Edit / delete class schedules | ✓ all programs | **Assigned** | — |
| View class schedules | ✓ all | **Assigned** | **Own** enrollments |
| Record attendance | — | **Own** sessions | — |
| View attendance records | ✓ all | **Assigned** trainees | ✓ own |
| Take a quiz | — | — | ✓ |
| Take an exam | — | — | ✓ |
| Approve late access / retake requests | — | **Assigned** | — |
| Request late access / retake | — | — | ✓ |
| Create student evaluations | — | **Assigned** | — |
| View student evaluations | ✓ (via reports and records) | **Assigned** | — |
| Review typing test results | — | ✓ (Virtual Assistant) | ✓ own |
| Take the typing test | — | — | ✓ (Virtual Assistant only) |
| Monitor trainee progress | ✓ all | **Assigned** | ✓ own |
| Reports and analytics | ✓ | — | — |
| Export reports to CSV | ✓ | — | — |
| Submit trainer feedback | — | — | ✓ (completed programs) |
| Read trainer feedback | ✓ (requires MFA for export) | — | ✓ own submission |
| Correct trainer feedback | ✓ (requires MFA) | — | — |
| Post announcements | ✓ all audiences | ✓ own programs | — |
| Read announcements | ✓ | ✓ | ✓ |
| System settings | ✓ | — | — |
| Reset demonstration data | ✓ | — | — |
| View the audit trail | — (records are written server-side; no viewer in the interface) | — | — |

### 9.2 Features available to all roles

- Sign in, sign out, and password reset.
- **My Profile**: view and edit personal details, change password.
- Personal dashboard with role-specific summary.
- Announcements relevant to the user.
- Toast confirmations for every save, update, and failure.

### 9.3 Features exclusive to the Super Admin

- All account creation and deletion.
- Course setup and trainer assignment.
- Enrollment decisions and manual completion.
- Institution-wide attendance, accounting, and reports.
- Reading, correcting, and exporting trainee feedback.
- System settings, thresholds, and data reset.
- Two-factor authentication.

### 9.4 Features exclusive to the Trainer

- Authoring lessons, quizzes, and exams.
- Approving late access and retake requests.
- Recording attendance for their sessions.
- Creating student evaluations.
- Adding remarks to typing test results.

### 9.5 Features exclusive to the Trainee

- Submitting enrollment applications.
- Taking quizzes, exams, and the typing test.
- Marking lessons complete.
- Making payments.
- Submitting trainer feedback.

### 9.6 Features that depend on assignment or status

| Feature | Condition |
|---|---|
| Trainer sees a course, its trainees, lessons, quizzes, exams, schedules | The program must be assigned to that trainer |
| Trainer records attendance | The session must belong to an assigned program **and** must have started |
| Trainee sees a course | An enrollment must exist and be Approved or Enrolled (or Completed) |
| Trainee takes a quiz | The quiz must be published, scheduled, inside its window, and unused |
| Trainee takes an exam | The exam must be published, scheduled, and inside its window |
| Trainee takes the typing test | Enrolled in the Virtual Assistant program |
| Trainee submits trainer feedback | The program must be **Completed**, and no feedback submitted yet |
| Trainer appears in a trainee's Program Assignments | The trainer must be assigned to that course |

---

## 10. Common Errors and Troubleshooting

### 10.1 How to troubleshoot in general

1. **Read the message.** The system names the exact field or rule that failed. Toasts appear at the bottom-right; inline errors appear under the field.
2. **Check your role and assignment.** Most "missing screen" problems are assignment problems, not bugs.
3. **Refresh the page once.** A stale tab can hide a change made by another user.
4. **Sign out and sign in again.** This refreshes your session and permissions.
5. **Try a different browser** if a control does not respond.
6. **Report with details**: the page, the exact message, the time, and what you clicked. Screenshots help, but never include passwords or full personal data.

### 10.2 Message index

| Message | Where it appears | Meaning | Action |
|---|---|---|---|
| "Name and email are required." | Add/Edit Trainee or Trainer | A required field is blank | Fill both fields |
| "Phone number must be exactly 11 digits." | Add/Edit Trainee or Trainer | Phone format is wrong | Enter 11 digits, no spaces or dashes |
| "Select a trainer for: [program]…" | Add/Edit Trainee | A ticked program has no trainer | Assign a trainer to that course or untick it |
| "Activation email sent again." / "Activation email sent to [email]." | Trainee/Trainer pages | The invitation was resent | Ask the user to check inbox and Spam |
| "Please complete the required fields." | Schedules | A required schedule field is blank | Complete the form |
| "Invalid schedule date/time" | Schedules | End time is not after start | Correct the times |
| "Meeting link copied." | Schedules | Link is on the clipboard | Paste it where needed |
| "Enter a valid amount." | Accounting | Payment amount is blank or zero | Enter a positive amount |
| "Status updated to [status]." | Enrollment | Status change succeeded | No action |
| "Please choose a star rating first." | Trainer Feedback | Stars missing | Select 1–5 stars |
| "Please write your feedback before submitting." | Trainer Feedback | Main comment empty | Write your feedback |
| "Thank you — your feedback was submitted." | Trainer Feedback | Success | No action |
| "Please mark every trainee before saving." | Trainer Attendance | A trainee has no status | Mark everyone, or use **Mark all present** |
| "Please select a trainee." | Student Evaluation | No trainee chosen | Choose a trainee |
| "Quiz title is required." / "Exam title is required." | Trainer Quizzes/Exams | Title blank | Enter a title |
| "Add at least one question." | Trainer Quizzes/Exams | No questions | Add a question |
| "Passing score must be between 1 and 100." | Trainer Exams | Passing score blank or out of range | Enter 1–100 |
| "Question 2 needs a correct answer…" | Trainer Exams | A question is unfinished | Complete that question |
| "Lesson title is required." | Trainer Lessons | Title blank | Enter a title |
| "Title and body are required." | Announcements | Title or message blank | Fill both |
| "Feedback text cannot be empty." | Super Admin feedback correction | Main text cleared | Restore the text |
| "A reason is required for the audit trail." | Super Admin feedback correction | Reason blank | State the reason |
| "This link is invalid or has expired." | Activation page | Invitation link used or expired | Ask the Super Admin to resend |
| "This reset link is invalid or has expired." | Password reset page | Reset link used or expired | Request a new reset email |
| "Password is too weak…" | Sign up / Welcome / Reset / Profile | Strength below **Good** | Use a longer password with mixed characters |
| "The passwords do not match." | Sign up / Reset / Profile | Confirmation differs | Retype both |
| "If an account exists for that email, a reset link is on its way." | Sign in | Reset request accepted | Check the inbox, including Spam |

### 10.3 Symptom-based troubleshooting

| Symptom | Check first | Then |
|---|---|---|
| Page will not load | Internet connection, correct URL | Try another browser; ask IT whether the site is reachable |
| Signed in but the dashboard is empty | Role and assignment | Super Admin: check **Trainees**/**Trainers**; Trainer: check **Assigned Programs**; Trainee: check **Enrollment** status |
| Menu item missing | Role | The item belongs to another role; this is expected |
| "No trainers" or "No trainees" | Filters and search box | Clear the search; check the correct tab |
| Data changed but the screen did not update | Cached tab | Refresh the page |
| Button does nothing | Required field above the button | Scroll up for an inline error or toast |
| Cannot export CSV | MFA status (feedback export) | Sign in with the authenticator code |
| Report totals look wrong | Date filters | Reset **From date** and **To date** |
| Trainer rating is blank | Feedback not yet submitted | Ratings appear only after a program is completed and feedback is submitted |

### 10.4 When an expected option is unavailable

If a button, tab, or menu described in this manual is missing:

1. Confirm you are signed in with the correct role (shown in your profile badge).
2. Confirm the record belongs to you: trainers need an assignment, trainees need an approved enrollment.
3. Confirm the record's state: an unpublished lesson, an unscheduled quiz, or an unapproved enrollment hides the next action.
4. Refresh once.
5. If it is still missing, report it to the Super Admin with the page name and a screenshot. Do not attempt to work around a permission control.

---

## 11. Security Guidelines and Best Practices

### 11.1 Passwords

- Use a password rated **Good** or higher. Prefer a long passphrase over a short complicated word.
- Never reuse your LMS password on another website.
- Never share your password — not with a colleague, not with IT, not with the Super Admin. Administrators never need it.
- Change your password immediately if you suspect it was seen.
- Do not write passwords on paper stuck to a monitor or under a keyboard.

### 11.2 Two-factor authentication

- Super Admins should keep MFA switched **on**. It protects feedback data and every export.
- Keep the authenticator app on a device you control.
- If you lose the device, turn MFA off from a signed-in session, then re-enrol immediately.

### 11.3 Shared and public computers

- Always click **Sign out**; closing the tab is not enough.
- Never tick "remember me" on a shared machine.
- Clear the download folder after exporting reports or feedback.
- Do not open the portal on a public kiosk.

### 11.4 Phishing and impersonation

- The system never asks for your password by email or chat.
- Activation and reset emails contain a link only. If an email asks you to reply with your password, it is not from the institution.
- Check the sender address before clicking. When in doubt, open the portal directly and sign in instead of using the link.

### 11.5 Handling trainee and trainer data

- Feedback is confidential. Only the Super Admin may read it, and only for legitimate administrative purposes.
- Exported CSV files contain personal data. Store them in the institution's approved location, not on personal drives or chat apps.
- Do not screenshot learner records for social media.
- Share the minimum necessary: a trainer needs their own trainees' data, not the whole institution's.
- When a correction is needed in feedback, record the reason — the system keeps the original values and the reason in its audit history.

### 11.6 Account lifecycle

- Create accounts only for people who are officially enrolled or employed.
- When a person leaves, ask the Super Admin to remove access promptly.
- Never create a shared account for several people. Every action is attributed to the signed-in account.
- Do not reuse an email address that belonged to a previous person.

### 11.7 Device hygiene

- Keep your browser and operating system updated.
- Avoid installing unknown extensions that can read page content.
- Lock your screen when stepping away during a class or an exam.

---

## 12. Frequently Asked Questions

**1. I forgot my password. What do I do?**
Click **Forgot password?** on the sign-in page, enter your email, and open the link in the email. The link expires, so use the newest one.

**2. I never received my activation email.**
Check Spam or Junk first. If it is not there, ask the Super Admin to resend the invitation from the Trainees or Trainers page, then open the newest link.

**3. Can I change my email address?**
Yes, from **My Profile**. Your email is also your login name, so use the new address the next time you sign in. If your institution requires administrator approval for email changes, the field may be read-only — ask the Super Admin.

**4. Why can't I see a course I was told about?**
Either the program is not assigned to you (trainer) or your enrollment is not approved (trainee). Ask the Super Admin to check the assignment or the application status.

**5. Why is my progress still 0% after reading a lesson?**
Reading does not count. Open the lesson and click **Mark as Complete**.

**6. How many times can I take a quiz?**
One attempt per quiz. If you need another, click **Request Retake** and wait for your trainer's approval.

**7. Can I take an exam more than once?**
An exam can be opened again while its window is still open, and each attempt is recorded in your grades. Your trainer controls the window.

**8. The timer ended before I finished. Can I get the time back?**
No. The attempt is forfeited. Request a retake and explain what happened.

**9. Why does the quiz say "Not scheduled"?**
Your trainer has not set a start date and deadline. The quiz cannot be opened until they do.

**10. When can I submit trainer feedback?**
Only after the program is **Completed**. Then open **Trainer Feedback** and submit your stars and comment together. You can submit once per program.

**11. Can my trainer see the feedback I wrote?**
No. Neither the stars nor the text are visible to trainers. Only the Super Admin can read feedback.

**12. Why can't I submit feedback twice?**
Feedback is recorded once per program and is permanent. Contact the Super Admin if a factual correction is needed.

**13. How do I know my enrollment was approved?**
Open **Enrollment** and check **My Applications**. **Approved** or **Enrolled** means you have access. The course also appears under **My Courses**.

**14. My payment is not showing.**
Check **My Payments** for the record. If it is missing, give the Super Admin your reference number and payment date.

**15. Can I use the system on my phone?**
Yes, but wide tables are easier on a laptop. Quizzes and exams are best taken on a stable connection.

**16. Why does the Super Admin page ask for a code?**
Two-factor authentication is enabled. Enter the 6-digit code from your authenticator app.

**17. What happens when a program is completed automatically?**
When every lesson is marked complete and every quiz and exam is passed, the enrollment becomes **Completed**, and trainer feedback opens for that trainee.

**18. Who do I contact for a technical problem?**
Your Super Admin first. See Section 14 for the escalation contacts.

---

## 13. Glossary of Terms

| Term | Meaning in this system |
|---|---|
| **Activation email** | The message containing the one-time link a new trainer or trainee uses to create their own password |
| **Announcement** | A notice posted to everyone, all trainees, or all trainers, optionally limited to one program |
| **Assessment** | A quiz, an exam, or the typing test |
| **Attempt** | One submission of an assessment by one trainee |
| **Audit trail** | The server-side record of sensitive actions such as feedback exports and corrections |
| **Competency** | A unit of skill inside a program; groups lessons and quizzes |
| **Course / Program** | The training offering (for example, Bread and Pastry Production NC II). The menu calls it **Courses**; records are called programs |
| **Dashboard** | The landing page for a role, showing summary cards and recent activity |
| **Deadline** | The date and time after which a quiz or exam can no longer be started |
| **Enrollment** | The link between a trainee and a program, carrying a status and payment details |
| **Evaluation** | A trainer's 1–5 star assessment of a trainee across five criteria, with remarks |
| **Feedback** | The trainee's star rating plus written comments about a trainer, submitted after program completion |
| **Late access** | Permission to take a quiz after its deadline when the trainee never attempted it |
| **Lesson** | A unit of content inside a competency, with text, an optional video, and materials |
| **MFA (two-factor authentication)** | A second sign-in step using a 6-digit code from an authenticator app |
| **Passing score** | The percentage a trainee must reach to pass an assessment (default 75%) |
| **Program assignment (trainer)** | The link that lets a trainer work on a specific course |
| **Program assignment (trainee)** | The courses attached to a trainee's account by the Super Admin |
| **Published** | A lesson, quiz, or exam that trainees are allowed to see |
| **Retake** | A trainer-approved additional attempt at a quiz |
| **RLS (Row Level Security)** | The database rule set that limits every user to their own permitted rows |
| **Role** | Super Admin, Trainer, or Trainee |
| **Scholarship / Voucher** | An enrollment funded by TESDA or a sponsor, with no payment required |
| **Self-Pay** | An enrollment where the trainee pays the training fee |
| **Session** | One scheduled class meeting with a date, time, venue, and class type |
| **Super Admin** | The administrator role; stored internally as `admin` |
| **Toast** | The small confirmation or error message that appears at the bottom-right |
| **Typing test** | A timed typing assessment available to Virtual Assistant trainees; passing is 40% |
| **WPM** | Words per minute, the typing speed measure |
| **Under Review** | An enrollment status meaning the application is being checked |

---

## 14. Support and Contact Information

### 14.1 Who to contact

| Concern | Contact | Details |
|---|---|---|
| Cannot sign in, account locked, activation email missing | Super Admin | *To Be Confirmed* |
| Enrollment status, program assignment, fees | Super Admin / Registrar | *To Be Confirmed* |
| Course content, quiz schedule, grades | Your assigned Trainer | *To Be Confirmed* |
| Technical fault, page errors, data not saving | IT Support | *To Be Confirmed* |
| Data privacy request | Data Protection Officer | *To Be Confirmed* |

### 14.2 What to include in a support request

1. Your full name, role, and email address.
2. The page and, if possible, the web address shown in the browser.
3. The exact message you saw (copy the text).
4. The date and time it happened.
5. What you clicked immediately before the problem.
6. A screenshot, with personal data of other people masked.

> **Warning**
> Never send your password, an authenticator code, or a full export of learner data in a support request.

### 14.3 Service expectations

| Item | Target |
|---|---|
| Response to a sign-in problem | Same working day |
| Response to a data error | Within two working days |
| Planned maintenance notice | At least three working days in advance |

*Targets are institutional commitments and must be confirmed by the Super Admin.*

---

## 15. Appendix A — Screenshot Checklist

The manual uses placeholders because screenshots must be captured from your live deployment, with real data removed or masked. Capture each item below at 1440 px width or wider, in the default theme, with sample data that contains no real personal information.

| # | Placeholder | Where it belongs | What must be visible |
|---|---|---|---|
| 1 | Login Page | Section 4.1 | Email, password, show/hide icon, Forgot password, Sign in, Sign up |
| 2 | Login Page with error message | Section 5.1 | Red inline error under Password |
| 3 | Dashboard Layout with callouts | Section 5.6 | Sidebar groups, page title, action button, bell, user menu |
| 4 | Super Admin Dashboard | Section 6.2 | Four cards, Enrollment by Program, System Health, Recent Applications |
| 5 | Trainee Directory and Add Trainee dialog | Section 6.3 | Search, row icons, Program Assignments with trainer selectors |
| 6 | Trainer Directory | Section 6.4 | Awaiting activation badge, resend icon, Rating column |
| 7 | Courses list and Add Course form | Section 6.5 | Summary cards, Add Course, fee/duration/hours, Assigned Trainer |
| 8 | Enrollment review dialog | Section 6.8 | Tabs, Review, status chips, Approve/Reject, Record Full Payment |
| 9 | Reports and Analytics | Section 6.12 | Filters, four cards, Export CSV, report sections |
| 10 | Trainer Feedback page | Section 6.13 | Filters, rating column, View, Export CSV, MFA notice |
| 11 | System Settings | Section 6.15 | Institution info, thresholds, toggles, System Information, Data Management, MFA card |
| 12 | Trainer Dashboard | Section 7.2 | Four cards, Recent Submissions, Upcoming classes |
| 13 | Lesson editor with Learning Materials | Section 7.5 | Program/Competency, content, Add material, Published, Save Lesson |
| 14 | Quiz Access Requests | Section 7.8 | Request type, trainee, date, approve/reject, decided list |
| 15 | Attendance recording | Section 7.10 | Session selector, four statuses, time fields, Mark all present, Save |
| 16 | Progress Monitoring | Section 7.13 | Four cards with At Risk, comparison chart, progress bars |
| 17 | Trainee Dashboard | Section 8.2 | Four cards, Next Class, Upcoming Quiz, Latest Scores, My Enrollments |
| 18 | Lesson page | Section 8.5 | Course Lessons list, video, materials, Mark as Complete |
| 19 | Quiz runner with countdown | Section 8.6 | Questions/time/passing, countdown, Server deadline, Submit |
| 20 | Exam result panel | Section 8.7 | Verified by the server, correct/total, percentage, Back to course |
| 21 | Trainer Feedback form | Section 8.13 | Awaiting/Submitted counters, stars, Your feedback, optional sections, Submit |

> **Note**
> Do not present these placeholders as real screenshots. Replace each one with an image captured from the deployed system, and keep the caption and "What to look for" text consistent with the final image.

---

## 16. Appendix B — Items To Be Confirmed

The following items could not be confirmed from the system itself. They must be answered by the institution before this manual is published as final.

| # | Item | Why it is unconfirmed | Owner |
|---|---|---|---|
| 1 | Production web address | The URL is deployment-specific and not stored in the application | Super Admin / IT |
| 2 | Support contacts and response times | Institutional policy, not system data | Institution Head |
| 3 | Certificate or completion document issuance | No certificate screen exists in the current interface; completion is recorded as an enrollment status only | Academic Head |
| 4 | Activating, deactivating, or suspending an account from the interface | Account statuses exist in the data layer, but the interface exposes only create, edit, and delete | Super Admin |
| 5 | Viewing the audit trail in the interface | Audit records are written server-side; there is no viewer screen | Super Admin / IT |
| 6 | Exact behaviour of **Maintenance mode** | The toggle exists; its end-to-end effect has not been verified | IT |
| 7 | Managing course categories as a list | **Category** is a free-text field on the course form; there is no category management page | Academic Head |
| 8 | Assignment submission (file uploads by trainees) | Not part of the current build; assessments are quizzes, exams, and the typing test | Academic Head |
| 9 | Email deliverability guarantees | Depends on the institution's mail configuration | IT |
| 10 | Data retention period for feedback and audit records | Institutional policy | Data Protection Officer |

### 16.1 Features intentionally absent from this manual

To avoid implying functions that do not exist, note that the current build has **no** screens for:

- Issuing or downloading certificates.
- Submitting file-based assignments.
- Bulk importing users.
- A built-in audit log viewer.
- A category manager.
- Trainer self-registration.

If any of these becomes available in a future release, add a new section and update the version history.

---

**End of document**

*HYTech Learning Management System — User Manual, Version 1.0, 21 October 2026.*
