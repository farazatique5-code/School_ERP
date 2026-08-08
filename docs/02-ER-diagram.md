# ER Diagram — Phase 1 Core Foundation

This covers only the tables created in `001_core_foundation.sql`. Every later phase adds its own ER diagram in its own doc file (e.g. `phase-3-er-diagram.md`) that extends this one — we never redraw the whole diagram from scratch, we append.

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ SCHOOLS : "has many"
    ORGANIZATIONS ||--o{ PROFILES : "has many"
    ORGANIZATIONS ||--o{ ROLES : "owns custom roles"
    ORGANIZATIONS ||--o{ AUDIT_LOGS : "scopes"
    ORGANIZATIONS ||--o{ NOTIFICATIONS : "scopes"
    ORGANIZATIONS ||--o{ AUTOMATION_RUNS : "scopes"

    SCHOOLS ||--o{ ACADEMIC_YEARS : "has many"
    SCHOOLS ||--o{ DEPARTMENTS : "has many"
    SCHOOLS ||--o{ HOUSES : "has many"
    SCHOOLS ||--o{ GRADING_SCALES : "has many"
    SCHOOLS ||--o{ SUBJECTS : "has many"
    SCHOOLS ||--o{ SCHOOL_TIMINGS : "has many"
    SCHOOLS ||--o{ USER_ROLES : "scopes optional"

    ACADEMIC_YEARS ||--o{ TERMS : "has many"
    ACADEMIC_YEARS ||--o{ CLASSES : "has many"

    CLASSES ||--o{ SECTIONS : "has many"
    CLASSES ||--o{ CLASS_SUBJECTS : "has many"
    SUBJECTS ||--o{ CLASS_SUBJECTS : "has many"

    GRADING_SCALES ||--o{ GRADING_SCALE_BANDS : "has many"

    PROFILES ||--o{ USER_ROLES : "has many"
    ROLES ||--o{ USER_ROLES : "assigned via"
    ROLES ||--o{ ROLE_PERMISSIONS : "has many"
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : "granted via"
    SCHOOLS ||--o{ USER_ROLES : "optionally scopes"

    PROFILES ||--o{ AUDIT_LOGS : "acts as"
    PROFILES ||--o{ NOTIFICATIONS : "receives"

    ORGANIZATIONS {
        uuid id PK
        text name
        text slug
        text custom_domain
        text subscription_plan
        jsonb settings
    }
    SCHOOLS {
        uuid id PK
        uuid organization_id FK
        text name
        text code
        text type
    }
    ACADEMIC_YEARS {
        uuid id PK
        uuid school_id FK
        text name
        boolean is_current
    }
    TERMS {
        uuid id PK
        uuid academic_year_id FK
        text name
        integer sequence
    }
    CLASSES {
        uuid id PK
        uuid school_id FK
        uuid academic_year_id FK
        text name
    }
    SECTIONS {
        uuid id PK
        uuid class_id FK
        text name
    }
    SUBJECTS {
        uuid id PK
        uuid school_id FK
        text name
        uuid department_id FK
    }
    PROFILES {
        uuid id PK "references auth.users"
        uuid organization_id FK
        text full_name
        text email
    }
    ROLES {
        uuid id PK
        uuid organization_id FK "null = system template"
        text name
        boolean is_system
    }
    PERMISSIONS {
        uuid id PK
        text key
        text module
    }
    ROLE_PERMISSIONS {
        uuid role_id FK
        uuid permission_id FK
    }
    USER_ROLES {
        uuid id PK
        uuid profile_id FK
        uuid role_id FK
        uuid school_id FK "null = org-wide"
    }
    AUDIT_LOGS {
        uuid id PK
        uuid organization_id FK
        uuid actor_profile_id FK
        text table_name
        text action
        jsonb before_data
        jsonb after_data
    }
    NOTIFICATIONS {
        uuid id PK
        uuid recipient_profile_id FK
        text channel
        boolean is_read
    }
    AUTOMATION_RUNS {
        uuid id PK
        uuid organization_id FK
        text automation_key
        text status
    }
```

## Key relationship rules encoded here

1. **Every tenant-owned table hangs off `organizations` or `schools`**, directly or transitively. No table in any future phase should exist without a path back to `organization_id`.
2. **`user_roles.school_id` is nullable by design** — null means "this role applies across every school in the organization" (e.g. Organization Owner, Super Admin, HR Manager at group level). A non-null value scopes the role to one campus (e.g. a Teacher who only works at Campus North).
3. **`roles` with `organization_id = null`** are system templates copied into a new org at signup time — this is how we ship the seed role list (Teacher, Accountant, etc.) while still letting each org fully customize its own copy without touching a shared row.
4. **Grading scales and grading bands are school-level**, not org-level, because different campuses in the same group commonly use different grading systems (e.g. one campus IB, another state curriculum).
